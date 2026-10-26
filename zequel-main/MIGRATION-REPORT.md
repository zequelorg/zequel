# Migration Report: Monolith → Monorepo

**Project:** Zequel — AI Research System
**Migration:** Single Next.js app → pnpm + Turborepo monorepo (3 apps, 4 packages)
**Status:** Complete — all workspaces type-check and all three apps build for production.

---

## 1. Summary

Zequel began as a single Next.js application at the repository root. It was
restructured into a monorepo with three independently deployable apps
(`website`, `platform`, `admin`) sharing four internal packages (`ui`, `shared`,
`types`, `config`). This report records the work done to finish that migration,
resolve the issues blocking type-checking and production builds, and document the
result.

Final state:

- `pnpm type-check` — 6/6 workspaces pass.
- `pnpm build` — `website`, `platform`, and `admin` all build with `next build`
  (Next.js 16, Turbopack).
- The orphaned pre-migration monolith at the repo root has been removed.

---

## 2. Target structure

```
apps/      website (3000) · platform (3001) · admin (3002)
packages/  ui · shared · types · config
scripts/   SQL schema/seed + build helpers
docs/      ARCHITECTURE · DEPLOYMENT · DEVELOPMENT · LEGACY-TECHNICAL-REFERENCE
```

Dependency direction: apps → packages; packages → (`types`, `config`). No
app-to-app imports.

---

## 3. Issues found and resolved

### 3.1 Shared tsconfig (`@zequel/config`) not resolving
**Symptom:** `Cannot find module '@zequel/config'` from tsconfigs that used
`extends`.
**Cause:** Six packages extended `@zequel/config`, but none declared it as a
dependency, so pnpm never created the symlink in their isolated `node_modules`.
**Fix:** Added `"@zequel/config": "workspace:*"` to the `devDependencies` of
`admin`, `platform`, `types`, `shared`, and `ui` (website already had it).

### 3.2 Missing `@types/node` in packages requiring Node types
**Symptom:** Type errors in `@zequel/shared` and `@zequel/ui`.
**Cause:** Their tsconfigs request `types: ["node"]` but `@types/node` was not
installed in those packages.
**Fix:** Added `@types/node` to `shared` and `ui` `devDependencies`.

### 3.3 Untyped Supabase cookie callbacks in `@zequel/shared`
**Symptom:** Implicit-`any` errors under the strict base config in
`supabase/server.ts` and `supabase/middleware.ts`.
**Fix:** Added explicit types to the `getAll`/`setAll` cookie callbacks, and
restored the configurable redirect logic in the middleware helper.

### 3.4 Duplicate `useIsMobile` export in `@zequel/ui`
**Symptom:** Export collision — `useIsMobile` exported twice.
**Cause:** Two identical files (`components/use-mobile.tsx` and
`hooks/use-mobile.ts`) were both re-exported from the barrel.
**Fix:** Removed the unused `components/use-mobile.tsx` and dropped its barrel
export; `hooks/use-mobile` is the canonical source.

### 3.5 Missing `swr` in `@zequel/admin`
**Symptom:** A cascade of implicit-`any` errors across admin pages.
**Cause:** Admin's SWR hooks had no `swr` dependency, so the hooks resolved to
`any` and the `any` propagated into every consuming page.
**Fix:** Added `swr` to admin. The cascade disappeared once the hook types
resolved.

### 3.6 Colliding `BugReport` type definitions
**Symptom:** Admin CMS bug-report page failed type-checking against the wrong
shape.
**Cause:** Two `BugReport` interfaces existed — a database row shape (exported
from `@zequel/types` index) and an admin CMS editing shape (in
`@zequel/types/cms-types`). The index definition won the `export *` ambiguity.
**Fix:** Renamed the CMS interface to `CmsBugReport` and updated its consumers
(`cms-mock-data.ts`, `cms/bug-reports/page.tsx`).

### 3.7 Unsafe Supabase result casts in admin CMS route
**Symptom:** Type errors casting a possibly-`GenericStringError` result directly
to `Record<string, unknown>` in `api/admin/cms/[resource]/route.ts`.
**Fix:** Cast through `unknown` first (`as unknown as Record<string, unknown>`).

### 3.8 Broken/malformed imports in `@zequel/platform` and `@zequel/website`
- `platform/lib/store.ts` imported from a non-existent `./types`. Repointed to
  `@zequel/types`, which also cleared the downstream implicit-`any` errors in the
  evidence/research/study panels.
