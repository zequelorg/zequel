# Zequel Desktop

The local-first Electron application. This replaces the hosted web app as
Zequel's primary product (see `docs/ARCHITECTURE.md` and `docs/STATUS.md` at
the repo root for the full picture and what's ported vs. still to do).

## Setup (required once, needs network)

This workspace member was added with its dependencies declared in
`package.json`, but **not yet resolved into `pnpm-lock.yaml`** — that requires
reaching the npm registry, which wasn't available while this was written.
Before anything else:

```bash
pnpm install   # NOT --frozen-lockfile — this run needs to resolve and add
               # the new @zequel/desktop dependencies to the lockfile.
```

After that one-time install, the lockfile will be complete and frozen
installs work normally again.

## Running it

The Go backend needs to be built once first — see `/backend/README.md`:

```bash
cd backend && go build -o bin/zequeld ./cmd/zequeld && cd ..
```

Then:

```bash
pnpm --filter @zequel/desktop dev
```

This starts the Vite dev server for the renderer and launches Electron
pointed at it, which in turn spawns the Go backend (see
`electron/backend.ts`). If the backend binary isn't built yet, Electron logs
an error and the window still opens — the header's backend status indicator
will show "unreachable" rather than the app silently pretending to work.
Closing the window stops both processes.

## What's real right now

- A secure Electron shell: `contextIsolation`, no `nodeIntegration`, sandboxed
  renderer, a narrow typed preload bridge (`electron/preload.ts`) — the
  renderer has exactly the API surface in that file and nothing else.
- Opening a real folder via the native OS dialog, browsing its real contents,
  and reading a real file's contents, all through that bridge. Every
  filesystem IPC handler in `electron/main.ts` re-validates the requested path
  against the opened project root before touching disk.
- `docs/SECURITY.md` documents this boundary — read it before adding any new
  IPC handler.
- A real Go backend process (`backend/`), spawned and health-checked by
  Electron, reachable only from the main process (never the renderer
  directly) over a loopback HTTP connection with a per-launch bearer token.
  Right now it does exactly one thing — answer `/v1/health` — and the header
  shows the real, live result of that call, not a mock.

## What's NOT here yet (so don't assume it works)

- Coding Mode's actual editor/terminal/git UI — built and working in
  `apps/platform` during this project's web-app phase, not yet ported to this
  renderer. That's the next milestone.
- Research Mode's trace graph — also built in `apps/platform`
  (`components/workspace/research/`), not yet ported.
- Writing files back to disk through the UI (the IPC handler exists and is
  wired in `preload.ts`, but no renderer UI calls it yet).
- AI provider calls of any kind. Nothing in this app talks to an AI model yet.
- Packaging/distribution (`electron-builder.yml` exists but has not been run).

## I have not run this

Everything above was written and reviewed for correctness, but this sandbox
has no network access (can't resolve npm packages, can't fetch Go even if I
wanted to) and no display (can't launch an actual Electron window). Neither
`pnpm install`/`pnpm dev` nor `go build`/`go test` in `backend/` have been run
by me — all **unverified**, the Go side more so, since Go is compiled and
hand-written Go is more likely to have a small mistake a compiler would catch
instantly. Please run both (see `/backend/README.md` for the Go commands) and
tell me exactly what happens, errors included — that's real signal I don't
have yet.
