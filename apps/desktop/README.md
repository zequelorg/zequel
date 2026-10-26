# Zequel Desktop

The local-first Electron application — Zequel's only product now. The old
hosted web app (`apps/platform`) and the shared packages that only it used
have been deleted from this repository entirely, not just deprecated; see
`docs/STATUS.md` at the repo root for the full picture of what's ported vs.
still to do, and the root `README.md` for why.

## Setup (required once, needs network)

This workspace member's dependencies are declared in `package.json`, but
**not yet resolved into `pnpm-lock.yaml`** — that requires reaching the npm
registry, which has not been reachable from the sandbox this was written in
(confirmed directly: both plain `npm install` and `npm install` pointed
explicitly at this session's HTTP proxy failed with `ENOTFOUND
registry.npmjs.org`). Before anything else, on a machine with real network
access:

```bash
pnpm install   # NOT --frozen-lockfile — this run needs to resolve and add
               # @zequel/desktop's dependencies (including the newly added
               # Tailwind v4, CodeMirror, and lucide-react/clsx/tailwind-merge
               # packages) to the lockfile.
```

After that one-time install, the lockfile will be complete and frozen
installs work normally again.

## Running it

The Go backend needs to be built once first — see `/backend/README.md`. In
this pass, for the first time, a Go toolchain was actually available in the
sandbox, so this step has genuinely been run and verified, not just written:

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
  `docs/SECURITY.md` documents this boundary — read it before adding any new
  IPC handler.
- Opening a real folder via the native OS dialog, browsing its real contents,
  reading a real file's contents, editing it in a themed CodeMirror editor
  (`src/components/CodeEditor.tsx`, ported from the old web app's editor —
  same CSS-custom-property theming approach, same syntax-highlight token
  mapping), and **saving it back to disk** through the bridge (Ctrl/Cmd+S or
  the Save button in the editor tab; the dirty-state dot and disabled-when-
  clean Save button are real, not decorative).
- A Research mode with a trace-graph view (`src/components/research/`)
  — pan/zoom/select/filter/toggle — now fed by the Go indexer
  (`backend/internal/index`): it indexes the open Solidity project, lets you
  pick a root contract or function, and renders real inheritance/call
  relationships with heuristic findings. Written but not yet compiled or run;
  see `docs/STATUS.md`.
- A Coding/Research mode switcher in the header.
- A VS Code-benchmark IDE shell: an Activity Bar, multiple files open as
  tabs at once (each independently dirty-tracked), file-type icons shared
  across the tree/tabs/Quick Open, a Status Bar, and — new this pass — Quick
  Open (Cmd/Ctrl+P: fuzzy-filter every file in the project and jump to it,
  backed by a real recursive-listing IPC handler, not a mock list) and a
  draggable Side Bar width. Full detail and the one honest limitation (Quick
  Open's file list is a snapshot, not a live watch) in `docs/STATUS.md`.
- A real Go backend process (`backend/`), spawned and health-checked by
  Electron, reachable only from the main process (never the renderer
  directly) over a loopback HTTP connection with a per-launch bearer token
  delivered over stdin. Right now it does exactly one thing — answer
  `/v1/health` — and the header shows the real, live result of that call,
  not a mock. See `backend/README.md` for the real build/test/smoke-test
  results from this pass.

## What's NOT here yet (so don't assume it works)

- The integrated terminal, git panel, search panel, and AI assistant panel
  that existed in the old web app's Coding Mode — not ported. This is the
  editor and file browser, not yet the full IDE.
- AI provider calls of any kind. Nothing in this app talks to an AI model yet.
- A live code-indexing engine behind the Research graph — it's still reading
  a hand-traced fixture, described honestly above, not a real indexer.
- Packaging/distribution (`electron-builder.yml` exists but has not been run;
  `docs/PACKAGING.md` has the design).

## I have not run the JS/Electron side of this

The Go backend has genuinely been built, tested, and smoke-tested in this
pass (see `backend/README.md`) — that part of "I have not run this" is no
longer true. What's still unverified: `pnpm install`/`pnpm dev` for this
Electron+React workspace, because this sandbox cannot reach the npm
registry (tried directly, and tried again routed through the session's own
HTTP proxy — both failed the same way). Neither the Tailwind build, the
CodeMirror editor, nor the ported Research graph have been compiled or
rendered by me. Please run `pnpm install && pnpm --filter @zequel/desktop dev`
and tell me exactly what happens, errors included — that's real signal I
don't have yet, especially for anything Tailwind-v4-specific (its `@theme
inline` CSS syntax in `src/index.css` is copied from a config that worked in
the old web app, but has not been run standalone before).
