# Database Seeds

Seed scripts are optional and intended for local development only.

## Rules

- Do **not** seed production data from this directory
- Keep all seeds idempotent (`ON CONFLICT DO NOTHING` or `IF NOT EXISTS`)
- Never include real secrets or real user data

## Current Seeds

No seed scripts are required for the current product scope. All core tables
(`profiles`, `resumes`, `resume_job_analysis`, `cover_letters`) are populated
entirely through the application's user flow:

1. User signs up → `profiles` row created via auth trigger
2. User uploads resume → `resumes` row inserted via `/api/v1/resumes`
3. User runs analysis → `resume_job_analysis` row inserted via `/api/v1/resumes/:id/analyze`
4. User generates cover letter → `cover_letters` row inserted via `/api/v1/cover-letters`
