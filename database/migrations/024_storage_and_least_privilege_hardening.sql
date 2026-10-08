-- 024_storage_and_least_privilege_hardening.sql
-- Production hardening: activate private storage policies for the resumes
-- bucket and remove unnecessary anon grants. Additive and idempotent.
--
-- 1. Storage bucket stays private (public = false).
-- 2. storage.objects policies scope every operation to the caller's own
--    folder: <user_id>/...  (matches backend storage paths).
-- 3. Revoke blanket anon SELECT granted in 012; anon has no RLS policies so
--    this only reduces blast radius. Authenticated keeps RLS-gated access.

-- Private bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage policies (drop-if-exists then create; Postgres has no CREATE POLICY IF NOT EXISTS)
DROP POLICY IF EXISTS resume_storage_select_own ON storage.objects;
CREATE POLICY resume_storage_select_own
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS resume_storage_insert_own ON storage.objects;
CREATE POLICY resume_storage_insert_own
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS resume_storage_update_own ON storage.objects;
CREATE POLICY resume_storage_update_own
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS resume_storage_delete_own ON storage.objects;
CREATE POLICY resume_storage_delete_own
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Least privilege: anon needs no direct table access (no anon RLS policies).
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;
-- Keep USAGE on schema for PostgREST routing; data access stays RLS-gated.
