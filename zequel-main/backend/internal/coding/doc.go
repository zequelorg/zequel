// Package coding will hold Zequel Coding's services — AI-assisted editing,
// the coding agent, and whatever tool-use/execution orchestration Coding
// Mode needs.
//
// Nothing is implemented here yet (see /docs/STATUS.md). This file exists to
// record the boundary rule now, before any code exists, while it's free to
// decide:
//
//   - package coding must NOT import package research, and vice versa
//     (see internal/research/doc.go). They are separate services that may be
//     used independently — Coding without Research, or Research without
//     Coding — so neither may depend on the other's internals.
//   - Anything both features genuinely need (reading project files, the
//     symbol index, persisted state) belongs in a shared lower-level package
//     — internal/project, internal/index, internal/storage — that both
//     import, rather than one feature reaching into the other.
//   - If Coding and Research ever need to coordinate directly (e.g. "jump
//     from a Research finding into an editing session"), that coordination
//     belongs in the HTTP layer (internal/server) or a new explicit shared
//     package, decided deliberately when that need is real — not by one
//     package quietly importing the other.
package coding
