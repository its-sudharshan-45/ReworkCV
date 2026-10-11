-- 025_resume_bucket_mime_restriction.sql
-- Restrict the private `resumes` storage bucket to PDF and TXT uploads.
--
-- Context: Word document (.doc/.docx) resume support is discontinued. Upload
-- validation in the backend already rejects those types before storage, and
-- this migration adds defense-in-depth at the storage layer.
--
-- Scope (forward-only, idempotent, additive):
-- 1. Sets storage.buckets.allowed_mime_types for the `resumes` bucket to
--    {application/pdf, text/plain}. Any other bucket columns (public,
--    file_size_limit, avif_autodetection, ...) are left untouched.
-- 2. Does NOT modify the storage RLS policies from 024, bucket privacy,
--    file-size limits, or user access controls.
-- 3. Does NOT touch existing rows in public.resumes: previously stored Word
--    documents remain listed/deletable by their owners; only new uploads of
--    those types are rejected (at API validation and now at storage).
-- 4. Never edit 024; this file applies cleanly on top of it and is safe to
--    re-run.
--
-- Manual rollback (if Word support ever returns): run an UPDATE setting
-- allowed_mime_types back to NULL (unrestricted) or the wider list.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = 'allowed_mime_types'
  ) THEN
    UPDATE storage.buckets
    SET allowed_mime_types = ARRAY['application/pdf', 'text/plain']
    WHERE id = 'resumes';
  ELSE
    RAISE NOTICE 'storage.buckets.allowed_mime_types column missing; skipping MIME restriction';
  END IF;
END
$$;
