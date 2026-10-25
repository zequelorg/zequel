# Zequel — Implementation Status

Maintained per the project's own working rule 3.3: distinguish what's real
from what's planned. Updated as of the web-app removal / frontend-port pass.

## The pivot is now complete: this is a desktop-only repository

Zequel moved from a hosted Next.js/Supabase web app to a local-first
Electron + Go desktop app. That move is now finished, not in progress:

- `apps/admin`, `apps/website`, and `apps/platform` — **all deleted**, along
  with `packages/ui`, `packages/shared`, `packages/types`, `packages/config`
  (the shared workspace packages that only those apps depended on — verified
  by grep before deletion that nothing in `apps/desktop` or the root config
  referenced them). `scripts/` (Supabase SQL schema/seed files, a Daytona
  column-removal migration) deleted too — all Supabase/web-app tooling with
  no role in a local-first desktop product. `docs/ARCHITECTURE.md`,
  `docs/DEPLOYMENT.md`, `docs/DEVELOPMENT.md` deleted — they described the
  three-app Vercel/Supabase deployment, which no longer exists; `docs/STATUS.md`
  (this file), `docs/SECURITY.md`, `docs/PACKAGING.md`, and
  `backend/api/API.md` are the current architecture docs. Root `README.md`,
  `package.json`, and `turbo.json` rewritten to match — no more
  `dev:platform`/`build:platform` scripts, no more Supabase/Vercel env vars
  in `turbo.json`'s `globalEnv`.
- `apps/desktop` — the only app in this repository now. Electron + React +
  TypeScript. See below for what's actually in it.
- `backend/` — the Go local backend. See below — this pass includes the
  first **real, run, verified** results for it (not just written code).

Before deleting `apps/platform`, its two working UI pieces (the themed code
editor, the Research trace graph) were ported into `apps/desktop/src` first
— not lost, not left behind. What was **not** ported is listed honestly
under "Planned, not started," not silently dropped.

## Go backend: actually built, tested, and smoke-tested this pass

Every previous pass of this project said some version of "I have not run
this — no Go toolchain in this sandbox." That was true until this pass. The
sandbox changed: Go 1.22+ (actually 1.24.7) is now present, and I ran these
myself, in this environment, for real:

```
cd backend
go build -o bin/zequeld ./cmd/zequeld   # → succeeded
go vet ./...                            # → no issues
go test ./... -v                        # → all 8 tests in internal/server PASS
```

And then an actual live smoke test — not a reasoned-about design, a real
process hit with real `curl` requests:

```
echo "dev-token" | ./bin/zequeld &
curl -H "Authorization: Bearer dev-token" http://127.0.0.1:<port>/v1/health
# → 200 {"status":"ok","version":"0.1.0"}
curl -H "Authorization: Bearer dev-token" -H "Host: evil.example:<port>" .../v1/health
# → 403 "unexpected host"
curl .../v1/health   (no Authorization header)
# → 401 "missing bearer token"
```

This confirms, with actual evidence rather than code review alone: the
stdin token handoff works, port discovery via stdout works, the health
route works, the Host-header check correctly rejects a mismatched Host, and
a missing token is correctly rejected. Full detail in `backend/README.md`.

**Still not verified:** the real Electron-side half of the stdin handoff
(`backend.ts` actually spawning this binary and piping a token to it from
Node, not from a shell `echo`) — that needs `pnpm --filter @zequel/desktop
dev`, which needs `pnpm install` first, which needs the npm registry. See
next section for why that still can't run here.

## JS/Electron side: still cannot run in this sandbox (tried for real this pass)

This pass actually attempted it rather than assuming — `npm install` in
`apps/desktop`, both unmodified and explicitly routed through this session's
own HTTP egress proxy with its CA bundle, both failed identically:
`ENOTFOUND registry.npmjs.org`. So, still genuinely blocked, not just
assumed blocked: `pnpm install`, `pnpm --filter @zequel/desktop dev`,
`tsc --noEmit`, and any Tailwind/Vite build have **not** been run by me.
Everything under "Coding/Research UI port" below is written and
internally reviewed, not compiled or rendered.

## Coding/Research UI port (this pass, written, not yet compiled/run)

