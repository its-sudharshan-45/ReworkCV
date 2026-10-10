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
| `knowledge_documents`, `knowledge_chunks` | 022 | Global RAG knowledge base (trusted content; separate from private user data) |
| `ai_coach_conversations`, `ai_coach_messages` | 023 | AI Resume Coach conversations scoped to user + resume + analysis |

## Migration Files

| # | File | Purpose |
|---|---|---|
| 001 | `001_enable_extensions.sql` | Enables `pgcrypto`, `pgvector` |
| 002 | `002_identity_profiles.sql` | `profiles` table with RLS |
| 003 | `003_resume_intelligence.sql` | `resumes` table with RLS |
| 012 | `012_grant_permissions.sql` | Supabase role grants |
| 013 | `013_profile_extended_fields.sql` | Extended profile fields (Settings page) |
| 014 | `014_resume_job_analysis.sql` | `resume_job_analysis` table with RLS |
| 017 | `017_drop_legacy_tables.sql` | Dropped 16 legacy tables (job board, roadmaps, interviews, etc.) |
| 020 | `020_cover_letters_and_cleanup.sql` | `cover_letters` table; drops `resume_versions` & `notifications` |
| 021 | `021_drop_out_of_scope_tables.sql` | Drops aptitude, coding, adaptive & AI model registry tables |
| 022 | `022_rag_knowledge.sql` | RAG knowledge base (`knowledge_documents`, `knowledge_chunks` + pgvector index) |
| 023 | `023_ai_coach_conversations.sql` | AI Coach conversations + messages with RLS |
| 024 | `024_storage_and_least_privilege_hardening.sql` | Private `resumes` bucket + storage RLS; revokes anon table grants |

## Apply (Supabase SQL Editor or psql)

```bash
# Apply all migrations in order
for f in database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Safe on a fresh database. Do not re-run the whole directory against an
already-migrated database: `003` (`CREATE TYPE` has no `IF NOT EXISTS` in
Postgres) and the plain `CREATE POLICY` statements in
`002/003/014/020/023` fail on duplicates. Forward-only: never edit an
applied migration, add a new numbered file. See `docs/deployment.md` for
the full production procedure.

## Rollback

Forward-only migrations for production safety. Document manual rollback steps in migration file headers when needed.
