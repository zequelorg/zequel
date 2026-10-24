# Deployment

Each app in this monorepo deploys as its **own Vercel project**, all pointing at
the same Git repository but with different Root Directories. This lets the three
apps scale, get domains, and hold environment variables independently.

## Vercel project setup (per app)

Create three Vercel projects from this repository:

| Vercel project | Root Directory | Suggested domain |
| --- | --- | --- |
| zequel-website | `apps/website` | `zequel.xyz` |
| zequel-platform | `apps/platform` | `app.zequel.xyz` |
| zequel-admin | `apps/admin` | `admin.zequel.xyz` |

For each project, in **Settings → General**:

- **Root Directory:** set to the app path above and enable
  "Include files outside of the Root Directory" (so the shared `packages/*` and
  the workspace lockfile are available during install/build).
- **Framework Preset:** Next.js (auto-detected).
- **Install Command:** `pnpm install` (auto-detected from `pnpm-lock.yaml`).
- **Build Command:** leave as the default `next build`. Vercel runs it inside the
  Root Directory; pnpm workspaces resolve the `@zequel/*` packages automatically.
- **Output Directory:** default (`.next`).

> Turborepo is not required at deploy time — Vercel builds each app directly.
> The root `pnpm build:*` scripts exist for local/CI convenience.

## Environment variables

Set these in **Settings → Environment Variables** for each Vercel project.
`NEXT_PUBLIC_*` values are exposed to the browser; everything else is server-only.

### Website (`apps/website`)

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser-safe anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Used by contact & bug-report API routes |
| `NEXT_PUBLIC_SITE_URL` | yes | e.g. `https://zequel.xyz` |
| `NEXT_PUBLIC_PLATFORM_URL` | yes | e.g. `https://app.zequel.xyz` (CTA links) |

### Platform (`apps/platform`)

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser-safe anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only; OTP, sessions, account ops |
| `OPENROUTER_API_KEY` | yes | AI inference for research/study modes |
| `RESEND_API_KEY` | yes* | OTP + data-export emails. Routes return a 500 "not configured" if absent rather than crashing |
| `NEXT_PUBLIC_SITE_URL` | yes | e.g. `https://app.zequel.xyz` |

### Admin (`apps/admin`)

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Same Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser-safe anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Required — admin queries span all users |

All three apps must point at the **same** Supabase project for auth and data to
line up. Admin authorization is data-driven: a user is an admin only if their
`profiles.role` is `admin` or `superadmin`.

## Database provisioning

Run the SQL scripts against your Supabase project (SQL Editor or `psql`) before
first deploy:

1. `scripts/init.sql` — full schema, indexes, RLS policies, `handle_new_user`
   trigger, and storage buckets. Idempotent.
2. `scripts/admin-extend.sql` — admin-only tables (audit log, settings, etc.).
3. `scripts/admin-seed.sql` — optional seed/sample data.

To grant yourself admin access, set your profile role after signing up:

```sql
update profiles set role = 'superadmin' where id = '<your-auth-user-id>';
```

## Deploy order

1. Provision Supabase + run SQL scripts.
2. Deploy **platform** (it owns auth and the core API surface).
3. Deploy **admin**.
4. Deploy **website** (set `NEXT_PUBLIC_PLATFORM_URL` to the platform domain).

Each `git push` to the connected branch triggers all three Vercel projects;
each builds only its own Root Directory.

## Pre-deploy checklist

```bash
pnpm install
pnpm type-check     # all 6 workspaces must pass
pnpm build          # all 3 apps must build
```

All three apps currently build cleanly with `next build` (Next.js 16, Turbopack).
