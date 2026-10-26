// Package index is the code-indexing engine: filesystem scanning, symbol
// extraction through per-language adapters, reference resolution, heuristic
// findings, and the graph queries Research's trace view reads from.
//
// Shared infrastructure — internal/coding may use it too (e.g. "find
// references" while editing) without research depending on coding or vice
// versa (see internal/coding/doc.go).
//
// # Adding an ecosystem
//
// The engine is language-agnostic; everything language-specific lives behind
// the Adapter interface (adapter.go). An adapter turns one source file into a
// FileResult: symbols it declares, raw (unresolved) references it makes, and
// findings. The engine resolves raw references against the whole project.
// Solidity (solidity.go) is the first adapter. A Rust or Go adapter is a new
// file implementing Adapter plus one Register call in DefaultRegistry — no
// change to the engine, the server, or the UI contract.
//
// # Honest limits of the Solidity adapter
//
// It is a tolerant token-level parser, not a compiler front end. It does not
// type-check, does not resolve imports by path (contract names are resolved
// project-wide, same-file first), does not know the types of function
// parameters or locals, and its findings are heuristics. Where precision
// matters it should be replaced by solc's AST output behind the same Adapter
// interface; nothing above this package would need to change.
package index
