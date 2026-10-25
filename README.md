# Zequel — Local-First Desktop AI Development & Research Environment

**Organization:** Absalex Labs · **License:** Proprietary

Zequel is a desktop application: Electron + React + TypeScript for the
application shell and UI, a Go local backend for indexing, research, and
AI-agent orchestration, and the local filesystem as the source of truth for
project files. There is no web app, hosted service, or Supabase dependency
in this repository — that earlier direction was fully retired. See
`docs/STATUS.md` for exactly what's implemented versus planned; this README
describes the shape of the project, not a claim that every piece exists yet.

## Repository layout

```
zequel/
├── apps/
│   └── desktop/      Electron shell + React renderer  (@zequel/desktop)
├── backend/          Go local backend daemon (zequeld), spawned by Electron
├── docs/             Architecture, security, packaging, and status docs
└── pnpm-workspace.yaml / turbo.json
```

There is no `packages/` directory and no other `apps/*`. The former
`apps/platform` (Next.js/Supabase web app), `apps/admin`, `apps/website`,
and the `packages/ui` / `packages/shared` / `packages/types` / `packages/config`
workspace packages that only they depended on have all been deleted — they
had no role in a local-first desktop product. Where useful, working UI
(the Research trace graph, the themed code editor) was ported out of the old
web app into `apps/desktop` before that code was removed; what was and
wasn't ported is tracked honestly in `docs/STATUS.md`, not assumed.

## Quick start

Requires **Node 20+**, **pnpm 9+**, and **Go 1.22+** (for the backend).

```bash
# 1. Install JS/TS workspace dependencies
pnpm install

# 2. Build the Go backend once (apps/desktop looks for this binary in dev)
cd backend && go build -o bin/zequeld ./cmd/zequeld && cd ..

# 3. Run the desktop app (Vite dev server + Electron together)
pnpm dev:desktop
```

See `backend/README.md` for running/testing the Go backend on its own, and
`apps/desktop/README.md` for the Electron shell specifically.

## Common scripts (run from the repo root)

| Command | Description |
| --- | --- |
| `pnpm dev:desktop` | Run the desktop app (Vite + Electron) |
| `pnpm build:desktop` | Build the desktop app's renderer + main process |
| `pnpm type-check` | Type-check the workspace (`tsc --noEmit`) |
| `pnpm lint` | Lint the workspace |
| `pnpm clean` | Remove build artifacts and `node_modules` |

## Tech stack

- **Shell/UI:** Electron, React 19, TypeScript, Tailwind CSS v4, CodeMirror 6
- **Local backend:** Go (standard library only so far — see `backend/README.md`)
- **Local metadata:** SQLite (not wired up yet — deliberately deferred, see `docs/STATUS.md`)
- **Tooling:** pnpm workspaces + Turborepo

## Documentation

- [`docs/STATUS.md`](docs/STATUS.md) — what's actually implemented vs. planned, kept current every pass
- [`docs/SECURITY.md`](docs/SECURITY.md) — the Electron↔Go security boundary
- [`docs/PACKAGING.md`](docs/PACKAGING.md) — cross-platform build/packaging design
- [`.github/workflows/build.yml`](.github/workflows/build.yml) — the actual CI workflow: tests, then packages Windows/macOS (Apple Silicon + Intel)/Linux builds on every push — written but not yet run for real, see `docs/STATUS.md`
- [`backend/api/API.md`](backend/api/API.md) — the Go backend's HTTP contract
- [`docs/LEGACY-TECHNICAL-REFERENCE.md`](docs/LEGACY-TECHNICAL-REFERENCE.md) — reference material from the original web-app design (historical; the web app itself no longer exists in this repo)
- [`MIGRATION-REPORT.md`](MIGRATION-REPORT.md) — record of the original monolith → monorepo migration (historical)

---

*Maintained by Absalex Labs. All rights reserved.*
