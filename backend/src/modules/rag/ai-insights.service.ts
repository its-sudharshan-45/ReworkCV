import { aiService } from '../../ai/ai.service.js';
import type { JobMatchAnalysis, JobRequirements } from '../../ai/job/job-types.js';
import type { StructuredResume } from '../../ai/resume/resume-types.js';
import { logger } from '../../config/logger.js';
import { buildAnalysisPrompt } from './context-builder.js';
import { getRagConfig } from './rag.config.js';
import { normalizeRole, ragRetrievalService } from './retrieval.service.js';
import { aiInsightsSchema, DETERMINISTIC_FIELDS, type AiInsights, type RetrievedChunk } from './rag.types.js';

// ---------------------------------------------------------------------------
// RAG + AI reasoning layer. Deterministic analysis stays authoritative:
// - deterministic fields are snapshotted and restored after merge
// - LLM output is schema-validated, evidence-checked, never rendered raw
// - any RAG/AI failure degrades to deterministic-only (never throws)
// ---------------------------------------------------------------------------

export interface RagAnalysisInput {
  resume: StructuredResume;
  resumeText?: string;
  jobTitle?: string;
  jobDescription: string;
  jobRequirements: JobRequirements;
  deterministic: JobMatchAnalysis;
}

export interface RagEnhancedAnalysis extends JobMatchAnalysis {
  aiInsights?: AiInsights;
}

function buildTargetedQueries(input: RagAnalysisInput): string[] {
  const role = input.jobTitle || 'the target role';
  const missing = input.deterministic.missingRequiredSkills.slice(0, 4).join(', ') || 'required skills';
  return [
    `How should this candidate's experience be evaluated against ${role} requirements?`,
    `Are these resume bullets sufficiently achievement-oriented and quantified for ${role}?`,
    `Which missing skills (${missing}) matter most for ${role} and how should the gap be addressed?`,
    `Does this professional summary align with ${role} expectations?`,
    `How can this project experience be presented more effectively for ${role}?`,
  ];
}

function summarizeResumeFacts(resume: StructuredResume, resumeText?: string): string {
  const lines: string[] = [];
  lines.push(`Name: ${resume.personal.name ?? 'not detected'}`);
  lines.push(`Contact: ${[resume.personal.email, resume.personal.phone].filter(Boolean).join(' / ') || 'incomplete'}`);
  lines.push(`Summary: ${resume.summary ?? 'none'}`);
  lines.push(`Skills: ${resume.skills.join(', ') || 'none'}`);
  resume.experience.slice(0, 6).forEach((e, i) => {
    lines.push(`Experience ${i + 1}: ${e.title ?? '?'} at ${e.company ?? '?'} (${e.startDate ?? '?'} - ${e.endDate ?? '?'}) — ${(e.description ?? '').slice(0, 500)}`);
  });
  resume.projects.slice(0, 6).forEach((p, i) => {
    lines.push(`Project ${i + 1}: ${p.name ?? '?'} [${(p.technologies ?? []).join(', ')}] — ${(p.description ?? '').slice(0, 400)}`);
  });
  lines.push(`Education: ${resume.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(' ')).join('; ') || 'none'}`);
  if (resumeText) lines.push(`Raw text excerpt: ${resumeText.slice(0, 3000)}`);
  return lines.join('\n');
}

function stripDeterministicFields(parsed: Record<string, unknown>): void {
  for (const field of DETERMINISTIC_FIELDS) delete parsed[field];
}

