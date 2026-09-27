[//]: # (cspell:ignore pgcrypto uuid-ossp)
# Database Migrations

ReworkCV uses sequential, numbered SQL migrations applied in order against a Supabase (PostgreSQL) database.

## Conventions

- File naming: `NNN_description.sql` (zero-padded, snake_case)
- One logical change per migration
- Migrations are forward-only — never edit an applied migration; add a new one
- Use `IF NOT EXISTS` / `IF EXISTS` guards for idempotency
- Include RLS policies for every user-owned table
- Document breaking changes in migration headers

## Current Product Schema (after migration 021)

| Table | Migration | Purpose |
|---|---|---|
| `profiles` | 002, 013 | User identity and career preferences |
| `resumes` | 003 | Uploaded resume records with extracted + structured data |
| `resume_job_analysis` | 014 | ATS job-description match analysis results |
| `cover_letters` | 020 | AI-generated cover letters tied to a resume + job description |

## Migration Files

| # | File | Purpose |
|---|---|---|
| 001 | `001_enable_extensions.sql` | Enables `uuid-ossp`, `pgcrypto` |
| 002 | `002_identity_profiles.sql` | `profiles` table with RLS |
| 003 | `003_resume_intelligence.sql` | `resumes` table with RLS |
| 012 | `012_grant_permissions.sql` | Supabase role grants |
| 013 | `013_profile_extended_fields.sql` | Extended profile fields (Settings page) |
| 014 | `014_resume_job_analysis.sql` | `resume_job_analysis` table with RLS |
| 017 | `017_drop_legacy_tables.sql` | Dropped 16 legacy tables (job board, roadmaps, interviews, etc.) |
| 020 | `020_cover_letters_and_cleanup.sql` | `cover_letters` table; drops `resume_versions` & `notifications` |
| 021 | `021_drop_out_of_scope_tables.sql` | Drops aptitude, coding, adaptive & AI model registry tables |

## Apply (Supabase SQL Editor or psql)

```bash
# Apply all migrations in order
for f in database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

## Rollback

Forward-only migrations for production safety. Document manual rollback steps in migration file headers when needed.
