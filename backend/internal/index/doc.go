// Package index will hold the code-indexing engine: filesystem scanning,
// symbol extraction, and the reference graph Research's trace graph reads
// from. Shared infrastructure — internal/coding may use it too (e.g. for
// "find references" while editing) without research depending on coding or
// vice versa (see internal/coding/doc.go).
//
// Nothing is implemented here yet (see /docs/STATUS.md).
package index
