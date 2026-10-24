# Zequel Desktop — Security Model

## The boundary

The renderer (everything in `apps/desktop/src`) is untrusted by design — it
renders AI output, and AI output should never be assumed safe to execute with
privilege. Every operation that touches the filesystem, spawns a process, or
does anything else privileged happens in the Electron **main process**
(`apps/desktop/electron/main.ts`), never in the renderer.

Three `webPreferences` settings in `main.ts` are the whole model:

- `contextIsolation: true` — the renderer's JavaScript context is isolated
  from the preload script's. A compromised web page cannot reach into preload
  internals.
- `nodeIntegration: false` — the renderer has no Node.js globals
  (`require`, `process`, `fs`, etc.) at all.
- `sandbox: true` — the renderer process runs in an OS-level sandbox.

Do not change any of these three without updating this document and
re-reviewing every exposure in `preload.ts`.

## The preload bridge

`apps/desktop/electron/preload.ts` is the **entire** API surface the renderer
has. It exposes a small, named, typed set of methods via
`contextBridge.exposeInMainWorld`— not a generic `ipcRenderer.invoke` passthrough.
If you can read `preload.ts` top to bottom, you have read the complete list of
things the renderer can ask the main process to do. Keep it that way: adding a
capability means adding a named channel to `ipc-contract.ts`, a handler in
`main.ts`, and a typed method in `preload.ts` — never a generic
"invoke any channel" escape hatch.

## Project root containment

The renderer never has raw filesystem access, even through the bridge. It can:

1. Ask the user to pick a folder via the native OS dialog
   (`project.openFolderDialog()`), which only the user, not the renderer,
   actually drives.
2. After that, read/write paths **relative to that folder only**.

Every filesystem IPC handler (`PROJECT_READ_DIRECTORY`, `PROJECT_READ_FILE`,
`PROJECT_WRITE_FILE`) calls `assertWithinProjectRoot()` in `main.ts`, which
resolves the requested relative path against the opened root and rejects
anything that resolves outside it (`../../etc/passwd`, an absolute path
elsewhere, a symlink escape via a naive string check, etc. — the check works
on the fully resolved path, not the raw string). This means that even if the
renderer were fully compromised — e.g. by a dependency, or by rendering AI
output containing a script — it still cannot read or write anywhere outside
the one folder the user explicitly opened.

## External navigation

`main.ts` intercepts both `window.open` targets and in-page navigation
(`will-navigate`). Anything that isn't the app's own dev server (in
development) or its own bundled `dist/index.html` (in production) is sent to
the user's real default browser via `shell.openExternal`, never loaded inside
the privileged Electron window. This stops a malicious link — including one
an AI response might render — from navigating the app itself to an attacker
page with access to the preload bridge.

## Content-Security-Policy

`index.html` sets a CSP that only allows scripts from the app's own origin
(`script-src 'self'`) — no remote scripts, no `unsafe-eval`. `connect-src
'self'` is deliberately restrictive for now; it will need loosening on a
per-provider basis once AI provider calls are added (see
`docs/AI-PROVIDERS.md`, not yet written), and that loosening should be scoped
to exactly the providers configured, not opened broadly.

## What this does NOT cover yet

- AI provider API keys: no secure-credential-storage integration exists yet
  (the product spec calls for OS keychain integration). Until that lands, do
  not wire in real API keys through this app.
- Code execution / terminal / agent tool-use: none of this exists in
  `apps/desktop` yet. When it's built, every executable action an AI agent can
  take needs its own explicit permission model — "the agent can read this
  project" does not imply "the agent can run arbitrary shell commands."
- Auto-update: not implemented. Don't assume packaged builds can self-update.

Treat every item above as a hard requirement to design before building the
corresponding feature, not an afterthought to bolt on once something "works."
