package index

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Directories never worth indexing by default. Dependencies (lib/ for
// Foundry, node_modules/ for Hardhat) are skipped so the graph shows the
// project itself; unresolved references into them surface as KindExternal
// placeholders. A future option can include them for dependency research.
var ignoredDirs = map[string]bool{
	"node_modules": true, "lib": true, "out": true, "cache": true, "artifacts": true,
	"broadcast": true, "target": true, "dist": true, "build": true, "coverage": true,
	"typechain-types": true, ".git": true,
}

const (
	maxFiles     = 20000
	maxFileBytes = 2 << 20
)

type FileInfo struct {
	Path     string `json:"path"`
	Language string `json:"language"`
	Symbols  int    `json:"symbols"`
}

type Stats struct {
	Files     int            `json:"files"`
	Symbols   int            `json:"symbols"`
	Edges     int            `json:"edges"`
	Findings  int            `json:"findings"`
	Languages map[string]int `json:"languages"`
	Truncated bool           `json:"truncated"`
}

// Index is an immutable snapshot of one indexing run.
type Index struct {
	Root      string
	Files     []FileInfo
	Symbols   map[string]*Symbol
	Order     []string // symbol IDs sorted by path, line, id
	Edges     []Edge
	Findings  []Finding
	Truncated bool

	byName  map[string][]string // contract-like name -> IDs
	members map[string][]string // container ID -> member IDs
	bases   map[string][]string // contract ID -> direct base IDs
	freeFns map[string][]string // free function name -> IDs
	edgeIdx map[string]int
}

// Build walks root, parses every file a registered adapter handles, and
// resolves references project-wide. It honors ctx cancellation.
func Build(ctx context.Context, root string, reg *Registry) (*Index, error) {
	ix := &Index{
		Root: root, Symbols: map[string]*Symbol{},
		byName: map[string][]string{}, members: map[string][]string{},
		bases: map[string][]string{}, freeFns: map[string][]string{},
		edgeIdx: map[string]int{},
	}
	var results []FileResult
	langOf := map[string]string{}

	walkErr := filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if cerr := ctx.Err(); cerr != nil {
			return cerr
		}
		if err != nil {
			return nil // unreadable entry: skip, don't fail the whole index
		}
		if d.IsDir() {
			if p != root && (ignoredDirs[d.Name()] || strings.HasPrefix(d.Name(), ".")) {
				return filepath.SkipDir
			}
			return nil
		}
		if d.Type()&fs.ModeSymlink != 0 {
			return nil
		}
		ad, ok := reg.ForExt(filepath.Ext(d.Name()))
		if !ok {
			return nil
		}
		if len(results) >= maxFiles {
			ix.Truncated = true
			return filepath.SkipAll
		}
		if info, ierr := d.Info(); ierr != nil || info.Size() > maxFileBytes {
			return nil
		}
		src, rerr := os.ReadFile(p)
		if rerr != nil {
			return nil
		}
		rel, rerr := filepath.Rel(root, p)
		if rerr != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		results = append(results, ad.Parse(rel, src))
		langOf[rel] = ad.Language()
		return nil
	})
	if walkErr != nil {
		return nil, walkErr
	}

	sort.Slice(results, func(i, j int) bool { return results[i].Path < results[j].Path })

	var refs []RawRef
	for _, fr := range results {
		ix.Files = append(ix.Files, FileInfo{Path: fr.Path, Language: langOf[fr.Path], Symbols: len(fr.Symbols)})
		for i := range fr.Symbols {
			s := fr.Symbols[i]
			ix.Symbols[s.ID] = &s
			ix.Order = append(ix.Order, s.ID)
			if s.Parent != "" {
				ix.members[s.Parent] = append(ix.members[s.Parent], s.ID)
			}
			if s.Kind.IsContractLike() {
				ix.byName[s.Name] = append(ix.byName[s.Name], s.ID)
			}
			if s.Parent == "" && (s.Kind == KindFunction) {
				ix.freeFns[s.Name] = append(ix.freeFns[s.Name], s.ID)
			}
		}
		ix.Findings = append(ix.Findings, fr.Findings...)
		refs = append(refs, fr.Refs...)
	}

	// Inheritance first: member lookup walks base chains.
	for _, r := range refs {
		if r.Kind != EdgeExtends {
			continue
		}
		base := ix.pickByName(r.Name, r.Path)
		if base == "" {
			base = ix.external(r.Name)
		}
		ix.bases[r.From] = append(ix.bases[r.From], base)
		ix.addEdge(r.From, base, EdgeExtends, r.Path, r.Line)
	}
	// State-variable types are contract-level references.
	for _, id := range ix.Order {
		s := ix.Symbols[id]
		if s.Kind == KindVariable && s.VarType != "" {
			if t := ix.pickByName(s.VarType, s.Path); t != "" && t != s.Parent {
				ix.addEdge(s.Parent, t, EdgeReferences, s.Path, s.Line)
			}
		}
	}
	for _, r := range refs {
		if r.Kind != EdgeExtends {
			ix.resolve(r)
		}
	}

	sort.Slice(ix.Order, func(i, j int) bool {
		a, b := ix.Symbols[ix.Order[i]], ix.Symbols[ix.Order[j]]
		if a.Path != b.Path {
			return a.Path < b.Path
		}
		if a.Line != b.Line {
			return a.Line < b.Line
		}
		return a.ID < b.ID
	})
	sort.Slice(ix.Edges, func(i, j int) bool {
		a, b := ix.Edges[i], ix.Edges[j]
		if a.From != b.From {
			return a.From < b.From
		}
		if a.To != b.To {
			return a.To < b.To
		}
		return a.Kind < b.Kind
	})
	sort.SliceStable(ix.Findings, func(i, j int) bool {
		a, b := ix.Findings[i], ix.Findings[j]
		if a.Path != b.Path {
			return a.Path < b.Path
		}
		return a.Line < b.Line
	})
	return ix, nil
}

