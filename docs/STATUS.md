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

## Security/architecture review (this pass)

A focused review was done before any further feature work, per request.
Fixes made as a result — all still **unverified by me** (no Go toolchain, no
network, no display in this sandbox; see each item):

- **Auth now wraps the whole mux, not per-route.** `server.New()` used to
  wrap each route individually with `requireToken` — a future route added
  without remembering to wrap it would have been silently unauthenticated.
  Refactored so `New()` applies auth (and the new Host check, below) exactly
  once around the entire `http.ServeMux`; `routes()` registers handlers with
  no auth of their own, and gets it automatically. Locked in by two new
  tests: an unregistered path returns 401 without a token (proving auth runs
  before routing) and 404 with one.
- **Token moved from an environment variable to stdin.** A spawned process's
  env vars are readable by other processes owned by the same user (e.g.
  `/proc/<pid>/environ` on Linux) — a real, if secondary, exposure path for a
  secret whose entire purpose is restricting who can call the backend.
  `backend.ts` now writes the token to the Go process's stdin at spawn
  instead; `cmd/zequeld/main.go` reads it from there. No logging of the token
  anywhere, confirmed by re-reading both sides.
- **Host-header validation added** (`requireHost` in `auth.go`): every
  request's `Host` must exactly match `127.0.0.1:<port>`, checked before the
  token. Defense-in-depth against DNS rebinding — the bearer token already
  fully defeats that attack on its own, but this is cheap and now covered by
  a test (`TestRequest_WithWrongHost_ReturnsForbidden`).
- **Double-spawn guard**: `startBackend()` now rejects if a backend process
  is already running, instead of silently overwriting the reference and
  orphaning the old process.
- **`BackendStatus.tsx` no longer gives up.** It previously polled 10 times
  then stopped forever — meaning if the backend connected once and then
  crashed later, the UI would keep showing "connected" indefinitely. It now
  polls every 2s for the life of the window, so an unexpected backend exit
  (detected because `backendFetch` starts throwing once `backend.ts`'s exit
  handler nulls out the port/token) shows up within 2 seconds, truthfully.
- **Packaged-build binary resolution implemented** (previously: dev-only).
  `resolveBackendBinaryPath()` now branches on `app.isPackaged`, and
  `electron-builder.yml` has a matching `extraResources` entry. Full design
  and what's still unverified about it: `docs/PACKAGING.md` (new).
- **Coding/Research boundary recorded now, before either has code.** Each of
  `internal/coding`, `internal/research`, `internal/project`, `internal/index`,
  `internal/storage`, `internal/aiprovider` is a `doc.go` stating its purpose
  and one explicit rule: `coding` and `research` must never import each
  other; shared needs go through the lower-level packages. Nothing to
  decouple yet since nothing exists yet — this is the rule written down while
  it's free, not a retrofit.
- **Streaming protocol designed** (`backend/api/API.md`): SSE, one JSON object
  per `data:` line with a `type` field (`token`/`progress`/`error`/`done`),
  cancellation via closing the HTTP connection (`r.Context()`), no routes
  implemented yet — this is the contract future AI endpoints will use, not a
  working feature.
- **Confirmed, not changed:** the preload bridge (`preload.ts`) still exposes
  only `backend.health()` — no generic invoke, no way for the renderer to
  call an arbitrary backend path. Re-verified line by line, no issue found.
- **Confirmed, not changed:** no SQLite dependency has been added. `go.mod`
  still has zero requires. Explicitly deferred per instruction until storage
  requirements and a migration strategy are reviewed.
- **Explicitly NOT done this pass** (flagged as a risk, not fixed): no
  restart-on-crash policy exists if `zequeld` exits unexpectedly after
  startup — the renderer will now *show* that truthfully (see
  `BackendStatus.tsx` fix above), but nothing restarts it automatically. A
  bounded restart-with-backoff policy is a reasonable next step, deliberately
  not built in this pass to keep it to foundational fixes only.

## Implemented and tested

- `backend/internal/server`: health endpoint, auth middleware, Host-header
  middleware, and whole-mux wrapping — covered by `server_test.go`
  (`net/http/httptest`; 8 tests total after this pass). **I have not run
  `go test` myself** — no Go toolchain in this sandbox — so "tested" means "a
  real test exists and should pass," not "confirmed passing." Please run
  `go test ./...` in `backend/` and tell me the result, including the full
  `go test -v` output if anything fails.

## Implemented, not yet tested (needs you to run it)

- `apps/desktop` Electron shell: main process, sandboxed renderer, typed
  preload bridge (see `docs/SECURITY.md`).
- Opening a real folder via the native dialog, browsing its real contents,
  reading a real file's contents — through the IPC bridge, no mock data.
- Path-containment check on every filesystem IPC handler.
- The Go backend (`backend/cmd/zequeld`) with this pass's fixes applied:
  stdin token delivery, Host-header check, whole-mux auth. Written to compile
  against the Go standard library only, never actually compiled in this
  sandbox.
- The full chain — Electron spawns `zequeld`, writes the token to its stdin,
  reads its port from stdout, calls `/v1/health` through `backendFetch()`,
  and the renderer polls it continuously via `BackendStatus.tsx`.

## Partially implemented

- Writing files back to disk: the IPC handler and preload method exist, but no
  renderer UI calls them yet.
- Backend binary resolution: both dev and packaged-build code paths exist now
  (see above); packaged path has never been exercised by an actual packaged
  build (needs a real build machine per target OS — see `docs/PACKAGING.md`).

## Planned, not started

- Porting Coding Mode's editor/terminal/file explorer/git panel and Research
  Mode's trace graph from `apps/platform` into `apps/desktop/src`.
- All actual logic in `backend/internal/project`, `index`, `research`,
  `coding`, `aiprovider`, `storage` — each currently holds only a `doc.go`
  recording its purpose and the Coding/Research boundary rule. The
  code-indexing engine, research services, AI-agent orchestration, and SQLite
  storage layer all start from zero.
- Removing/rebuilding the subscription-gating logic in `apps/platform`'s
  `lib/ai/model-router.ts`/`model-service.ts` for a bring-your-own-key model.
  Real refactoring inside the AI call path, not a deletion — not started.
- A real CI packaging pipeline (design exists in `docs/PACKAGING.md`; nothing
  has actually been run).
- A bounded restart-on-crash policy for the backend process (see "explicitly
  not done this pass," above).
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md` still
  describe the old web-app architecture. Not yet rewritten.

## Blocked / needs your input

- `pnpm install` (not frozen) + `pnpm --filter @zequel/desktop dev` — still
  needed, still unverified by me (no network, no display here).
- `cd backend && go build -o bin/zequeld ./cmd/zequeld && go test ./...` —
  needs a machine with Go installed. I cannot run this here at all. Please run
  both and tell me exactly what happens, compiler errors verbatim, before I
  build further on top of this backend. This matters more than usual this
  round: the token delivery mechanism changed (stdin instead of env var), so
  if you have a way to smoke-test `pnpm --filter @zequel/desktop dev` after
  building the Go binary, that's the one thing that would catch a mismatch
  between the two sides that `go test` alone can't (the tests exercise the
  HTTP layer directly, not the actual stdin handoff from a spawned Electron
  child process).
