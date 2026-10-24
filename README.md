# Zequel — AI Research System (Monorepo)

**Organization:** Absalex Labs · **License:** Proprietary

Zequel is an AI-powered research and study platform. This repository is a
pnpm + Turborepo **monorepo** containing three Next.js applications and four
shared packages.

> Looking for the original in-depth product/technical write-up (AI design,
> database schema, API behavior)? It is preserved at
> [`docs/LEGACY-TECHNICAL-REFERENCE.md`](docs/LEGACY-TECHNICAL-REFERENCE.md).

---

## Repository layout

```
zequel/
├── apps/
│   ├── website/     Marketing site        (@zequel/website,  port 3000)
│   ├── platform/    Main product app      (@zequel/platform, port 3001)
│   └── admin/       Admin dashboard       (@zequel/admin,    port 3002)
├── packages/
│   ├── ui/          Shared UI components  (@zequel/ui)
│   ├── shared/      Supabase clients, security, settings, validation (@zequel/shared)
│   ├── types/       Shared TypeScript types & schemas (@zequel/types)
│   └── config/      Shared tsconfig + PostCSS config  (@zequel/config)
├── scripts/         SQL schema/seed files + build helpers
├── docs/            Architecture, deployment, and development guides
├── turbo.json       Turborepo task pipeline
└── pnpm-workspace.yaml
```

| App | Package | Description | Dev port |
| --- | --- | --- | --- |
| Website | `@zequel/website` | Public marketing site, blog, docs, contact & bug-report forms | 3000 |
| Platform | `@zequel/platform` | Auth, research workspace, study chat, document management, billing | 3001 |
| Admin | `@zequel/admin` | Internal dashboard: users, subscriptions, safety, CMS, audit logs | 3002 |

| Package | Description |
| --- | --- |
| `@zequel/ui` | shadcn/ui-based component library, hooks, and `globals.css` |
| `@zequel/shared` | Supabase clients (browser/server/service), rate limiting, subscription gating, system settings, AI validation schemas |
| `@zequel/types` | Domain types (documents, conversations, queries) + CMS types/schemas |
| `@zequel/config` | `tsconfig.base.json`, `tsconfig.nextjs.json`, shared `postcss.config.mjs` |

---

## Quick start

Requires **Node 18+** and **pnpm 9+**.

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Configure environment variables (see below)
cp apps/website/.env.example  apps/website/.env.local
cp apps/platform/.env.example apps/platform/.env.local
cp apps/admin/.env.example    apps/admin/.env.local

# 3. Run an app (or all of them)
pnpm dev:website     # http://localhost:3000
pnpm dev:platform    # http://localhost:3001
pnpm dev:admin       # http://localhost:3002
pnpm dev             # all three in parallel
```

---

## Common scripts (run from the repo root)

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all apps in parallel (Turborepo) |
| `pnpm dev:website` / `dev:platform` / `dev:admin` | Run a single app |
| `pnpm build` | Build every app and package |
| `pnpm build:website` / `build:platform` / `build:admin` | Build a single app |
| `pnpm type-check` | Type-check every workspace (`tsc --noEmit`) |
| `pnpm lint` | Lint every workspace |
| `pnpm clean` | Remove build artifacts and `node_modules` |

Turborepo caches task output, so re-running unchanged builds/type-checks is fast.

---

## Environment variables

Each app ships an `.env.example`. Copy it to `.env.local` for local development.
A full reference table lives in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#environment-variables).

| Variable | Website | Platform | Admin | Purpose |
| --- | :---: | :---: | :---: | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | ✓ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | ✓ | Supabase anon key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | ✓ | Service-role key (server-only, bypasses RLS) |
| `OPENROUTER_API_KEY` | | ✓ | | AI model provider for research/study |
| `RESEND_API_KEY` | | ✓ | | Transactional email (OTP, data export) |
| `NEXT_PUBLIC_SITE_URL` | ✓ | ✓ | | Public base URL of the app |
| `NEXT_PUBLIC_PLATFORM_URL` | ✓ | | | Platform URL used by website CTAs |

All three apps talk to the **same Supabase project**. Admin access is gated by
the `role` column on the `profiles` table (`admin` or `superadmin`).

---

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Backend:** Supabase (Postgres, Auth, RLS)
- **AI:** OpenRouter
- **Email:** Resend
- **Tooling:** pnpm workspaces + Turborepo

---

## Database

The consolidated schema lives in [`scripts/init.sql`](scripts/init.sql) (idempotent;
safe to run on a fresh or existing Supabase project). Admin-specific tables and
seed data are in `scripts/admin-extend.sql` and `scripts/admin-seed.sql`.

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, package boundaries, data flow
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — deploying the three apps to Vercel + env reference
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — local dev workflow, adding code, conventions
- [`docs/LEGACY-TECHNICAL-REFERENCE.md`](docs/LEGACY-TECHNICAL-REFERENCE.md) — original detailed product/AI/API/DB reference
- [`MIGRATION-REPORT.md`](MIGRATION-REPORT.md) — record of the monolith → monorepo migration

---

*Maintained by Absalex Labs. All rights reserved.*
