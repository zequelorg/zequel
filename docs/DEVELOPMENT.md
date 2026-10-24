# Development

## Prerequisites

- **Node.js** 18 or newer
- **pnpm** 9 or newer (`npm install -g pnpm`)
- A **Supabase** project (for auth/data while developing platform & admin)

## First-time setup

```bash
pnpm install

cp apps/website/.env.example  apps/website/.env.local
cp apps/platform/.env.example apps/platform/.env.local
cp apps/admin/.env.example    apps/admin/.env.local
# fill in the values in each .env.local
```

## Running apps

```bash
pnpm dev:website     # http://localhost:3000
pnpm dev:platform    # http://localhost:3001
pnpm dev:admin       # http://localhost:3002
pnpm dev             # all three in parallel via Turborepo
```

Each app pins its own port in its `package.json` `dev` script, so they can run
side by side.

## Repository structure

```
apps/<app>/
├── app/            Next.js App Router routes (pages + /api)
├── components/     App-specific components
├── lib/            App-specific logic (ai, security, sessions, …)
├── public/         Static assets (each app has its own)
├── next.config.mjs transpilePackages: ["@zequel/ui","@zequel/shared","@zequel/types"]
├── tsconfig.json   extends @zequel/config/tsconfig.nextjs.json
└── .env.example

packages/<pkg>/
├── src/            Source (shipped as raw TS/TSX, transpiled by consumers)
├── package.json    name + version + exports map
└── tsconfig.json   extends @zequel/config/tsconfig.base.json
```

## Working with shared packages

Packages ship **raw TypeScript** and are transpiled by each Next.js app via
`transpilePackages`. There is no separate build step for `@zequel/ui`,
`@zequel/shared`, or `@zequel/types` during development — edit a package and the
consuming app picks it up through HMR.

### Importing from packages

```ts
// UI
import { Button } from "@zequel/ui"
import "@zequel/ui/globals.css"

// Types
import type { QueryResult } from "@zequel/types"
import type { CmsBugReport } from "@zequel/types/cms-types"

// Shared (server-side)
import { createClient } from "@zequel/shared/supabase/server"
import { createServiceClient } from "@zequel/shared/supabase/service"
```

### Adding a dependency

```bash
# to a specific app
pnpm --filter @zequel/platform add <pkg>

# to a shared package
pnpm --filter @zequel/ui add <pkg>

# a workspace package as a dependency (note: workspace:* protocol)
pnpm --filter @zequel/platform add @zequel/shared@workspace:*
```

> If a package's `tsconfig.json` lists `types: ["node"]` or uses React, make sure
> `@types/node` / `@types/react` are in that package's `devDependencies`.

### Adding a new export to a package

Edit the package's `exports` map in its `package.json`. For example, to expose a
new shared util at `@zequel/shared/foo/bar`:

```jsonc
"exports": {
  "./foo/bar": "./src/foo/bar.ts"
}
```

## Quality gates

```bash
pnpm type-check    # tsc --noEmit across all workspaces
pnpm lint          # lint across all workspaces
pnpm build         # production build of all 3 apps
```

The Turborepo `type-check` and `build` tasks depend on `^build`, and the
`type-check` script name is consistent across **every** workspace (including
website), so `pnpm type-check` covers the whole repo.

## Conventions

- **No cross-app imports.** Apps depend on packages only, never on each other.
- **Server vs. browser Supabase clients.** Use `./supabase/server` in
  RSC/route handlers, `./supabase/client` in browser components, and
  `./supabase/service` only for trusted server operations (it bypasses RLS).
- **Lazy-init external SDK clients.** Construct clients (Resend, etc.) inside the
  request handler, not at module top level, so a missing key doesn't crash the
  build's page-data collection step. Guard with an env check and return a clean
  error response.
- **Per-user scoping.** Platform queries filter by the authenticated user; RLS
  is the backstop. Admin uses the service client deliberately and is gated by
  `verifyAdmin()`.
- **Logging.** Prefix server logs with `[Zequel]` for grep-ability.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Cannot find module '@zequel/config'` in a tsconfig | Add `"@zequel/config": "workspace:*"` to that package's `devDependencies`, then `pnpm install`. |
| Implicit-`any` errors that look unrelated | A dependency (e.g. `swr`) is missing, so its types resolve to `any` and cascade. Install it. |
| Build fails during "Collecting page data" with a missing-API-key error | An SDK client is instantiated at module scope. Make it lazy (construct inside the handler). |
| `eslint` config warning from Next 16 | Next.js 16 dropped the `eslint` key in `next.config.mjs`; remove it. |
