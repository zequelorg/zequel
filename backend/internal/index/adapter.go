package index

import "strings"

// Adapter extracts symbols, references and findings from one language.
// Implementations must be safe for concurrent use and must never panic on
// malformed input — a half-written file in an editor is the normal case, so
// adapters return what they could extract rather than failing the whole index.
type Adapter interface {
	Language() string
	Extensions() []string // lower-case, with leading dot, e.g. ".sol"
	Parse(path string, src []byte) FileResult
}

// Registry maps file extensions to adapters.
type Registry struct {
	byExt map[string]Adapter
}

func NewRegistry() *Registry { return &Registry{byExt: map[string]Adapter{}} }

func (r *Registry) Register(a Adapter) {
	for _, ext := range a.Extensions() {
		r.byExt[strings.ToLower(ext)] = a
	}
}

func (r *Registry) ForExt(ext string) (Adapter, bool) {
	a, ok := r.byExt[strings.ToLower(ext)]
	return a, ok
}

// DefaultRegistry returns the adapters shipped today. Solidity only: the
// product direction is EVM first, with Rust/Go adapters added here later.
func DefaultRegistry() *Registry {
	r := NewRegistry()
	r.Register(Solidity{})
	return r
}
