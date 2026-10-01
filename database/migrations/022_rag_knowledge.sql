-- 022_rag_knowledge.sql
-- RAG knowledge base for resume intelligence. Global (non-user) trusted content,
-- stored separately from private user resume data. Reuses pgvector (enabled in 001).

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  category         TEXT NOT NULL,
  subcategory      TEXT,
  role             TEXT,
  source           TEXT NOT NULL,
  version          TEXT NOT NULL DEFAULT 'v1',
  content_hash     TEXT NOT NULL,
  chunk_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, version)
);

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  content          TEXT NOT NULL,
  embedding        vector(384),
  category         TEXT NOT NULL,
  subcategory      TEXT,
  role             TEXT,
  source           TEXT NOT NULL,
  version          TEXT NOT NULL DEFAULT 'v1',
  chunk_index      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kc_document_id ON public.knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_kc_category ON public.knowledge_chunks (category);
CREATE INDEX IF NOT EXISTS idx_kc_role ON public.knowledge_chunks (role);
CREATE INDEX IF NOT EXISTS idx_kc_source_version ON public.knowledge_chunks (source, version);

-- Vector similarity index (ivfflat; lists tuned for a small KB, grows safely).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kc_embedding'
  ) THEN
    CREATE INDEX idx_kc_embedding ON public.knowledge_chunks
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END
$$;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Knowledge base is trusted global content: readable by authenticated users,
-- writable only via service role (ingestion runs server-side).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Knowledge documents readable by authenticated users'
  ) THEN
    CREATE POLICY "Knowledge documents readable by authenticated users"
      ON public.knowledge_documents FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Knowledge chunks readable by authenticated users'
  ) THEN
    CREATE POLICY "Knowledge chunks readable by authenticated users"
      ON public.knowledge_chunks FOR SELECT TO authenticated USING (true);
  END IF;
END
$$;