- `website/lib/site/fallbacks.ts` had an `import` statement injected into the
  middle of a `type` import. Restored the correct import structure.

### 3.9 `pdf-parse` had no type declarations (platform)
**Fix:** Added a local `apps/platform/types/pdf-parse.d.ts` ambient declaration.

### 3.10 `convId` not narrowed in study-panel (platform)
**Symptom:** `string | null` passed where `string` was required.
**Fix:** Added an early `if (!convId) return` guard to narrow the type.

### 3.11 Orphaned pre-migration monolith at the repo root (build blocker)
**Symptom:** `next build` for `website` failed resolving `./middleware.ts` →
`@/lib/supabase/middleware`, a path that only existed in the old monolith.
**Cause:** The migration left the entire pre-migration app at the repo root
(235 tracked files: `app/`, `components/`, `hooks/`, `lib/`, `styles/`,
`public/`, `middleware.ts`, `next.config.mjs`, root `tsconfig.json`, etc.).
Turbopack inferred the workspace root and pulled in the stray root
`middleware.ts`.
**Fix (approved):** Removed the dead monolith from the root via `git rm`:
`app/`, `components/`, `hooks/`, `lib/`, `styles/`, `public/`, `middleware.ts`,
`next.config.mjs`, `next-env.d.ts`, `components.json`, `postcss.config.mjs`,
`tsconfig.json`, `tsconfig.tsbuildinfo`. Kept monorepo infrastructure
(`package.json`, `turbo.json`, `pnpm-*`, `scripts/`, docs). After removal, only
`apps/`, `packages/`, and `scripts/` remain at the root.

### 3.12 Module-level Resend client crashed the platform build
**Symptom:** Platform `next build` failed during "Collecting page data" with
`Missing API key. Pass it to the constructor new Resend(...)`.
**Cause:** `new Resend(process.env.RESEND_API_KEY)` ran at module load (build
time) in `api/account/export` and `api/otp/send`.
**Fix:** Made both lazy via a `getResend()` helper invoked inside the handler,
and added a `RESEND_API_KEY` guard to the OTP route (export already had one).

### 3.13 Next.js 16 `eslint` config warning
**Symptom:** Build warning — `eslint` config key no longer supported.
**Fix:** Removed the `eslint` key from all three apps' `next.config.mjs`.

### 3.14 Inconsistent type-check script name (website)
**Symptom:** `pnpm type-check` silently skipped the website.
**Cause:** Website's script was named `typecheck`; turbo and every other
workspace use `type-check`.
**Fix:** Renamed website's script to `type-check`. The repo-wide command now
covers all 6 workspaces.

---

## 4. Dependencies added

| Workspace | Added | Reason |
| --- | --- | --- |
| admin, platform, types, shared, ui | `@zequel/config` (`workspace:*`, dev) | resolve shared tsconfig |
| shared, ui | `@types/node` (dev) | tsconfig `types: ["node"]` |
| admin | `swr` | data fetching hooks |
| website | `clsx`, `tailwind-merge` | `lib/utils` `cn()` helper |

## 5. Files added

- `apps/platform/.env.example`, `apps/admin/.env.example`
- `apps/platform/types/pdf-parse.d.ts`
- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/DEVELOPMENT.md`
- `docs/LEGACY-TECHNICAL-REFERENCE.md` (preserved original README content)
- `MIGRATION-REPORT.md` (this file)
- Rewrote root `README.md` for the monorepo

## 6. Verification

```bash
pnpm install
pnpm type-check   # 6 successful, 6 total
pnpm build        # website + platform + admin all build
```

| App | Result | Routes |
| --- | --- | --- |
| website | build OK | 11 (static marketing + 2 API) |
| platform | build OK | 23 (workspace, auth, account, AI APIs) |
| admin | build OK | 36 (dashboard + CMS + admin APIs) |

## 7. Follow-ups / notes

- All three apps deploy as separate Vercel projects with distinct Root
  Directories — see `docs/DEPLOYMENT.md`.
- `typescript.ignoreBuildErrors` is currently `true` in each app's
  `next.config.mjs`. Type safety is enforced separately via `pnpm type-check`
  (now green), but consider flipping these to `false` in CI once the team is
  comfortable.
- Admin authorization is data-driven via `profiles.role`; ensure at least one
  `superadmin` is seeded before relying on the admin app.
