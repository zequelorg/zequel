# Zequel Roadmap — Blockchain Development & Research

Zequel is an open-source, AI-powered desktop environment for blockchain
development and technical research. Preserve the Electron + React/TypeScript +
Go foundation. Build EVM/Solidity first; keep the architecture open to
Rust-based chains and Go-based protocols without a rewrite. Do not build every
ecosystem at once: working features, incrementally, expanded through modules.

## Architecture rule: ecosystems are modules

| Concern | Extension point | EVM/Solidity (now) |
| --- | --- | --- |
| Project detection | marker table in `internal/project` | foundry.toml, hardhat.config.* |
| Code understanding | `index.Adapter` + `Registry` | `solidity.go` |
| Findings | emitted by adapters as `Finding` | 6 heuristic rules |
| Tooling (build/test/debug) | tool modules (planned `internal/tools`) | forge / hardhat runners |
| UI | consumes generic `TraceGraph`, symbols, findings | graph view |

Adding Rust (Cargo, Anchor) or Go (go.mod) means a new adapter and tool module
registered alongside Solidity; the engine, HTTP contract and UI do not change.
`internal/coding` and `internal/research` never import each other; both use
`project`, `index`, `storage`, `aiprovider`.

## Zequel Research

- [x] Index a Solidity project; contracts, functions, inheritance, calls
- [x] Reference trace graph from real index data (contract- and function-level)
- [x] Heuristic security findings surfaced on graph nodes
- [x] Findings panel with source jump-to-line (evidence snippets still open)
- [ ] Import-aware name resolution; solc AST adapter for precision
- [ ] Storage-layout and external-call/trust-boundary views
- [ ] Evidence-linked report generation (every claim cites file:line)
- [ ] Go/Rust protocol adapters (module graph, call graph)

## Zequel Coding

- [x] Editor, tabs, Quick Open, save (existing)
- [ ] Foundry runner: `forge build/test` with parsed diagnostics in a panel
- [ ] Hardhat runner, same panel
- [ ] Integrated terminal and git panel (rewrite against the IPC bridge)
- [ ] BYO-key AI provider layer with OS-keychain storage (`internal/aiprovider`)
- [ ] Repo-aware agent: plan → multi-file edit → run tests → explain, with an
      explicit permission model per tool (read vs edit vs execute)
- [ ] Debugging (forge traces), gas reports, fuzz/invariant result views

## Ordering rationale

1. Verify the foundation actually builds and runs (Go tests, `pnpm install`,
   first Electron launch, first CI run). Nothing else is trustworthy before it.
2. Make the EVM index correct and useful (findings panel, import resolution).
3. Add execution (Foundry/Hardhat runners) — prerequisite for any agent that
   runs tests.
4. Add AI last, on top of real tools and a real index, so it is grounded in
   repository facts rather than prompts.
