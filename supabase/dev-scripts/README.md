# dev-scripts (DEV ONLY - DESTRUCTIVE)

These scripts are NOT migrations. They were moved out of `supabase/migrations/`
so the Supabase CLI (`supabase db push`) can never apply them by accident.

| File | What it does |
|------|--------------|
| `00000000000000_clean_slate.sql` | Drops existing schema objects. Destroys data. |
| `00000000000000_nuclear_reset.sql` | Drops everything. Destroys data. |
| `00000000000001_create_test_accounts.sql` | Seeds test users/data (template; needs UUIDs). |
| `00000000000001_create_test_accounts_fixed.sql` | Seeds test users/data using hard-coded dev UUIDs. |

**Never run any of these against production.** Use only on a disposable local
or throwaway development project.

Test-account scripts: the passwords that used to be written in comments were
removed. Set strong passwords yourself (placeholder
`<SET_A_STRONG_PASSWORD_BEFORE_RUNNING>`) when creating the auth users, and
never reuse them anywhere real.
