// Package storage will hold the structured local-metadata storage layer.
//
// Deliberately empty beyond this comment right now. Per explicit direction
// (see /docs/STATUS.md), no SQLite dependency is added until storage
// requirements and a migration strategy have actually been reviewed — this
// file exists to reserve the package's place in the boundary design (shared
// by internal/coding and internal/research, same rule as internal/project
// and internal/index), not to pre-commit to a schema or driver before that
// review happens. When it's added, modernc.org/sqlite is the leading
// candidate specifically because it has no CGO dependency, which keeps cross-
// platform builds simple (see /docs/PACKAGING.md) — but that choice is still
// pending the actual review, not final.
package storage
