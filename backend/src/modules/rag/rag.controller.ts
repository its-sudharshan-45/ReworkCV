import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { parseJobDescription } from '../../ai/job/job-jd-parser.js';
import { matchResumeToJob } from '../../ai/job/resume-job-matcher.js';
import type { StructuredResume } from '../../ai/resume/resume-types.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/errors.js';
import { getRouteParam } from '../../utils/route-params.js';
import { aiInsightsService } from './ai-insights.service.js';
import { knowledgeBaseService } from './knowledge-base.service.js';
import { getRagConfig } from './rag.config.js';
import { clearRetrievalCache, ragRetrievalService } from './retrieval.service.js';
import { ragAnalyzeSchema, ragIngestSchema, ragSearchSchema } from './rag.types.js';

function requireAdmin(req: Request): void {
  const { adminApiKey } = getRagConfig();
  if (!adminApiKey) {
    throw new AppError('RAG admin operations are not configured', 403, 'AUTHORIZATION_ERROR');
  }
  // Constant-time comparison: naive !== leaks the key byte-by-byte to
  // network timing measurements.
  const provided = Buffer.from(req.header('x-admin-api-key') ?? '');
  const expected = Buffer.from(adminApiKey);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new AppError('Admin authorization required', 403, 'AUTHORIZATION_ERROR');
  }
}

export async function searchKnowledge(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  const input = ragSearchSchema.parse(req.body);
  const chunks = await ragRetrievalService.retrieve(input);
  // Internal chunk ids stay server-side; expose content + non-sensitive refs.
  res.status(200).json({
    results: chunks.map((c) => ({
      content: c.content,
      category: c.category,
      subcategory: c.subcategory,
      role: c.role,
      source: c.source,
      similarity: Number(c.similarity.toFixed(4)),
    })),
  });
}

export async function analyzeWithRag(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  const input = ragAnalyzeSchema.parse(req.body);

  // Build a minimal structured resume from raw text when no resumeId is given.
  // Deterministic matching still runs on this extracted structure.
  const { extractRawEntities } = await import('../../ai/resume/resume-ner.js');
  const { buildStructuredResume } = await import('../../ai/resume/resume-normalizer.js');
  const rawEntities = input.resumeText ? await extractRawEntities(input.resumeText) : [];
  const structured: StructuredResume = input.resumeText
    ? buildStructuredResume(input.resumeText, rawEntities)
    : { personal: {}, skills: [], experience: [], education: [], projects: [], certifications: [], languages: [] };

  const jobRequirements = parseJobDescription(input.jobDescription, input.jobTitle);
  const deterministic = matchResumeToJob(structured, jobRequirements);
  const aiInsights = await aiInsightsService.generateInsights({
    resume: structured,
    resumeText: input.resumeText,
    jobTitle: input.jobTitle,
    jobDescription: input.jobDescription,
    jobRequirements,
    deterministic,
  });
  res.status(200).json({ success: true, data: aiInsightsService.mergeWithDeterministic(deterministic, aiInsights) });
}

export async function ingestDocument(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const input = ragIngestSchema.parse(req.body);
  const result = await knowledgeBaseService.ingestDocument(input);
  // The retrieval cache is process-local and keyed on query text: a mutated
  // knowledge base must invalidate it or readers see stale chunks until TTL.
  // (Placed here rather than in the service to avoid a service <-> retrieval
  // import cycle; the seed CLI runs offline with no live cache to clear.)
  if (!result.skippedAsDuplicate) clearRetrievalCache();
  res.status(200).json({ success: true, data: result });
}

export async function reindexKnowledge(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const result = await knowledgeBaseService.ingestSeedCorpus();
  clearRetrievalCache();
  res.status(200).json({ success: true, data: result });
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const id = getRouteParam(req.params, 'id');
  const deleted = await knowledgeBaseService.deleteDocument(id);
  if (!deleted) throw new AppError('Knowledge document not found', 404, 'NOT_FOUND');
  clearRetrievalCache();
  logger.info({ documentId: id }, 'Knowledge document deleted');
  res.status(204).send();
}
