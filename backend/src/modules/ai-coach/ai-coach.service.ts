import { aiService } from '../../ai/ai.service.js';
import type { AiCompletionOptions, AiCompletionResult } from '../../ai/ai.types.js';
import type { JobMatchAnalysis } from '../../ai/job/job-types.js';
import type { StructuredResume } from '../../ai/resume/resume-types.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/errors.js';
import { normalizeRole, ragRetrievalService } from '../rag/retrieval.service.js';
import type { RetrievedChunk, RetrievalOptions } from '../rag/rag.types.js';
import { sanitizeUntrustedData, wrapUntrusted } from '../rag/prompt-guard.js';
import { resumeRepository, type ResumeRepository } from '../resume/resume.repository.js';
import {
  resumeJobAnalysisRepository,
  type ResumeJobAnalysisRepository,
} from '../resume/resume-job-analysis.repository.js';
import { aiCoachRepository, type AiCoachRepository } from './ai-coach.repository.js';
import type {
  AiCoachChatRequest,
  AiCoachChatResponse,
  AiCoachHistoryMessage,
  AiCoachSourceRef,
} from './ai-coach.types.js';

// ---------------------------------------------------------------------------
// AI Resume Coach: RAG-grounded Q&A over the user's own resume, job
// description and persisted analysis, plus the shared knowledge base.
// Reuses: ownership-checked repositories, hybrid retrieval, prompt guards
// and the central aiService provider router (Groq/Claude/OpenAI/local with
// backend-only provider selection). No new auth, no new vector store.
// ---------------------------------------------------------------------------

export const AI_COACH_SYSTEM_PROMPT = `You are the AI Resume Coach for Rework CV.

Your purpose is to help users improve their resume for the specific job they are applying for.

Use the provided resume, job description, resume analysis and retrieved resume-writing knowledge.

Never invent experience, skills, achievements, metrics, qualifications or employment history.

When suggesting improvements, preserve factual accuracy.

When rewriting resume content:
- Improve clarity
- Improve specificity
- Use strong action verbs
- Highlight genuine technical contributions
- Use relevant job-description terminology naturally
- Avoid keyword stuffing
- Never fabricate metrics

Clearly distinguish between:
1. What already exists in the resume
2. What should be improved
3. What could be added if the user genuinely has the relevant experience

Keep responses concise, practical and actionable. Use markdown formatting with short sections and bullet lists where it helps readability.

If the question is unrelated to resume or job application improvement, politely redirect the user to the purpose of the AI Resume Coach.`;

/** Bounded chat history sent to the LLM (newest first trimming). */
export const AI_COACH_MAX_HISTORY_MESSAGES = 10;
/** Per-message truncation inside the LLM context window. */
const HISTORY_MESSAGE_CHARS = 500;
const HISTORY_BLOCK_CHARS = 3000;
/** Knowledge chunks retrieved per coach question. */
const KB_TOP_K = 4;
/** Hard caps for deterministic context blocks. */
const RESUME_FACTS_CHARS = 3500;
const JD_FACTS_CHARS = 2500;
const ANALYSIS_FACTS_CHARS = 2500;

type CoachIntent =
  | 'skills'
  | 'keywords'
  | 'summary'
  | 'projects'
  | 'experience'
  | 'education'
  | 'ats'
  | 'score';

const INTENT_PATTERNS: Array<{ intent: CoachIntent; pattern: RegExp }> = [
  { intent: 'skills', pattern: /\b(skill|skills|stack|technolog|proficien|missing|gap|lack)\b/i },
  { intent: 'keywords', pattern: /\b(keyword|keywords|ats\b|keyword stuffing)\b/i },
  { intent: 'summary', pattern: /\b(summar|objective|profile|headline|about me)\b/i },
  { intent: 'projects', pattern: /\b(project|projects|portfolio|side project|github)\b/i },
  { intent: 'experience', pattern: /\b(experience|experiences|work history|employment|job history|role|bullet|bullets|rewrite|rewrote)\b/i },
  { intent: 'education', pattern: /\b(education|degree|university|college|school|certification|certifications)\b/i },
  { intent: 'ats', pattern: /\b(ats|applicant tracking|parse|parsing|format|formatting|layout|recruiter|screen)\b/i },
  { intent: 'score', pattern: /\b(score|match|low|weak|strong|strongest|improve|improvement|first|priorit|action verb|quantif|measur)\b/i },
];

const INTENT_KB_CATEGORIES: Record<CoachIntent, string[]> = {
  skills: ['resume_fundamentals', 'ats'],
  keywords: ['ats'],
  summary: ['resume_fundamentals'],
  projects: ['resume_fundamentals', 'resume_writing'],
  experience: ['resume_fundamentals', 'resume_writing'],
  education: ['resume_fundamentals'],
  ats: ['ats'],
  score: ['ats', 'resume_writing'],
};

