package index

// SymbolKind classifies a declared symbol.
type SymbolKind string

const (
	KindContract  SymbolKind = "contract"
	KindInterface SymbolKind = "interface"
	KindLibrary   SymbolKind = "library"
	KindFunction  SymbolKind = "function"
	KindModifier  SymbolKind = "modifier"
	KindEvent     SymbolKind = "event"
	KindVariable  SymbolKind = "variable"
	// KindExternal is a placeholder for something referenced but not declared
	// in the indexed project (typically a dependency such as OpenZeppelin's
	// Ownable when lib/ and node_modules are not indexed).
	KindExternal SymbolKind = "external"
)

// IsContractLike reports whether the kind is a type-level container.
func (k SymbolKind) IsContractLike() bool {
	return k == KindContract || k == KindInterface || k == KindLibrary || k == KindExternal
}

// Symbol is one declared thing. IDs are stable within an index build:
// "path::Contract", "path::Contract.fn/arity", "path::Contract.var".
type Symbol struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Kind       SymbolKind `json:"kind"`
	Parent     string     `json:"parent,omitempty"` // containing contract ID, if any
	Path       string     `json:"path"`
	Line       int        `json:"line"`
	Arity      int        `json:"arity"` // functions/modifiers only; -1 otherwise
	Visibility string     `json:"visibility,omitempty"`
	Mutability string     `json:"mutability,omitempty"`
	VarType    string     `json:"varType,omitempty"` // state variables: leading type name
	Language   string     `json:"language"`
}

// EdgeKind is the relationship an edge represents.
type EdgeKind string

const (
	EdgeCalls      EdgeKind = "calls"
	EdgeExtends    EdgeKind = "extends"
	EdgeReferences EdgeKind = "references"
	EdgeImports    EdgeKind = "imports"
)

// Edge is a resolved directed relationship From -> To.
type Edge struct {
	From  string   `json:"from"`
	To    string   `json:"to"`
	Kind  EdgeKind `json:"kind"`
	Path  string   `json:"path"`
	Line  int      `json:"line"`
	Count int      `json:"count"`
}

// Severity of a finding, ordered none < info < warning < critical.
type Severity string

const (
	SevNone     Severity = "none"
	SevInfo     Severity = "info"
	SevWarning  Severity = "warning"
	SevCritical Severity = "critical"
)

func (s Severity) rank() int {
	switch s {
	case SevInfo:
		return 1
	case SevWarning:
		return 2
	case SevCritical:
		return 3
	}
	return 0
}

func maxSeverity(a, b Severity) Severity {
	if b.rank() > a.rank() {
		return b
	}
	if a == "" {
		return SevNone
	}
	return a
}

// Finding is a heuristic observation attached to a symbol and source line.
// Findings are leads for a human reviewer, never verdicts.
type Finding struct {
	SymbolID string   `json:"symbolId"`
	Path     string   `json:"path"`
	Line     int      `json:"line"`
	Severity Severity `json:"severity"`
	Rule     string   `json:"rule"`
	Message  string   `json:"message"`
}

// RawRef is an unresolved reference emitted by an adapter. The engine
// resolves it after every file has been parsed.
type RawRef struct {
	From      string   // symbol ID the reference occurs in
	Scope     string   // enclosing contract ID ("" for free functions)
	Qualifier string   // text before the dot, "" for an unqualified name
	Name      string   // referenced name
	Arity     int      // call argument count, -1 if unknown/any
	Kind      EdgeKind // EdgeCalls, EdgeExtends, or EdgeReferences
	Path      string
	Line      int
}

// FileResult is everything an adapter extracts from one file.
type FileResult struct {
	Path     string
	Symbols  []Symbol
	Refs     []RawRef
	Findings []Finding
	Imports  []string // raw import specifiers, recorded for display; not resolved
}
