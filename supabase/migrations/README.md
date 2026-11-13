# Migrations

- `20240101000000_...` through `20240108000000_...` are the **historical schema**.
  They were already applied to the live database by hand (SQL editor), so the
  live project has no `supabase_migrations` history. Do not re-run them on the
  live DB. They are kept as documentation / for bootstrapping a fresh dev DB.
- `20261113233259_production_hardening.sql` is the **next migration**. It is
  idempotent and non-destructive (no table or data drops): function
  hardening, anon revokes, RLS policy rewrite (initplan + consolidation),
  `activity_logs` policies and missing foreign-key indexes.
- Destructive reset scripts and test-account seeds live in `../dev-scripts/`
  and must never run on production.

Applying: review the file, then apply once (`supabase db push` after
`supabase migration repair --status applied 20240101000000 ... 20240108000000`,
or paste into the SQL editor / use the MCP `apply_migration`).
