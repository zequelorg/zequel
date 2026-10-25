# Packaging the Go Backend

## Status

**Designed, wired into config, and now a real CI workflow — still not
exercised.** `.github/workflows/build.yml` implements the exact matrix
below: a `test` job (Go vet/test/build sanity check, JS type-check, lint),
then a `build` job matrix across macOS Apple Silicon, macOS Intel, Windows
x64, and Linux x64, each building the Go backend natively, building the
Electron app, and running `electron-builder`, with the packaged app uploaded
as a downloadable artifact. It has never actually run — this sandbox has no
GitHub Actions access, so it's written carefully against each action's
documented behavior, not confirmed by a real run. **Push it and watch the
first run before trusting it.** The Go backend itself, unlike the workflow
wrapping it, actually has been built and tested for real, in this sandbox
(see `docs/STATUS.md`, `backend/README.md`) — that part of this pipeline is
on solid ground; the CI orchestration around it is not yet proven.

## The core constraint

`electron-builder` does not cross-compile Go. It packages whatever files
already exist on disk for the target it's building. So the Go binary for each
OS/arch has to exist at a fixed path (`backend/bin/zequeld` or
`zequeld.exe`) **before** `electron-builder` runs for that target — there is
no way to ask electron-builder to produce a Windows binary from a Go build
running on macOS without also cross-compiling Go separately first.

## Chosen approach: build natively per target, then package

Because we chose `modernc.org/sqlite` specifically to avoid CGO (see
`docs/STATUS.md`), the Go backend has **no CGO dependency** once SQLite is
added later either — which means Go cross-compilation (`GOOS`/`GOARCH`) would
actually work cleanly if we wanted it. But native-per-runner is simpler and
more reliable to get right first, so that's the recommended CI shape:

A CI matrix with one job per (OS, arch) pair:

| OS | arch | GOOS | GOARCH |
|---|---|---|---|
| macOS | Apple Silicon | darwin | arm64 |
| macOS | Intel | darwin | amd64 |
| Windows | x64 | windows | amd64 |
| Linux | x64 | linux | amd64 |

Each job, on a runner matching that OS:

```bash
cd backend
go build -o bin/zequeld ./cmd/zequeld        # bin/zequeld.exe on Windows
cd ../apps/desktop
pnpm build                                    # tsc + vite build
npx electron-builder --publish=never          # packages for the CURRENT OS
```

Because each job builds and packages for its own OS in the same job, the
`backend/bin/zequeld` that `electron-builder`'s `extraResources` entry
(`apps/desktop/electron-builder.yml`) picks up is always the right one for
that target — no cross-compilation coordination needed between the Go build
step and the packaging step.

macOS universal binary (arm64 + amd64 in one file via `lipo`) is a reasonable
later optimization once both are building correctly separately; not worth the
added complexity for a first working pipeline.

## Dev vs. packaged binary resolution

`apps/desktop/electron/backend.ts`'s `resolveBackendBinaryPath()` branches on
`app.isPackaged`:

- **Dev** (`app.isPackaged === false`): `backend/bin/zequeld` relative to the
  repo root, built by hand per `backend/README.md`. This path only exists in
  a full source checkout.
- **Packaged**: `process.resourcesPath/backend/zequeld`, where
  `process.resourcesPath` is Electron's own path to the packaged app's
  `resources/` directory. `electron-builder.yml`'s `extraResources` entry
  (`from: ../../backend/bin`, `to: backend`) is what puts the binary there at
  package time.

Both branches use the literal filename `zequeld` (or `zequeld.exe` on
Windows) — there's no architecture suffix in the filename, because each
packaged build only ever contains the one binary built for that specific
target in CI. A universal macOS binary, if added later, still just needs to
be named `zequeld`.

## Code signing / notarization

Not addressed yet — out of scope until there's a real packaged build to sign.
macOS will refuse to run an unsigned/unnotarized spawned binary from inside a
notarized app bundle in some configurations; this needs real verification
once packaging is actually attempted, not an assumption made in advance here.

## What to verify once this is tested for real

1. Does the CI-built `zequeld` binary actually get included in the `.dmg`/
   `.exe`/`AppImage` at the expected path?
2. Does `process.resourcesPath` resolve the way assumed above on all three
   OSes inside a packaged app (not just in `pnpm dev`)?
3. Does macOS Gatekeeper/notarization block the spawned binary?
4. Does the Windows build need the binary's execute bit / any additional
   manifest for SmartScreen?
5. Does `.github/workflows/build.yml` actually pass on a real push — in
   particular: does `pnpm install --no-frozen-lockfile` resolve the newly
   added Tailwind/CodeMirror/lucide-react dependencies cleanly (this has
   never run against the real npm registry, only attempted and blocked in
   the sandbox — see `docs/STATUS.md`), and does the proactive `libfuse2`
   install actually cover everything the Linux `electron-builder` AppImage
   step needs, or are there other missing system packages this document
   didn't anticipate?

None of these have answers yet. This document is the plan, not a confirmation
any of it works.

## CI workflow

`.github/workflows/build.yml` — triggers on push to `main`, on pull
requests, and manually (`workflow_dispatch`). Two jobs:

- `test` (ubuntu-latest, fast): `go vet`, `go test -v`, a `go build` sanity
  check, `pnpm install`, `tsc --noEmit` for `apps/desktop`, and `pnpm lint`
  (non-blocking for now — see the workflow's own comment on why).
- `build` (needs `test` to pass first): the four-target matrix above, each
  producing a downloadable artifact (`actions/upload-artifact`, 14-day
  retention). `--publish=never` is explicit — this workflow does not publish
  a GitHub Release or wire up auto-updates; that's separate future work.

Known rough edges, flagged in the workflow's own comments rather than
hidden: the lockfile install uses `--no-frozen-lockfile` because
`pnpm-lock.yaml` doesn't have a resolved `apps/desktop` entry yet (same
network-access gap as everywhere else in this project's history); the Linux
job proactively installs `libfuse2` before packaging (modern `ubuntu-latest`
runners don't ship it, and electron-builder's AppImage target needs it —
fixed in advance rather than left for the first failure to surface it, but
still unconfirmed since the workflow has never run); code signing/
notarization for macOS and Windows is not configured at all, so expect
Gatekeeper/SmartScreen warnings on the unsigned output.