export function detectCoachIntents(message: string): CoachIntent[] {
  const intents = INTENT_PATTERNS.filter(({ pattern }) => pattern.test(message)).map(({ intent }) => intent);
  return intents.length > 0 ? [...new Set(intents)] : ['score'];
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function joinLines(lines: Array<string | null | undefined>): string {
  return lines.filter((l): l is string => !!l && l.trim().length > 0).join('\n');
}

interface ResumeFactsInput {
  structured: StructuredResume | null;
  sections: Array<{ key: string; title: string; content: string }>;
  extractedText: string | null;
  intents: CoachIntent[];
}

function buildResumeFacts(input: ResumeFactsInput): { text: string; sections: string[] } {
  const used: string[] = [];
  const lines: string[] = [];
  const wants = (key: string) => {
    if (input.intents.includes('score')) return true;
    if (key === 'skills') return input.intents.includes('skills') || input.intents.includes('keywords');
    if (key === 'summary') return input.intents.includes('summary');
    if (key === 'projects') return input.intents.includes('projects');
    if (key === 'experience') return input.intents.includes('experience');
    if (key === 'education') return input.intents.includes('education');
    return false;
  };

  const s = input.structured;
  if (s) {
    if (wants('summary') && s.summary) {
      lines.push(`Summary: ${truncate(s.summary, 600)}`);
      used.push('summary');
    }
    if (wants('skills') && s.skills.length > 0) {
      lines.push(`Skills: ${s.skills.slice(0, 30).join(', ')}`);
      used.push('skills');
    }
    if (wants('experience')) {
      s.experience.slice(0, 5).forEach((e, i) => {
        lines.push(
          `Experience ${i + 1}: ${e.title ?? '?'} at ${e.company ?? '?'} — ${truncate(e.description ?? '', 300)}`,
        );
      });
      if (s.experience.length > 0) used.push('experience');
    }
    if (wants('projects')) {
      s.projects.slice(0, 5).forEach((p, i) => {
        lines.push(
          `Project ${i + 1}: ${p.name ?? '?'} [${(p.technologies ?? []).join(', ')}] — ${truncate(p.description ?? '', 300)}`,
        );
      });
      if (s.projects.length > 0) used.push('projects');
    }
    if (wants('education') && s.education.length > 0) {
      lines.push(
        `Education: ${s.education.map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(' ')).join('; ')}`,
      );
      used.push('education');
    }
  }

  // Fall back to raw section text for intents with no structured data.
  for (const section of input.sections) {
    if (lines.join('\n').length > RESUME_FACTS_CHARS - 400) break;
    if (section.key === 'experience' && wants('experience') && !used.includes('experience') && section.content) {
      lines.push(`Experience section: ${truncate(section.content, 900)}`);
      used.push('experience');
    }
    if (section.key === 'projects' && wants('projects') && !used.includes('projects') && section.content) {
      lines.push(`Projects section: ${truncate(section.content, 900)}`);
      used.push('projects');
    }
    if (section.key === 'summary' && wants('summary') && !used.includes('summary') && section.content) {
      lines.push(`Summary section: ${truncate(section.content, 500)}`);
      used.push('summary');
    }
  }

  if (lines.length === 0 && input.extractedText) {
    lines.push(`Resume excerpt: ${truncate(input.extractedText, 1500)}`);
    used.push('resume_text');
  }

  return { text: truncate(lines.join('\n'), RESUME_FACTS_CHARS), sections: [...new Set(used)] };
}

function buildAnalysisFacts(analysis: JobMatchAnalysis): { text: string; sections: string[] } {
  const used = ['match_score', 'recommendations'];
  const text = joinLines([
    `Match score: ${analysis.matchScore}/100 (${analysis.category})`,
    `Breakdown: skills ${analysis.breakdown.skills}%, experience ${analysis.breakdown.experience}%, responsibilities ${analysis.breakdown.responsibilities}%, keywords ${analysis.breakdown.keywords}%, education ${analysis.breakdown.education}%, projects ${analysis.breakdown.projects}%`,
    analysis.matchedSkills.length > 0 ? `Matched skills: ${analysis.matchedSkills.slice(0, 20).join(', ')}` : null,
    analysis.skillDetail.missingRequired.length > 0
      ? `Missing required skills: ${analysis.skillDetail.missingRequired.join(', ')}`
      : null,
    analysis.skillDetail.missingPreferred.length > 0
      ? `Missing preferred skills: ${analysis.skillDetail.missingPreferred.join(', ')}`
      : null,
    analysis.keywordDetail.missing.length > 0
      ? `Missing keywords: ${analysis.keywordDetail.missing.slice(0, 20).join(', ')}`
      : null,
    analysis.strengths.length > 0 ? `Strengths: ${analysis.strengths.slice(0, 5).join(' | ')}` : null,
    analysis.recommendations.length > 0
      ? `Recommendations: ${analysis.recommendations.slice(0, 6).map((r) => `[${r.priority}] ${truncate(r.text, 220)}`).join(' | ')}`
      : null,
    analysis.experienceDetail?.note ? `Experience note: ${truncate(analysis.experienceDetail.note, 300)}` : null,
  ]);
  if (analysis.keywordDetail.missing.length > 0) used.push('missing_keywords');
  if (analysis.skillDetail.missingRequired.length > 0 || analysis.skillDetail.missingPreferred.length > 0) {
    used.push('missing_skills');
  }
  if (analysis.strengths.length > 0) used.push('strengths');
  return { text: truncate(text, ANALYSIS_FACTS_CHARS), sections: used };
}

export interface AiCoachServiceDeps {
  resumeRepo?: Pick<ResumeRepository, 'findByIdForUser'>;
  jobAnalysisRepo?: Pick<ResumeJobAnalysisRepository, 'findByIdForUser'>;
  coachRepo?: AiCoachRepository;
  retrieve?: (options: RetrievalOptions) => Promise<RetrievedChunk[]>;
  complete?: (options: AiCompletionOptions) => Promise<AiCompletionResult>;
}

export class AiCoachService {
  constructor(private readonly deps: AiCoachServiceDeps = {}) {}

  private get resumeRepo() {
    return this.deps.resumeRepo ?? resumeRepository;
  }

  private get jobAnalysisRepo() {
    return this.deps.jobAnalysisRepo ?? resumeJobAnalysisRepository;
  }

  private get coachRepo() {
    return this.deps.coachRepo ?? aiCoachRepository;
  }

  private async retrieveKb(options: RetrievalOptions): Promise<RetrievedChunk[]> {
    try {
      if (this.deps.retrieve) return await this.deps.retrieve(options);
      return await ragRetrievalService.retrieve(options);
    } catch (err) {
      // RAG failure degrades to deterministic-only context, never breaks chat.
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'AI Coach KB retrieval failed; continuing without knowledge');
      return [];
    }
  }

  private async completeWithLlm(options: AiCompletionOptions): Promise<AiCompletionResult> {
    try {
      if (this.deps.complete) return await this.deps.complete(options);
      return await aiService.complete({ ...options, temperature: options.temperature ?? 0.5, maxTokens: options.maxTokens ?? 800 });
    } catch (err) {
      // Never leak provider internals; surface a friendly retryable error.
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'AI Coach LLM completion failed');
      throw new AppError(
        'Something went wrong while generating your response.',
        503,
        'AI_COACH_UNAVAILABLE',
      );
    }
  }

  async chat(userId: string, input: AiCoachChatRequest): Promise<AiCoachChatResponse> {
    // ---- Ownership: resume -> analysis -> conversation, all scoped to user ----
    const resumeRecord = await this.resumeRepo.findByIdForUser(input.resumeId, userId);
    if (!resumeRecord) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    const analysisRecord = await this.jobAnalysisRepo.findByIdForUser(input.analysisId, userId);
    if (!analysisRecord || analysisRecord.resume_id !== input.resumeId || !analysisRecord.analysis_result) {
      throw new AppError('Job analysis not found', 404, 'NOT_FOUND');
    }

    const analysis = analysisRecord.analysis_result as unknown as JobMatchAnalysis;
    const jobTitle = analysisRecord.job_title ?? undefined;
    const jobDescription: string = analysisRecord.job_description ?? '';

    let conversationId = input.conversationId ?? null;
    if (conversationId) {
      const existing = await this.coachRepo.findConversationForUser(conversationId, userId);
      if (!existing || existing.resume_id !== input.resumeId || existing.analysis_id !== input.analysisId) {
        throw new AppError('Conversation not found', 404, 'NOT_FOUND');
      }
    } else {
      const created = await this.coachRepo.createConversation({
        userId,
        resumeId: input.resumeId,
        analysisId: input.analysisId,
      });
      conversationId = created.id;
    }

    const stored = await this.coachRepo.listMessages(conversationId, 50);
    const history: AiCoachHistoryMessage[] = stored
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-AI_COACH_MAX_HISTORY_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content }));

    // ---- RAG context: deterministic selection + targeted KB retrieval ----
    const intents = detectCoachIntents(input.message);
    const structured = (resumeRecord.structured_data as unknown as {
      structuredResume?: StructuredResume;
      sections?: Array<{ key: string; title: string; content: string }>;
    } | null) ?? null;

    const resumeFacts = buildResumeFacts({
      structured: structured?.structuredResume ?? null,
      sections: Array.isArray(structured?.sections) ? structured.sections : [],
      extractedText: (resumeRecord.extracted_text as string | null) ?? null,
      intents,
    });
    const analysisFacts = buildAnalysisFacts(analysis);

    const jobRequirements = (analysisRecord.job_requirements as unknown as {
      requiredSkills?: string[];
      preferredSkills?: string[];
      responsibilities?: string[];
    } | null) ?? null;
    const jdFacts = truncate(
      joinLines([
        jobTitle ? `Job title: ${jobTitle}` : null,
        jobRequirements?.requiredSkills && jobRequirements.requiredSkills.length > 0
          ? `Required skills: ${jobRequirements.requiredSkills.slice(0, 20).join(', ')}`
          : null,
        jobRequirements?.preferredSkills && jobRequirements.preferredSkills.length > 0
          ? `Preferred skills: ${jobRequirements.preferredSkills.slice(0, 20).join(', ')}`
          : null,
        jobRequirements?.responsibilities && jobRequirements.responsibilities.length > 0
          ? `Responsibilities: ${jobRequirements.responsibilities.slice(0, 6).join(' | ')}`
          : null,
        jobDescription ? `JD excerpt: ${truncate(jobDescription, 1500)}` : null,
      ]),
      JD_FACTS_CHARS,
    );

    const kbCategories = [...new Set(intents.flatMap((intent) => INTENT_KB_CATEGORIES[intent]))];
    const kbChunks = await this.retrieveKb({
      query: `${input.message} ${intents.join(' ')} ${jobTitle ?? ''}`.slice(0, 500),
      categories: kbCategories,
      role: normalizeRole(jobTitle),
      topK: KB_TOP_K,
    });

    const knowledgeBlock =
      kbChunks.length === 0
        ? '<retrieved_knowledge>\nNo relevant knowledge was retrieved. Base your response ONLY on the resume, job description and analysis facts below.\n</retrieved_knowledge>'
        : `<retrieved_knowledge>\n${kbChunks
            .map(
              (c, i) =>
                `[KNOWLEDGE ${i + 1} | category=${c.category} | subcategory=${c.subcategory ?? 'general'}]\n${c.content.slice(0, 700)}`,
            )
            .join('\n\n---\n\n')}\n</retrieved_knowledge>`;

    const historyBlock =
      history.length === 0
        ? ''
        : `\n\n<conversation_history>\n${history
            .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${truncate(m.content, HISTORY_MESSAGE_CHARS)}`)
            .join('\n')}\n</conversation_history>`.slice(0, HISTORY_BLOCK_CHARS);

    const resume = sanitizeUntrustedData(resumeFacts.text || 'No resume facts available.', RESUME_FACTS_CHARS);
    const jd = sanitizeUntrustedData(jdFacts || 'No job description available.', JD_FACTS_CHARS);
    const det = sanitizeUntrustedData(analysisFacts.text, ANALYSIS_FACTS_CHARS);
    const question = sanitizeUntrustedData(input.message, 2000);

    const result = await this.completeWithLlm({
      messages: [
        { role: 'system', content: AI_COACH_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${wrapUntrusted('resume_data', resume)}\n\n${wrapUntrusted('job_description', jd)}\n\n${wrapUntrusted('deterministic_analysis', det)}\n\n${knowledgeBlock}${historyBlock}\n\n<user_question>\n${question.text}\n</user_question>`,
        },
      ],
      temperature: 0.5,
      maxTokens: 800,
      responseFormat: 'text',
    });

    const answer = result.content.trim();
    if (!answer) {
      throw new AppError('Something went wrong while generating your response.', 503, 'AI_COACH_UNAVAILABLE');
    }

    await this.coachRepo.addMessage(conversationId, 'user', input.message);
    await this.coachRepo.addMessage(conversationId, 'assistant', answer);
    await this.coachRepo.touchConversation(conversationId);

    const sources: AiCoachSourceRef[] = [
      ...resumeFacts.sections.map((section) => ({ type: 'resume' as const, section })),
      { type: 'job' as const, section: 'job_description' },
      ...analysisFacts.sections.map((section) => ({ type: 'analysis' as const, section })),
      ...kbChunks.map((c) => ({ type: 'knowledge' as const, section: c.subcategory ?? c.category })),
    ];

    return { message: answer, sources, conversationId };
  }
}

export const aiCoachService = new AiCoachService();
