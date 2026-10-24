# Architecture

Zequel is a pnpm + Turborepo monorepo. Three independently deployable Next.js
applications share code through four internal packages. All three apps connect
to a single Supabase project (Postgres + Auth + Storage).

## Workspace graph

```
                    ┌──────────────────────────────┐
                    │        @zequel/config         │
                    │  tsconfig.base / nextjs +      │
                    │  postcss.config.mjs            │
                    └───────────────┬────────────────┘
                                    │ (extended by every tsconfig)
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌──────────────────┐        ┌──────────────────┐
│  @zequel/types │◀────────│  @zequel/shared   │        │   @zequel/ui      │
│  domain types  │         │  supabase clients │        │  shadcn components│
│  + cms schemas │         │  security/settings│        │  hooks + globals  │
└───────┬────────┘         └─────────┬─────────┘        └─────────┬─────────┘
        │                            │                            │
        └──────────────┬─────────────┴──────────────┬─────────────┘
                       │                             │
            ┌──────────┴──────────┐       ┌──────────┴──────────┐
            ▼                     ▼       ▼                     ▼
   ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
   │ @zequel/website │   │ @zequel/platform│   │  @zequel/admin  │
   │   (port 3000)   │   │   (port 3001)   │   │   (port 3002)   │
   └────────────────┘   └────────────────┘   └────────────────┘
```

Dependencies flow **one direction**: apps depend on packages; packages may
depend on `@zequel/types` and `@zequel/config`. Apps never import from each other.

## Packages

### `@zequel/config`
Centralizes build configuration so every workspace stays consistent.

- `tsconfig.base.json` — strict TypeScript base extended by packages.
- `tsconfig.nextjs.json` — Next.js-flavored config extended by the apps.
- `postcss.config.mjs` — shared Tailwind v4 / PostCSS pipeline.

It exposes no JavaScript; consumers reference its files via `extends` and
declare it as a `devDependency` (`workspace:*`).

### `@zequel/types`
Framework-agnostic TypeScript types and Zod-adjacent schemas. Notable exports:

- `.` (index) — core domain types: documents, conversations, messages, queries,
  query results, subscriptions, the DB-shaped `BugReport`, etc.
- `./cms-types` — admin CMS content models (blog, FAQ, pricing, `CmsBugReport`, …).
- `./cms-schema` — validation schemas for CMS content.

> Note: `BugReport` (database row shape, exported from the index) and
> `CmsBugReport` (admin CMS editing shape, from `./cms-types`) are intentionally
> distinct. They were disambiguated during the monorepo migration.

### `@zequel/shared`
Server/runtime utilities shared between platform and admin. Subpath exports:

| Export | Purpose |
| --- | --- |
| `./supabase/client` | Browser Supabase client |
| `./supabase/server` | Server (RSC/route) client with cookie handling |
| `./supabase/service` | Service-role client (bypasses RLS) — server only |
| `./supabase/middleware` | Session-refresh + route-protection middleware helper |
| `./security/rate-limit` | In-memory rate limiting |
| `./security/advanced-rate-limit` | DB-backed rate-limit violation tracking |
| `./security/subscription` | Subscription plan checks/enforcement |
| `./settings/system-settings` | Global system settings read/write |
| `./validation/ai-schema` | Zod schemas for AI request validation |

### `@zequel/ui`
The shadcn/ui component library plus shared hooks and `globals.css`. Exports the
component barrel (`.`), `./globals.css`, individual `./components/*`,
`./hooks/*`, and `./lib/utils`.

## Applications

### Website (`@zequel/website`, port 3000)
Static-leaning marketing site (home, features, pricing, about, blog, docs) plus
two API routes (`/api/contact`, `/api/bug-reports`) that write to Supabase. Most
pages are statically generated with periodic revalidation.

### Platform (`@zequel/platform`, port 3001)
The product. Supabase email/OTP auth, the research/study workspace, document
upload + text extraction (`pdf-parse`), AI calls via OpenRouter, session
management, account export/delete, and subscription handling. API routes are
server-rendered on demand.

### Admin (`@zequel/admin`, port 3002)
Internal dashboard. Reads/writes the same Supabase project using the
service-role client, gated by `verifyAdmin()` which checks `profiles.role ∈
{admin, superadmin}`. Covers users, subscriptions, AI usage, safety, audit log,
and a CMS for website content.

## Request / data flow (platform)

```
Browser ──▶ Next middleware (session refresh) ──▶ API route
                                                      │
                            ┌─────────────────────────┤
                            ▼                         ▼
                   verify auth + validate      AI model service
                   (@zequel/shared)            (rate limit → subscription
                            │                   → model router → OpenRouter)
                            ▼                         │
                        Supabase  ◀──────────────────┘
                   (Postgres / Auth / Storage)        │
                                                      ▼
                                                   Resend (OTP, export email)
```

## Build pipeline (Turborepo)

`turbo.json` defines `build`, `dev`, `lint`, `type-check`, and `clean`.
`build`, `lint`, and `type-check` declare `dependsOn: ["^build"]`, so internal
packages are built before dependents. `globalEnv` lists the environment
variables that participate in cache keys, so changing an env var correctly
invalidates the cache.