func (ix *Index) Stats() Stats {
	st := Stats{Files: len(ix.Files), Symbols: len(ix.Symbols), Edges: len(ix.Edges),
		Findings: len(ix.Findings), Languages: map[string]int{}, Truncated: ix.Truncated}
	for _, f := range ix.Files {
		st.Languages[f.Language]++
	}
	return st
}

func (ix *Index) addEdge(from, to string, kind EdgeKind, path string, line int) {
	if from == "" || to == "" || from == to {
		return
	}
	key := from + "\x00" + to + "\x00" + string(kind)
	if i, ok := ix.edgeIdx[key]; ok {
		ix.Edges[i].Count++
		return
	}
	ix.edgeIdx[key] = len(ix.Edges)
	ix.Edges = append(ix.Edges, Edge{From: from, To: to, Kind: kind, Path: path, Line: line, Count: 1})
}

// pickByName resolves a contract-like name project-wide: same file first,
// otherwise the first declaration in path order. Imports are not consulted
// (see doc.go), so two same-named contracts in different files can resolve to
// the wrong one — a known, documented limitation.
func (ix *Index) pickByName(name, fromPath string) string {
	ids := ix.byName[name]
	for _, id := range ids {
		if s := ix.Symbols[id]; s != nil && s.Path == fromPath && s.Kind != KindExternal {
			return id
		}
	}
	for _, id := range ids {
		if s := ix.Symbols[id]; s != nil && s.Kind != KindExternal {
			return id
		}
	}
	return ""
}

func (ix *Index) external(name string) string {
	id := "ext::" + name
	if _, ok := ix.Symbols[id]; !ok {
		ix.Symbols[id] = &Symbol{ID: id, Name: name, Kind: KindExternal, Path: "(dependency)", Arity: -1}
		ix.Order = append(ix.Order, id)
	}
	return id
}

