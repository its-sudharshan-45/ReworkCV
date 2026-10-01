import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared RAG types: knowledge base, retrieval, AI insights
// ---------------------------------------------------------------------------

export const KNOWLEDGE_CATEGORIES = [
  'resume_fundamentals',
  'ats',
  'resume_writing',
  'role_guidance',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export interface KnowledgeChunkMeta {
  id: string;
  documentId: string;
  content: string;
  category: string;
  subcategory: string | null;
  role: string | null;
  source: string;
  version: string;
  chunkIndex: number;
}

export interface RetrievedChunk extends KnowledgeChunkMeta {
  similarity: number;
  keywordScore: number;
  combinedScore: number;
}

export interface RetrievalOptions {
  query: string;
  role?: string | null;
  categories?: string[];
  topK?: number;
  similarityThreshold?: number;
}

// ---------------------------------------------------------------------------
// Embedding abstraction (rest of app must depend on this, not a provider)
// ---------------------------------------------------------------------------

export interface EmbeddingService {
  readonly dimensions: number;
  readonly provider: string;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

// ---------------------------------------------------------------------------
// Structured AI-insight output (strict schema; validated before use)
// ---------------------------------------------------------------------------

export const aiInsightStrengthSchema = z.object({
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(1000),
  evidence: z.string().min(1).max(1000),
});

export const aiInsightWeaknessSchema = z.object({
  title: z.string().min(1).max(200),
  explanation: z.string().min(1).max(1000),
  evidence: z.string().min(1).max(1000),
});

export const aiInsightRecommendationSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']),
  area: z.string().min(1).max(100),
  recommendation: z.string().min(1).max(1000),
  reason: z.string().min(1).max(1000),
});

export const aiBulletAnalysisSchema = z.object({
  original: z.string().min(1).max(1000),
  issue: z.string().min(1).max(1000),
  suggestion: z.string().min(1).max(1000),
});

export const aiInsightsSchema = z.object({
  summary: z.string().min(1).max(2000),
  strengths: z.array(aiInsightStrengthSchema).max(8).default([]),
  weaknesses: z.array(aiInsightWeaknessSchema).max(8).default([]),
  recommendations: z.array(aiInsightRecommendationSchema).max(10).default([]),
  bulletAnalysis: z.array(aiBulletAnalysisSchema).max(10).default([]),
  knowledgeReferences: z
    .array(z.object({ documentId: z.string(), chunkId: z.string() }))
    .max(20)
    .default([]),
  ragUsed: z.boolean().default(true),
  ragNote: z.string().max(500).optional(),
  /** Internal: which AI provider generated these insights (debugging/monitoring). */
  provider: z.string().max(50).optional(),
});

export type AiInsights = z.infer<typeof aiInsightsSchema>;

export const DETERMINISTIC_FIELDS = [
  'matchScore',
  'category',
  'breakdown',
  'matchedSkills',
  'missingRequiredSkills',
  'missingPreferredSkills',
  'skillDetail',
  'experienceDetail',
  'educationDetail',
  'responsibilityDetail',
  'keywordDetail',
  'projectDetail',
] as const;

// ---------------------------------------------------------------------------
// API validation
// ---------------------------------------------------------------------------

export const ragSearchSchema = z.object({
  query: z.string().min(1).max(2000),
  role: z.string().max(100).optional(),
  categories: z.array(z.string().max(60)).max(10).optional(),
  topK: z.coerce.number().int().min(1).max(20).default(5),
});

export type RagSearchRequest = z.infer<typeof ragSearchSchema>;

export const ragAnalyzeSchema = z.object({
  resumeId: z.string().uuid().optional(),
  jobTitle: z.string().max(200).optional(),
  jobDescription: z.string().min(10).max(20000),
  resumeText: z.string().min(10).max(30000).optional(),
});

export type RagAnalyzeRequest = z.infer<typeof ragAnalyzeSchema>;

export const ragIngestSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(100000),
  category: z.string().min(1).max(60),
  subcategory: z.string().max(60).optional(),
  role: z.string().max(100).optional(),
  source: z.string().min(1).max(200),
  version: z.string().max(20).default('v1'),
});

export type RagIngestRequest = z.infer<typeof ragIngestSchema>;
