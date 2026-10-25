// Package research will hold Zequel Research's services — codebase
// indexing coordination, the reference/trace graph, and AI-backed
// investigation over a project.
//
// Nothing is implemented here yet (see /docs/STATUS.md). See
// internal/coding/doc.go for the boundary rule this package follows:
// research must NOT import coding, and vice versa. Shared infrastructure
// (project state, the symbol index, storage) lives in its own package that
// both import.
package research
