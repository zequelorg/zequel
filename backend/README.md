# Zequel Backend (Go)

The local backend daemon (`zequeld`), spawned and supervised by Electron's
main process. See `/docs/STATUS.md` at the repo root for what's actually
implemented vs. planned, and `api/API.md` for the HTTP contract.

## I have not run this

This was written in a sandbox with no Go toolchain and no network access, so
unlike the rest of this project up to this point, **none of this Go code has
been compiled, let alone run.** It's written carefully and deliberately kept
to the Go standard library only for this first slice (no external
dependencies, so `go build` needs no network once you have Go installed) —
but please treat "unverified" as the literal state until you've run the steps
below and told me the result.

## Prerequisites

- Go 1.22 or later (`go version` to check)

## Build

```bash
cd backend
go build -o bin/zequeld ./cmd/zequeld
```

This should produce `backend/bin/zequeld` (or `zequeld.exe` on Windows). No
network access is needed for this build — the module has zero external
dependencies right now.

## Test

```bash
cd backend
go test ./...
```

`internal/server/server_test.go` covers the health endpoint and the auth
middleware (valid token, missing token, wrong token, wrong HTTP method) using
only `net/http/httptest` — no network, no real process spawn needed to run
these.

## Run standalone (without Electron)

The daemon refuses to start without a token, by design (see
`internal/server/auth.go`). To run it manually for debugging:

```bash
ZEQUEL_BACKEND_TOKEN=dev-token ./bin/zequeld
```

It will print `ZEQUEL_BACKEND_PORT=<port>` to stdout, then you can hit it
directly:

```bash
curl -H "Authorization: Bearer dev-token" http://127.0.0.1:<port>/v1/health
```

## How Electron finds this binary

Right now, dev-mode only: `apps/desktop/electron/backend.ts` looks for the
built binary at `backend/bin/zequeld` relative to the repo root. If it's not
there, Electron logs an error and starts the window anyway — the renderer's
backend status indicator will show "unreachable" instead of the app crashing.

**Not implemented yet:** resolving this binary inside a packaged
`.app`/`.exe` build (needs `extraResources` wiring in
`apps/desktop/electron-builder.yml` plus a per-platform build step that cross-
compiles `zequeld` for the target OS before packaging). Tracked in
`/docs/STATUS.md`.

## What's here vs. what's next

Implemented in this slice: the HTTP server, the auth middleware, one
endpoint (`/v1/health`), and the Electron spawn/health-check/shutdown
lifecycle around it. That's it — `internal/project`, `internal/index`,
`internal/research`, `internal/coding`, `internal/aiprovider`, and
`internal/storage` are empty directories reserved for the next incremental
steps, not stubbed-out fake implementations. Nothing in this repo should
claim they exist yet.
