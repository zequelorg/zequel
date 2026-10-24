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

```bash
pnpm --filter @zequel/desktop dev
```

This starts the Vite dev server for the renderer and launches Electron
pointed at it. Closing the window stops both.

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
has no network access (can't resolve npm packages) and no display (can't
launch an actual Electron window), so `pnpm install`, `pnpm dev`, and a real
packaged build are all **unverified**. Please run the install + dev command
above and tell me what actually happens — that's real signal I don't have
yet.
