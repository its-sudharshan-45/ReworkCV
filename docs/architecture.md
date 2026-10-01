# Architecture

## Overview

UpSkilr is a monorepo with a Next.js frontend and Express REST API backed by Supabase PostgreSQL.

```text
frontend (Next.js) ──REST──> backend (Express) ──> Supabase (Auth + PostgreSQL)
```

## Backend layers

```text
Routes → Controllers → Services → Repositories → Database
```

- Controllers: HTTP request/response mapping only
- Services: business rules and orchestration
- Repositories: data access

## API conventions

- Base path: `/api/v1`
- JSON request/response bodies
- Structured errors: `{ error: { code, message, details?, requestId? } }`
- Request correlation via `x-request-id` header

## Authentication

- Supabase Auth issues JWT access tokens
- Frontend stores session via `@supabase/ssr`
- Backend validates tokens with Supabase Admin `getUser`
- Authorization uses authenticated user ID; never trust client-provided `userId`

## Environment variables

See root `.env.example`. Frontend variables require `NEXT_PUBLIC_` prefix.

Backend resume storage:

- `RESUME_STORAGE_BUCKET` — private Supabase Storage bucket name (default: `resumes`)
- `RESUME_MAX_FILE_SIZE_BYTES` — maximum upload size in bytes (default: 5242880)

## Resume API (Phase 2)

Authenticated endpoints:

```text
POST   /api/v1/resumes              multipart upload
GET    /api/v1/resumes              list own resumes (metadata only)
GET    /api/v1/resumes/:id           resume detail + analysis
POST   /api/v1/resumes/:id/process  extract, parse, analyze
DELETE /api/v1/resumes/:id          delete record + storage object
```

Resume files are stored in private Supabase Storage. Processing uses deterministic section parsing and scoring (no LLM).

## Job API (Phase 3)

Authenticated endpoints:

```text
POST   /api/v1/jobs
GET    /api/v1/jobs
GET    /api/v1/jobs/:id
POST   /api/v1/jobs/:id/match   body: { resumeId }
DELETE /api/v1/jobs/:id
```

Job requirement extraction and resume-to-job matching use deterministic rules. Match score weights: required skills 70%, preferred skills 20%, section alignment 10%.

## RAG Resume Intelligence

Retrieval-Augmented Generation enhances (never replaces) deterministic analysis:

```text
Resume + JD -> Parser -> Deterministic Analysis -> RAG Retrieval -> AI Reasoning
  -> JSON Schema Validation -> Merge (scores authoritative) -> REPORT_DATA -> UI/PDF
```

- Knowledge base: `knowledge_documents` + `knowledge_chunks` (migration 022, pgvector 384-dim), seeded via `npm run rag:seed`.
- Layers: `EmbeddingService` (default local `hash`, opt-in `transformers`) -> `RagRetrievalService` (vector + keyword + metadata hybrid) -> `AiInsightsService` (single structured LLM call, evidence-grounded, prompt-injection guarded).
- `POST /api/v1/rag/search` and `POST /api/v1/rag/analyze` (auth); `POST /api/v1/rag/ingest|reindex`, `DELETE /api/v1/rag/documents/:id` (admin `x-admin-api-key` only).
- Fallback: any RAG/AI failure (bounded by `RAG_TIMEOUT_MS`) degrades to deterministic-only; existing scans never break.
- Config: `RAG_ENABLED`, `RAG_TOP_K`, `RAG_SIMILARITY_THRESHOLD`, `RAG_CHUNK_SIZE`, `RAG_CHUNK_OVERLAP`, `EMBEDDING_PROVIDER`, `EMBEDDING_DIMENSIONS`, `RAG_MAX_CONTEXT_CHARS`, `RAG_CACHE_TTL_MS`, `RAG_TIMEOUT_MS`.

## Local-first AI + fallback

`AiService` is the central provider router (primary-first, ordered fallback). Default chain: `local → groq → anthropic → openai → deterministic-only`. The local provider (`LocalProvider`) talks to an Ollama-compatible server and needs no cloud API key; cloud keys stay backend-only and optional.

- `AI_PRIMARY_PROVIDER=local`, `AI_FALLBACK_PROVIDERS=groq,anthropic,openai`
- `LOCAL_AI_ENABLED / LOCAL_AI_BASE_URL / LOCAL_AI_MODEL / LOCAL_AI_TIMEOUT_MS`
- Optional per-provider caps: `GROQ_TIMEOUT_MS / ANTHROPIC_TIMEOUT_MS / OPENAI_TIMEOUT_MS` (else `AI_TIMEOUT_MS`); total chain budget `AI_FALLBACK_BUDGET_MS`; outer scan cap `RAG_TIMEOUT_MS`.
- Malformed JSON / schema-invalid output counts as provider failure and triggers fallback; legitimate empty arrays do not. `AiInsightsService` records the winning provider in `aiInsights.provider` (internal metadata).