/** Evidence grounding: recommendation text should reference something real. */
function hasGrounding(rec: { recommendation: string; reason: string }, evidence: string): boolean {
  const hay = evidence.toLowerCase();
  const tokens = `${rec.recommendation} ${rec.reason}`.toLowerCase().split(/[^a-z0-9+#.]+/).filter((t) => t.length > 3);
  const generic = new Set(['resume', 'experience', 'skills', 'section', 'improve', 'better', 'should', 'consider', 'adding']);
  return tokens.some((t) => !generic.has(t) && hay.includes(t));
}

function postValidateInsights(insights: AiInsights, input: RagAnalysisInput, chunks: RetrievedChunk[]): AiInsights {
  const evidence = `${summarizeResumeFacts(input.resume)} ${input.jobDescription}`.toLowerCase();
  const validRefs = new Set(chunks.map((c) => `${c.documentId}::${c.id}`));

  const recommendations = insights.recommendations
    .filter((r) => r.recommendation.trim().length > 10 && r.reason.trim().length > 5)
    .filter((r) => hasGrounding(r, evidence))
    .slice(0, 10);

  const knowledgeReferences = insights.knowledgeReferences
    .filter((ref) => validRefs.has(`${ref.documentId}::${ref.chunkId}`))
    .slice(0, 20);

  return {
    ...insights,
    recommendations,
    knowledgeReferences,
    bulletAnalysis: insights.bulletAnalysis.slice(0, 10),
    strengths: insights.strengths.slice(0, 8),
    weaknesses: insights.weaknesses.slice(0, 8),
  };
}

export class AiInsightsService {
  async generateInsights(input: RagAnalysisInput): Promise<AiInsights | null> {
    const config = getRagConfig();
    if (!config.enabled) return null;

    try {
      const role = normalizeRole(input.jobTitle);
      const queries = buildTargetedQueries(input);
      const chunks = await ragRetrievalService.retrieveForAnalysis(queries, {
        role,
        topK: config.topK,
      });

      const messages = buildAnalysisPrompt({
        resumeFacts: summarizeResumeFacts(input.resume, input.resumeText),
        jobDescriptionFacts: `Target role: ${input.jobTitle ?? 'unspecified'}\nRequired: ${input.jobRequirements.requiredSkills.join(', ')}\nPreferred: ${input.jobRequirements.preferredSkills.join(', ')}\nResponsibilities: ${input.jobRequirements.responsibilities.slice(0, 8).join(' | ')}\nJD excerpt: ${input.jobDescription.slice(0, 4000)}`,
        deterministicAnalysis: JSON.stringify({
          matchScore: input.deterministic.matchScore,
          category: input.deterministic.category,
          breakdown: input.deterministic.breakdown,
          matchedSkills: input.deterministic.matchedSkills,
          missingRequiredSkills: input.deterministic.missingRequiredSkills,
          strengths: input.deterministic.strengths,
          recommendations: input.deterministic.recommendations,
        }).slice(0, 6000),
        analysisQuestion: queries.join('\n'),
        retrievedChunks: chunks,
      });

      const result = await aiService.complete({
        messages,
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: 'json',
        // Validation-triggered fallback: malformed JSON or schema-invalid
        // output marks this provider failed; the router tries the next one.
        // Legitimate content (including empty arrays) passes through.
        validate: (content: string) => {
          const parsed = JSON.parse(content) as Record<string, unknown>;
          stripDeterministicFields(parsed);
          aiInsightsSchema.parse({
            ...parsed,
            ragUsed: chunks.length > 0,
            ragNote: chunks.length === 0 ? 'No relevant knowledge retrieved; insights grounded in deterministic analysis only.' : undefined,
          });
        },
      });
      const parsed = JSON.parse(result.content) as Record<string, unknown>;
      stripDeterministicFields(parsed);
      const validated = aiInsightsSchema.parse({
        ...parsed,
        ragUsed: chunks.length > 0,
        ragNote: chunks.length === 0 ? 'No relevant knowledge retrieved; insights grounded in deterministic analysis only.' : undefined,
        provider: result.provider,
      });
      return postValidateInsights(validated, input, chunks);
    } catch (err) {
      // RAG failure must never break resume analysis. Log safely (no PII).
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), jobTitle: input.jobTitle },
        'RAG AI insights unavailable; continuing with deterministic analysis',
      );
      return null;
    }
  }

  /** Merge AI insights alongside deterministic results without touching scores. */
  mergeWithDeterministic(deterministic: JobMatchAnalysis, aiInsights: AiInsights | null): RagEnhancedAnalysis {
    const snapshot: Record<string, unknown> = {};
    for (const field of DETERMINISTIC_FIELDS) snapshot[field] = (deterministic as unknown as Record<string, unknown>)[field];
    const merged: RagEnhancedAnalysis = { ...deterministic };
    if (aiInsights) merged.aiInsights = aiInsights;
    // Enforce authority: restore every deterministic field verbatim.
    for (const field of DETERMINISTIC_FIELDS) (merged as unknown as Record<string, unknown>)[field] = snapshot[field];
    return merged;
  }
}

export const aiInsightsService = new AiInsightsService();
