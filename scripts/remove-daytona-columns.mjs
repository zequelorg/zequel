// Rollback for the Daytona integration's database columns.
//
// Context: an earlier migration (scripts/apply-daytona-migration.mjs, now
// removed) added daytona_sandbox_id, daytona_sandbox_state, and
// daytona_last_synced_at to public.coding_projects. Daytona was never wired
// into any code path that reads or writes these columns (confirmed by
// repository-wide search — no application code references them), so they are
// dead regardless of whether this script is run.
//
// This script is OPTIONAL. It only matters if the original migration was
// actually applied to your database:
//   - If you never ran apply-daytona-migration.mjs against this database,
//     these columns don't exist and you do not need to run this.
//   - If you did run it (e.g. in a deployed environment), run this once to
//     drop the now-unused columns and their index.
//
// This does NOT touch coding_projects rows, any other table, or any other
// column. It is idempotent (safe to run more than once) and uses
// `if exists` throughout so it will not error on a database where the
// columns were never added.
import pg from "pg"

const { Client } = pg

const connectionString =
  process.env.MIGRATION_DB_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL
if (!connectionString) {
  console.error("[migration] no Postgres connection string is set")
  process.exit(1)
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

const migration = `
drop index if exists public.coding_projects_daytona_sandbox_id_key;

alter table public.coding_projects
  drop column if exists daytona_sandbox_id,
  drop column if exists daytona_sandbox_state,
  drop column if exists daytona_last_synced_at;
`

async function main() {
  await client.connect()
  await client.query(migration)
  const { rows } = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'coding_projects'
     and column_name like 'daytona%' order by column_name;`,
  )
  console.log(
    "[migration] remaining daytona columns on coding_projects:",
    rows.length ? rows.map((r) => r.column_name).join(", ") : "(none)",
  )
  await client.end()
}

main().catch((err) => {
  console.error("[migration] failed:", err.message)
  process.exit(1)
})
