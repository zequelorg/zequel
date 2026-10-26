package index

import (
	"errors"
	"fmt"
	"sort"
)

// ErrNotFound is returned when a requested symbol is not in the index.
var ErrNotFound = errors.New("symbol not found")

// The types below are the wire contract with the renderer's graph view; their
// JSON shape mirrors apps/desktop/src/lib/research/graph-types.ts exactly.
type TraceRoot struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Path  string `json:"path"`
}

type TraceNode struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Path        string `json:"path"`
	MetricValue int    `json:"metricValue"`
	MetricUnit  string `json:"metricUnit"`
	Direction   string `json:"direction"` // "inflows" | "outflows"
	Kind        string `json:"kind"`
	Severity    string `json:"severity"`
}

type TraceEdge struct {
	ID       string `json:"id"`
	SourceID string `json:"sourceId"`
	TargetID string `json:"targetId"`
	Kind     string `json:"kind"`
	Severity string `json:"severity"`
}

type TraceGraph struct {
	Root  TraceRoot   `json:"root"`
	Nodes []TraceNode `json:"nodes"`
	Edges []TraceEdge `json:"edges"`
}

const maxNodesPerDirection = 200

type liftedEdge struct {
	from, to string
	kind     EdgeKind
}

// Trace builds the reference graph around rootID. Contract-like roots are
// traced at contract granularity (member-level calls are rolled up onto their
// contracts); function and modifier roots are traced at function granularity.
// depth is clamped to 1..4.
func (ix *Index) Trace(rootID string, depth int) (*TraceGraph, error) {
	root, ok := ix.Symbols[rootID]
	if !ok {
		return nil, ErrNotFound
	}
	if (root.Kind == KindVariable || root.Kind == KindEvent) && root.Parent != "" {
		root = ix.Symbols[root.Parent]
		if root == nil {
			return nil, ErrNotFound
		}
	}
	rootID = root.ID
	contractLevel := root.Kind.IsContractLike()
	depth = max(1, min(depth, 4))

	lift := func(id string) string {
		s := ix.Symbols[id]
		if s == nil {
			return ""
		}
		if contractLevel {
			if s.Kind.IsContractLike() {
				return id
			}
			return s.Parent
		}
		switch s.Kind {
		case KindFunction, KindModifier, KindContract, KindInterface, KindLibrary, KindExternal:
			return id
		}
		return ""
	}

	seenEdge := map[liftedEdge]bool{}
	var lifted []liftedEdge
	out := map[string][]liftedEdge{}
	in := map[string][]liftedEdge{}
	for _, e := range ix.Edges {
		le := liftedEdge{lift(e.From), lift(e.To), e.Kind}
		if le.from == "" || le.to == "" || le.from == le.to || seenEdge[le] {
			continue
		}
		seenEdge[le] = true
		lifted = append(lifted, le)
		out[le.from] = append(out[le.from], le)
		in[le.to] = append(in[le.to], le)
	}

	type reached struct {
		id        string
		direction string
		kind      EdgeKind
	}
	included := map[string]bool{rootID: true}
	var nodes []reached

	walk := func(dir string, next func(string) []liftedEdge, other func(liftedEdge) string) {
		frontier := []string{rootID}
		count := 0
		for d := 0; d < depth && len(frontier) > 0; d++ {
			var nf []string
			for _, id := range frontier {
				for _, le := range next(id) {
					t := other(le)
					if included[t] || count >= maxNodesPerDirection {
						continue
					}
					included[t] = true
					count++
					nodes = append(nodes, reached{t, dir, le.kind})
					nf = append(nf, t)
				}
			}
			frontier = nf
		}
	}
	walk("outflows", func(id string) []liftedEdge { return out[id] }, func(le liftedEdge) string { return le.to })
	walk("inflows", func(id string) []liftedEdge { return in[id] }, func(le liftedEdge) string { return le.from })

	sev := map[string]Severity{}
	for _, f := range ix.Findings {
		target := f.SymbolID
		if contractLevel {
			target = lift(f.SymbolID)
		}
		sev[target] = maxSeverity(sev[target], f.Severity)
	}
	sevStr := func(id string) string {
		if s := sev[id]; s != "" {
			return string(s)
		}
		return string(SevNone)
	}

	g := &TraceGraph{Root: ix.traceRoot(root), Nodes: []TraceNode{}, Edges: []TraceEdge{}}
	for _, n := range nodes {
		s := ix.Symbols[n.id]
		g.Nodes = append(g.Nodes, TraceNode{
			ID: n.id, Label: ix.label(s), Path: ix.where(s),
			MetricValue: len(in[n.id]), MetricUnit: "refs",
			Direction: n.direction, Kind: string(n.kind), Severity: sevStr(n.id),
		})
	}
	sort.Slice(lifted, func(i, j int) bool {
		a, b := lifted[i], lifted[j]
		if a.from != b.from {
			return a.from < b.from
		}
		if a.to != b.to {
			return a.to < b.to
		}
		return a.kind < b.kind
	})
	for _, le := range lifted {
		if included[le.from] && included[le.to] {
			g.Edges = append(g.Edges, TraceEdge{
				ID: fmt.Sprintf("%s->%s:%s", le.from, le.to, le.kind),
				SourceID: le.from, TargetID: le.to, Kind: string(le.kind), Severity: string(SevNone),
			})
		}
	}
	return g, nil
}

func (ix *Index) traceRoot(s *Symbol) TraceRoot {
	return TraceRoot{ID: s.ID, Label: ix.label(s), Path: ix.where(s)}
}

func (ix *Index) label(s *Symbol) string {
	if s.Parent != "" {
		if p := ix.Symbols[s.Parent]; p != nil {
			return p.Name + "." + s.Name
		}
	}
	return s.Name
}

func (ix *Index) where(s *Symbol) string {
	if s.Kind == KindExternal {
		return "(dependency)"
	}
	return fmt.Sprintf("%s:%d", s.Path, s.Line)
}