- **Research trace graph** — ported into `apps/desktop/src/components/research/`
  (`graph-canvas.tsx`, `graph-sidebar.tsx`, `graph-view.tsx`) and
  `apps/desktop/src/lib/research/` (`graph-types.ts`, `graph-fixture.ts`).
  Pan/zoom/drag, node select, inflow/outflow filter, "flagged only" toggle —
  all ported unchanged from the working web-app version. The fixture data
  itself was **rewritten**, not just copied: the old fixture traced
  `apps/platform/lib/coding/runtime.ts`, which no longer exists now that
  `apps/platform` is deleted. The new fixture traces this repo's own current
  Go backend instead (`server.New()`, its two real callers, its two
  middleware wraps, its route table, its test file, and two real open gaps
  — no SQLite caller yet, no restart-on-crash policy — flagged at `info`/
  `warning` severity same as the design intends for a real indexer's output).
- **Code editor** — ported into `apps/desktop/src/components/CodeEditor.tsx`.
  Same CodeMirror 6 setup, same CSS-custom-property theming
  (`--code-bg`/`--code-fg`/etc., now defined in `apps/desktop/src/index.css`),
  same syntax-highlight token mapping. Simplified in one way: the original
  read cursor position from a Zustand store (`useCodingIdeStore`) that only
  ever existed in the deleted web app; the ported version takes an optional
  `onCursorChange` callback prop instead, since `apps/desktop` has no global
  state store yet. Wired into `App.tsx` with real save-to-disk: editing a
  file shows a dirty-state dot, Ctrl/Cmd+S or the Save button calls the
  existing `writeFile` IPC handler, and the Save button is disabled when
  there's nothing to save.
- **Mode switcher** — a real Coding/Research toggle in the header, added to
  `App.tsx`. Research mode renders the graph view full-width; Coding mode
  renders the existing file tree + the now-real editor (previously a
  read-only `<pre>` of file contents).
- **Tailwind v4 added to `apps/desktop`** — it had none before this pass
  (plain hand-written CSS only). `postcss.config.mjs`, the `@theme inline`
  token mapping and full dark color/code-syntax token set in `index.css`
  (ported from the web app's `.dark` theme — this app has no light mode,
  it's a desktop app, not a web app with a system-preference audience), a
  `@` → `src` path alias in both `vite.config.ts` (for the actual bundler)
  and `tsconfig.json` (for type-checking) so the ported components' `@/lib/...`
  import style didn't need rewriting. New dependencies added to
  `package.json`: `tailwindcss`, `@tailwindcss/postcss`, the CodeMirror
  language packages, `lucide-react`, `clsx`, `tailwind-merge` — none of
  these are in `pnpm-lock.yaml` yet, for the network reason above.

## Implemented and tested (Go)

- `backend/internal/server`: health endpoint, auth middleware, Host-header
  middleware, whole-mux wrapping — `server_test.go`, 8 tests, **actually run
  this pass, all passing** (see above). Also smoke-tested live, not just
  via `httptest`.

## Implemented, written but not yet compiled/run (TypeScript/React)

- `apps/desktop` Electron shell: main process, sandboxed renderer, typed
  preload bridge (see `docs/SECURITY.md`).
- Opening a real folder, browsing it, opening a file, **editing and saving
  it** — all through the IPC bridge, no mock data, no more read-only `<pre>`.
- Path-containment check on every filesystem IPC handler.
- The Research trace-graph view and the Coding/Research mode switcher
  (new this pass — see above).
- The full Electron↔Go chain: spawn, stdin token write, stdout port read,
  `/v1/health` call, continuous health polling in the header.

## Partially implemented

- Backend binary resolution: both dev and packaged-build code paths exist;
  packaged path has never been exercised by an actual packaged build (needs
  a real build machine per target OS — see `docs/PACKAGING.md`).

## Planned, not started

- The integrated terminal, git panel, search panel, and AI assistant panel
  that existed in the old web app's Coding Mode. Not ported — this is the
  editor and file browser, not yet the full IDE. (`coding-terminal.tsx`,
  `coding-git-panel.tsx`, `coding-search-panel.tsx`,
  `coding-assistant-panel.tsx` existed in the now-deleted `apps/platform`;
  none of their logic survives anywhere in this repo. Porting them means
  rewriting against this app's IPC bridge, not a copy-paste — there was no
  AI-provider or terminal backend in `apps/desktop` for them to call.)
- All actual logic in `backend/internal/project`, `index`, `research`,
  `coding`, `aiprovider`, `storage` — each currently holds only a `doc.go`
  recording its purpose and the Coding/Research boundary rule. The
  code-indexing engine (what would replace the Research graph's fixture),
  research services, AI-agent orchestration, and SQLite storage layer all
  start from zero.
- A bring-your-own-key AI provider model. The old web app's subscription-
  gated model router (`lib/ai/model-router.ts`) is gone along with
  `apps/platform` — this needs building fresh against `internal/aiprovider`,
  not ported, since the old design was subscription-shaped and this
  project explicitly isn't.
- A real CI packaging pipeline (design exists in `docs/PACKAGING.md`;
  nothing has actually been run).
- A bounded restart-on-crash policy for the backend process if `zequeld`
  exits unexpectedly after startup.

## Blocked / needs your input

- `pnpm install` (not frozen) + `pnpm --filter @zequel/desktop dev` — tried
  by me this pass (both plain and proxy-routed), genuinely blocked by DNS
  resolution for `registry.npmjs.org` in this sandbox, not just assumed
  blocked. This is now the single biggest gap: it would verify the Tailwind
  build, the CodeMirror editor actually rendering, the ported Research
  graph actually rendering, and the real (not shell-piped) Electron→Go
  stdin token handoff, all at once. Please run it and tell me what happens,
  errors included.
- `cd backend && go build/test` — **no longer blocked, already run by me
  this pass with results above.** If you also have Go locally, re-running it
  is still worth doing as a second, independent confirmation, but it is not
  the priority gap anymore — the JS/Electron side above is.
