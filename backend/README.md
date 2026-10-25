# Zequel Backend (Go)

The local backend daemon (`zequeld`), spawned and supervised by Electron's
main process. See `/docs/STATUS.md` at the repo root for what's actually
implemented vs. planned, and `api/API.md` for the HTTP contract.

## This has actually been built, tested, and run

Earlier passes of this project were written in a sandbox with no Go
toolchain, so this used to say "unverified — I have not run this." That
sandbox changed: Go 1.22+ is now available here, and in this pass I actually
ran, myself, in this environment:

```
go build -o bin/zequeld ./cmd/zequeld   # succeeded
go vet ./...                            # no issues
go test ./... -v                        # all 8 tests in internal/server pass
```

...and then an actual end-to-end smoke test of the full request path,
piping a token to a real running `zequeld` process over stdin and hitting it
with `curl`:

```
echo "dev-token" | ./bin/zequeld &
curl -H "Authorization: Bearer dev-token" http://127.0.0.1:<port>/v1/health
# → {"status":"ok","version":"0.1.0"}
curl -H "Authorization: Bearer dev-token" -H "Host: evil.example:<port>" http://127.0.0.1:<port>/v1/health
# → 403 "unexpected host"
curl http://127.0.0.1:<port>/v1/health
# → 401 "missing bearer token"
```

That confirms the stdin token handoff, port discovery via stdout, the
health route, the Host-header check, and the missing-token rejection all
work for real — not just "should work by inspection." What's still
unverified: the actual Electron side of the handoff (`backend.ts` spawning
this exact binary and piping its token) — that still needs
`pnpm --filter @zequel/desktop dev` on a machine with network access to
npm's registry, which this sandbox does not have (see
`apps/desktop/README.md`).

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

`internal/server/server_test.go` covers the health endpoint, the auth
middleware (valid token, missing token, wrong token, wrong HTTP method), the
Host-header check, and that auth/host-checking wraps the whole mux (not just
known routes) — using only `net/http/httptest`, no network, no real process
spawn needed to run these.

## Run standalone (without Electron)

The daemon refuses to start without a token, by design (see
`internal/server/auth.go`). It reads the token as one line from **stdin**,
not an environment variable (env vars of a running process are readable by
other processes owned by the same user, which would partly defeat requiring a
token at all — see the comment at the top of `cmd/zequeld/main.go`). To run
it manually for debugging:

```bash
echo "dev-token" | ./bin/zequeld
```

It will print `ZEQUEL_BACKEND_PORT=<port>` to stdout, then you can hit it
directly — including the Host header, which also has to match exactly or
you'll get `403`:

```bash
curl -H "Authorization: Bearer dev-token" http://127.0.0.1:<port>/v1/health
```

(`curl` sets the `Host` header to `127.0.0.1:<port>` automatically from the
URL, so this works as-is — just don't use `localhost` in place of
`127.0.0.1`, which would fail the Host check.)

## How Electron finds this binary

`apps/desktop/electron/backend.ts`'s `resolveBackendBinaryPath()` branches on
whether the app is packaged: dev mode looks for `backend/bin/zequeld`
relative to the repo root; a packaged build looks under
`process.resourcesPath`. If the binary isn't found, Electron logs an error
and starts the window anyway — the renderer's backend status indicator will
show "unreachable" instead of the app crashing.

Full packaging design (CI matrix, `extraResources` wiring, what's still
unverified) is in `/docs/PACKAGING.md` — the short version: the packaged path
is wired into `electron-builder.yml` but has never actually been exercised by
a real packaged build.

## What's here vs. what's next

Implemented: the HTTP server, auth + Host-header middleware (wrapping the
whole mux, not per-route — see the comment on `server.New` in
`internal/server/server.go`), one endpoint (`/v1/health`), and the Electron
spawn/health-check/shutdown lifecycle around it, including stdin-based token
delivery and dev-vs-packaged binary resolution. That's it — `internal/project`,
`internal/index`, `internal/research`, `internal/coding`, `internal/aiprovider`,
and `internal/storage` each contain only a `doc.go` recording their intended
purpose and the Coding/Research boundary rule (see that file in each
directory) — no actual logic yet. Nothing in this repo should claim otherwise.
