-- 020_cover_letters_and_cleanup.sql
-- Creates cover_letters table for AI Cover Letter generation and cleans up deprecated tables

CREATE TABLE IF NOT EXISTS public.cover_letters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id        UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  job_analysis_id  UUID REFERENCES public.resume_job_analysis(id) ON DELETE SET NULL,
  job_title        TEXT,
  company_name     TEXT,
  job_description  TEXT NOT NULL,
  content          TEXT NOT NULL,
  tone             TEXT NOT NULL DEFAULT 'professional',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cover_letters_user ON public.cover_letters (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cover_letters_resume ON public.cover_letters (resume_id);

ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cover letters"
  ON public.cover_letters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cover letters"
  ON public.cover_letters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cover letters"
  ON public.cover_letters FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cover letters"
  ON public.cover_letters FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS cover_letters_set_updated_at ON public.cover_letters;
CREATE TRIGGER cover_letters_set_updated_at
  BEFORE UPDATE ON public.cover_letters
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Drop obsolete tables if they exist
DROP TABLE IF EXISTS public.resume_versions CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TYPE IF EXISTS public.notification_type CASCADE;
