-- =============================================================================
-- 021_drop_out_of_scope_tables.sql
-- Final Cleanup: Drop All Remaining Out-of-Scope Tables
--
-- PURPOSE:
--   Removes tables that have no active backend or frontend references in the
--   current product scope (AI Resume Analysis, Job Description Matching,
--   Professional Report, AI Cover Letter Generation).
--
-- TABLES DROPPED:
--   From 015 (aptitude / coding / adaptive — never implemented):
--     - adaptive_learning_loops
--     - aptitude_submissions
--     - coding_submissions
--     - aptitude_questions     (content bank, no user data)
--     - coding_challenges      (content bank, no user data)
--
--   From 015 (AI model registry — no active backend usage after NER removal):
--     - ai_model_events
--     - ai_model_metrics
--     - ai_model_health
--     - ai_model_revisions
--     - ai_models
--
-- PRE-REQUISITES:
--   [x] Migrations 001–020 have been applied
--   [x] No active backend or frontend references any of these tables
--   [x] 018_document_legacy_aptitude_coding_tables.sql already annotated these
--
-- IDEMPOTENT: Yes — all DROP TABLE / DROP TYPE use IF EXISTS.
-- SAFE TO RUN: Yes — core product tables (profiles, resumes,
--   resume_job_analysis, cover_letters) are NOT touched.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Drop leaf tables first (tables with foreign keys to parents below)
-- ─────────────────────────────────────────────────────────────────────────────

-- adaptive_learning_loops had FK to public.roadmaps (dropped in 017, now NULL).
-- Has user FK to auth.users with ON DELETE CASCADE.
DROP TABLE IF EXISTS public.adaptive_learning_loops CASCADE;

-- Submission tables — user FKs with ON DELETE CASCADE
DROP TABLE IF EXISTS public.aptitude_submissions   CASCADE;
DROP TABLE IF EXISTS public.coding_submissions     CASCADE;

-- AI model telemetry — FK to ai_models
DROP TABLE IF EXISTS public.ai_model_events        CASCADE;
DROP TABLE IF EXISTS public.ai_model_metrics       CASCADE;
DROP TABLE IF EXISTS public.ai_model_health        CASCADE;
DROP TABLE IF EXISTS public.ai_model_revisions     CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Drop root / content-bank tables (no dependents after Step 1)
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.aptitude_questions     CASCADE;
DROP TABLE IF EXISTS public.coding_challenges      CASCADE;
DROP TABLE IF EXISTS public.ai_models              CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Safety check — verify core product tables are still intact
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'profiles',
    'resumes',
    'resume_job_analysis',
    'cover_letters'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY required_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE EXCEPTION 'SAFETY ABORT: Core table "%" is missing after migration 021!', t;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration 021 safety check PASSED — all core product tables are intact.';
END $$;

COMMIT;
