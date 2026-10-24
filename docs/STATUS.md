# Zequel — Implementation Status

Maintained per the project's own working rule 3.3: distinguish what's real
from what's planned. Updated as of the Electron pivot.

## The pivot

Zequel is moving from a hosted Next.js/Supabase web app (`apps/platform`,
`apps/admin`, `apps/website`) to a local-first Electron desktop app
(`apps/desktop`).

- `apps/admin` and `apps/website` — **deleted**. Pure web/SaaS concerns
  (internal support dashboard, marketing site) with no role in a local-first
  desktop product.
- `apps/platform` — **kept, not deleted, not deployed going forward.** It is
  the source we are porting real, working UI out of (Coding Mode, Research
  Mode) into the desktop renderer. Deleting it now would throw away that work
  before it's been moved. It gets deleted once the port is complete.
- `apps/desktop` — **new, in progress.** See below.

## Implemented and tested

Nothing in `apps/desktop` yet. This sandbox has no network (can't resolve npm
packages) and no display (can't launch an Electron window), so nothing here
has been run, only written and reviewed.

## Implemented, not yet tested (needs you to run it)

- `apps/desktop` Electron shell: main process, sandboxed renderer, typed
  preload bridge (see `docs/SECURITY.md`).
- Opening a real folder via the native dialog, browsing its real contents,
  reading a real file's contents — through the IPC bridge, no mock data.
- Path-containment check on every filesystem IPC handler (requests outside the
  opened project root are refused).

## Partially implemented

- Writing files back to disk: the IPC handler and preload method exist, but no
  renderer UI calls them yet.

## Planned, not started

- Porting Coding Mode's editor/terminal/file explorer/git panel from
  `apps/platform/components/workspace/coding/` into `apps/desktop/src`.
- Porting Research Mode's trace graph (`apps/platform/components/workspace/research/`)
  into `apps/desktop/src`.
- The project indexing engine (filesystem scanner → symbol index → reference
  graph) that the trace graph is meant to eventually read from — it currently
  reads from a hand-built fixture (see `graph-fixture.ts` in the ported code
  once it lands).
- AI provider configuration and the two independent AI configs (Coding,
  Research) described in the product spec. Nothing in `apps/desktop` calls an
  AI model yet.
- Removing/rebuilding the subscription-gating logic in `apps/platform`'s
  `lib/ai/model-router.ts` and `model-service.ts` for a bring-your-own-key
  model with no plan gating. Not done yet — this is real refactoring work
  inside the AI call path, not a file deletion, and hasn't been started.
- Packaging and distribution (`electron-builder.yml` exists, unverified).
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/DEPLOYMENT.md` still
  describe the old web-app architecture and need rewriting for the desktop
  app. Not yet done.

## Blocked / needs your input

- First real run of `pnpm install` + `pnpm --filter @zequel/desktop dev` needs
  to happen on a machine with network access and a display — I can't do
  either here. Please run it and tell me what actually happens before I build
  further on top of this foundation.
