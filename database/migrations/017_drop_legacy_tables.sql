-- =============================================================================
-- 017_drop_legacy_tables.sql
-- Phase 2: Hard Delete of Deprecated Legacy Feature Tables
--
-- PURPOSE:
--   Permanently removes the 16 legacy tables, 3 custom ENUMs, and 1 column
--   that were soft-deprecated in migration 016. This reduces storage, removes
--   misleading schema clutter, and completes the repositioning of UpSkilr as
--   an AI-Powered Resume Analysis & Improvement System.
--
-- PRE-REQUISITES — verify ALL of the following before running:
--   [x] Migration 016_deprecate_legacy_tables.sql has been applied
--   [x] Any user data in legacy tables has been exported / backed up if needed
--   [x] No active backend service references these tables
--   [x] Supabase Storage buckets for these features (if any) have been cleaned
--
-- TABLES DROPPED (16):
--   From 004: job_postings, job_matches
--   From 005: roadmap_tasks, roadmap_stages, roadmaps, learning_resources
--   From 008: application_events, applications
--   From 009: interview_answers, interview_questions, interviews
--   From 010: readiness_scores
--   From 011: ai_messages, ai_conversations, rag_document_chunks, rag_documents
--
-- TYPES DROPPED (3):
--   application_status, interview_type, interview_status
--
-- COLUMNS DROPPED (1):
--   profiles.dsa_score
--
-- DROP ORDER: children before parents to respect foreign key constraints.
-- CASCADE is used as a final safety net.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Drop leaf tables first (tables with no dependents)
-- =============================================================================

-- 009 leaves
DROP TABLE IF EXISTS public.interview_answers    CASCADE;
DROP TABLE IF EXISTS public.interview_questions  CASCADE;

-- 011 leaves
DROP TABLE IF EXISTS public.ai_messages          CASCADE;
DROP TABLE IF EXISTS public.rag_document_chunks  CASCADE;

-- 008 leaf
DROP TABLE IF EXISTS public.application_events   CASCADE;

-- 005 leaf
DROP TABLE IF EXISTS public.roadmap_tasks        CASCADE;

-- =============================================================================
-- STEP 2: Drop mid-level tables (depend on parents dropped in Step 3)
-- =============================================================================

-- 009 parent
DROP TABLE IF EXISTS public.interviews           CASCADE;

-- 011 parents
DROP TABLE IF EXISTS public.ai_conversations     CASCADE;
DROP TABLE IF EXISTS public.rag_documents        CASCADE;

-- 010
DROP TABLE IF EXISTS public.readiness_scores     CASCADE;

-- 008 parent
DROP TABLE IF EXISTS public.applications         CASCADE;

-- 005 mid-level
DROP TABLE IF EXISTS public.roadmap_stages       CASCADE;

-- =============================================================================
-- STEP 3: Drop root-level tables
-- =============================================================================

-- 005 root (roadmaps references job_matches and job_postings)
DROP TABLE IF EXISTS public.roadmaps             CASCADE;

-- 004 (job_matches before job_postings, job_matches references both)
DROP TABLE IF EXISTS public.job_matches          CASCADE;
DROP TABLE IF EXISTS public.job_postings         CASCADE;

-- 005 root (learning_resources referenced by roadmap_tasks, now dropped)
DROP TABLE IF EXISTS public.learning_resources   CASCADE;

-- =============================================================================
-- STEP 4: Drop orphaned ENUM types
-- (These must be dropped AFTER all tables using them are gone)
-- =============================================================================

DROP TYPE IF EXISTS public.application_status;
DROP TYPE IF EXISTS public.interview_type;
DROP TYPE IF EXISTS public.interview_status;

-- =============================================================================
-- STEP 5: Drop the orphaned column from profiles
-- =============================================================================

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS dsa_score;

-- =============================================================================
-- STEP 6: Verify — sanity check that core tables are untouched
-- (Will raise an error and roll back the transaction if any are missing)
-- =============================================================================

DO $$
BEGIN
  -- Core tables that must still exist after this migration
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    RAISE EXCEPTION 'SAFETY ABORT: profiles table is missing after migration 017!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resumes') THEN
    RAISE EXCEPTION 'SAFETY ABORT: resumes table is missing after migration 017!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'resume_job_analysis') THEN
    RAISE EXCEPTION 'SAFETY ABORT: resume_job_analysis table is missing after migration 017!';
  END IF;

  -- NOTE: resume_versions and notifications were intentionally dropped in
  -- migration 020 (cover_letters_and_cleanup). They are no longer core tables.

  RAISE NOTICE 'Migration 017 safety check PASSED — all core Resume Intelligence tables are intact.';
END $$;

COMMIT;
