# Zequel — Implementation Status

Maintained per the project's own working rule 3.3: distinguish what's real
from what's planned. Updated as of the Electron pivot.

## The pivot

Zequel is moving from a hosted Next.js/Supabase web app (`apps/platform`,
`apps/admin`, `apps/website`) to a local-first Electron + Go desktop app:
Electron/React/TypeScript for the desktop app and UI (`apps/desktop`), Go for
the local backend (`backend/`), SQLite for structured local metadata (not
wired up yet — see below).

- `apps/admin` and `apps/website` — **deleted**. Pure web/SaaS concerns with
  no role in a local-first desktop product.
- `apps/platform` — **kept, not deleted, not deployed going forward.** The
  source we're porting real, working UI out of (Coding Mode, Research Mode)
  into the desktop renderer. Deleted once the port is complete.
- `apps/desktop` — Electron shell, in progress. See below.
- `backend/` — **new.** The Go local backend, in progress. See below.

## Implemented and tested

- `backend/internal/server`: the health endpoint and auth middleware, covered
  by `server_test.go` using `net/http/httptest` (valid token, missing token,
  wrong token, wrong method). **I have not run `go test` myself** — no Go
  toolchain in this sandbox — so "tested" here means "a real test exists and
  should pass," not "I confirmed it passes." Please run `go test ./...` in
  `backend/` and tell me the result.

## Implemented, not yet tested (needs you to run it)

- `apps/desktop` Electron shell: main process, sandboxed renderer, typed
  preload bridge (see `docs/SECURITY.md`).
- Opening a real folder via the native dialog, browsing its real contents,
  reading a real file's contents — through the IPC bridge, no mock data.
- Path-containment check on every filesystem IPC handler.
- **New:** the Go backend itself (`backend/cmd/zequeld`) — binds a loopback
  ephemeral port, requires a bearer token, serves `/v1/health`. Written to
  compile against the Go standard library only, but never actually compiled
  in this sandbox (no Go toolchain, no network). See `backend/README.md`.
- **New:** the full chain — Electron spawns `zequeld`, reads its port from
  stdout, calls `/v1/health` with the generated token through
  `backendFetch()`, and the renderer shows the real result via a status
  indicator in the header (`BackendStatus.tsx`). This is the smallest
  possible proof the Electron↔Go boundary works end to end; it is NOT yet
  wiring for anything functional.

## Partially implemented

- Writing files back to disk: the IPC handler and preload method exist, but no
  renderer UI calls them yet.
- Backend binary resolution: works for a local dev build at
  `backend/bin/zequeld`; packaged-app resolution (`extraResources`,
  cross-compilation per target OS) is not implemented.

## Planned, not started

- Porting Coding Mode's editor/terminal/file explorer/git panel and Research
  Mode's trace graph from `apps/platform` into `apps/desktop/src`.
- `backend/internal/project`, `index`, `research`, `coding`, `aiprovider`,
  `storage` — all empty directories reserved for structure, not stubbed. The
  code-indexing engine, research services, AI-agent orchestration, and SQLite
  storage layer (`modernc.org/sqlite`, chosen specifically to avoid CGO for
  cross-platform builds) all start from zero.
- Removing/rebuilding the subscription-gating logic in `apps/platform`'s
  `lib/ai/model-router.ts`/`model-service.ts` for a bring-your-own-key model.
  Real refactoring inside the AI call path, not a deletion — not started.
- Packaging and distribution (`electron-builder.yml` exists, unverified).
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md` still
  describe the old web-app architecture. Not yet rewritten.

## Blocked / needs your input

- `pnpm install` (not frozen) + `pnpm --filter @zequel/desktop dev` — still
  needed, still unverified by me (no network, no display here).
- **New:** `cd backend && go build -o bin/zequeld ./cmd/zequeld && go test ./...`
  — needs a machine with Go installed. I cannot run this here at all. Please
  run both commands and tell me exactly what happens (including any compiler
  errors verbatim) before I build further on top of this backend.
