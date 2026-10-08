-- 023_ai_coach_conversations.sql
-- Persists AI Resume Coach conversations scoped to one user, resume and
-- analysis. Messages cascade-delete with their conversation. Rollback:
-- DROP TABLE IF EXISTS public.ai_coach_messages; DROP TABLE IF EXISTS
-- public.ai_coach_conversations.

CREATE TABLE IF NOT EXISTS public.ai_coach_conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id        UUID NOT NULL REFERENCES public.resumes(id) ON DELETE CASCADE,
  analysis_id      UUID NOT NULL REFERENCES public.resume_job_analysis(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_coach_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.ai_coach_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acc_user_resume_analysis
  ON public.ai_coach_conversations (user_id, resume_id, analysis_id);
CREATE INDEX IF NOT EXISTS idx_acm_conversation_created
  ON public.ai_coach_messages (conversation_id, created_at ASC);

-- Enable RLS
ALTER TABLE public.ai_coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coach_messages ENABLE ROW LEVEL SECURITY;

-- Policies: users only ever touch their own conversations. Message access
-- is gated through conversation ownership via a subquery.
CREATE POLICY "Users can view their own coach conversations"
  ON public.ai_coach_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own coach conversations"
  ON public.ai_coach_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coach conversations"
  ON public.ai_coach_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages of their own coach conversations"
  ON public.ai_coach_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_coach_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their own coach conversations"
  ON public.ai_coach_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_coach_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );
