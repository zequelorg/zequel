# Packaging the Go Backend

## Status

**Designed and wired into config; not yet exercised.** No packaged build has
been produced in this project — there's no network or Go toolchain in the
sandbox this was written in, let alone a macOS/Windows/Linux build matrix. The
pieces below are real (code + config, not just prose) but unverified end to
end.

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

None of these have answers yet. This document is the plan, not a confirmation
any of it works.