// lookupFrom searches the given containers and then their bases (breadth
// first) and returns the members of the first container that has any match.
func (ix *Index) lookupFrom(starts []string, name string, match func(*Symbol) bool) []string {
	visited := map[string]bool{}
	queue := append([]string(nil), starts...)
	for len(queue) > 0 {
		c := queue[0]
		queue = queue[1:]
		if c == "" || visited[c] {
			continue
		}
		visited[c] = true
		var found []string
		for _, mid := range ix.members[c] {
			if m := ix.Symbols[mid]; m != nil && m.Name == name && match(m) {
				found = append(found, mid)
			}
		}
		if len(found) > 0 {
			return found
		}
		queue = append(queue, ix.bases[c]...)
	}
	return nil
}

func callable(arity int) func(*Symbol) bool {
	return func(s *Symbol) bool {
		switch s.Kind {
		case KindModifier:
			return true
		case KindFunction:
			return arity < 0 || s.Arity == arity
		}
		return false
	}
}

func (ix *Index) resolve(r RawRef) {
	switch r.Kind {
	case EdgeReferences: // emit Event(...) or new Contract(...)
		if r.Scope != "" {
			ids := ix.lookupFrom([]string{r.Scope}, r.Name, func(s *Symbol) bool { return s.Kind == KindEvent })
			for _, id := range ids {
				ix.addEdge(r.From, id, EdgeReferences, r.Path, r.Line)
			}
			if len(ids) > 0 {
				return
			}
		}
		ix.addEdge(r.From, ix.pickByName(r.Name, r.Path), EdgeReferences, r.Path, r.Line)

	case EdgeCalls:
		var targets []string
		switch r.Qualifier {
		case "":
			if r.Scope != "" {
				targets = ix.lookupFrom([]string{r.Scope}, r.Name, callable(r.Arity))
			}
			if len(targets) == 0 {
				for _, id := range ix.freeFns[r.Name] {
					if s := ix.Symbols[id]; s != nil && (r.Arity < 0 || s.Arity == r.Arity) {
						targets = append(targets, id)
					}
				}
			}
			if len(targets) == 0 { // a cast or constructor-style use: IFoo(addr)
				ix.addEdge(r.From, ix.pickByName(r.Name, r.Path), EdgeReferences, r.Path, r.Line)
				return
			}
		case "this":
			if r.Scope != "" {
				targets = ix.lookupFrom([]string{r.Scope}, r.Name, callable(r.Arity))
			}
		case "super":
			targets = ix.lookupFrom(ix.bases[r.Scope], r.Name, callable(r.Arity))
		default:
			var typeID string
			if r.Scope != "" {
				vars := ix.lookupFrom([]string{r.Scope}, r.Qualifier, func(s *Symbol) bool { return s.Kind == KindVariable })
				if len(vars) > 0 {
					if v := ix.Symbols[vars[0]]; v != nil && v.VarType != "" {
						typeID = ix.pickByName(v.VarType, v.Path)
					}
				}
			}
			if typeID == "" {
				typeID = ix.pickByName(r.Qualifier, r.Path)
			}
			if typeID != "" {
				targets = ix.lookupFrom([]string{typeID}, r.Name, callable(r.Arity))
			}
		}
		for _, id := range targets {
			ix.addEdge(r.From, id, EdgeCalls, r.Path, r.Line)
		}
	}
}

// ListSymbols returns symbols filtered by kind set and case-insensitive
// substring query (matched against name and ID), capped at limit.
func (ix *Index) ListSymbols(q string, kinds map[SymbolKind]bool, limit int) []Symbol {
	if len(kinds) == 0 {
		kinds = map[SymbolKind]bool{KindContract: true, KindInterface: true, KindLibrary: true, KindFunction: true}
	}
	q = strings.ToLower(q)
	out := []Symbol{}
	for _, id := range ix.Order {
		s := ix.Symbols[id]
		if !kinds[s.Kind] {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(s.Name), q) && !strings.Contains(strings.ToLower(s.ID), q) {
			continue
		}
		out = append(out, *s)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}
