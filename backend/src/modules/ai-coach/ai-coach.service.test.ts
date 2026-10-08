import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/errors.js';
import { AI_COACH_SYSTEM_PROMPT, AiCoachService, detectCoachIntents } from './ai-coach.service.js';

const RESUME_ID = '11111111-1111-1111-1111-111111111111';
const ANALYSIS_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_USER = '44444444-4444-4444-4444-444444444444';
const CONVERSATION_ID = '55555555-5555-5555-5555-555555555555';

function makeAnalysis() {
  return {
    matchScore: 72,
    category: 'Good Match',
    overview: 'Solid backend alignment with gaps in testing.',
    breakdown: { skills: 80, experience: 65, responsibilities: 60, keywords: 70, education: 90, projects: 55 },
    matchedSkills: ['React', 'TypeScript'],
    missingRequiredSkills: ['GraphQL'],
    missingPreferredSkills: ['Docker'],
    skillDetail: {
      matchedRequired: ['React', 'TypeScript'],
      missingRequired: ['GraphQL'],
      matchedPreferred: [],
      missingPreferred: ['Docker'],
      scorePercent: 70,
    },
    experienceDetail: {
      requiredYears: 3,
      detectedProfessionalYears: 2,
      detectedInternshipMonths: 0,
      detectedProjectCount: 2,
      matchLevel: 'partial',
      scorePercent: 60,
      note: 'Partial tenure.',
    },
    educationDetail: { required: [], detected: ['BSc'], matchLevel: 'strong', scorePercent: 90 },
    responsibilityDetail: { matched: ['Build APIs'], unmatched: ['Own on-call rotations'], scorePercent: 60 },
    keywordDetail: { found: ['React'], missing: ['GraphQL', 'Docker'], scorePercent: 70 },
    projectDetail: { relevantProjects: [], scorePercent: 55 },
    strengths: ['Strong React delivery'],
    recommendations: [{ priority: 'high', text: 'Add GraphQL only where genuinely experienced', impact: '+4 points' }],
  };
}

function makeResumeRecord() {
  return {
    id: RESUME_ID,
    extracted_text: 'Jane Doe React TypeScript backend engineer with 2 years experience.',
    structured_data: {
      structuredResume: {
        personal: { name: 'Jane Doe' },
        summary: 'Backend engineer with 2 years of experience.',
        skills: ['React', 'TypeScript', 'Node.js'],
        experience: [{ title: 'Backend Engineer', company: 'Acme', description: 'Built REST APIs serving 10k users.' }],
        projects: [{ name: 'Shop API', technologies: ['Node.js'], description: 'REST API for a storefront.' }],
        education: [{ degree: 'BSc', field: 'CS', institution: 'State U' }],
      },
      sections: [{ key: 'summary', title: 'Summary', content: 'Backend engineer.' }],
    },
  };
}

function makeAnalysisRecord(userId = USER_ID, resumeId = RESUME_ID) {
  return {
    id: ANALYSIS_ID,
    user_id: userId,
    resume_id: resumeId,
    job_title: 'Backend Engineer',
    job_description: 'Seeking a backend engineer with GraphQL and Docker experience.',
    job_requirements: {
      requiredSkills: ['GraphQL', 'Node.js'],
      preferredSkills: ['Docker'],
      responsibilities: ['Build APIs', 'Own on-call rotations'],
    },
    analysis_result: makeAnalysis(),
  };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const completeCalls: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const deps = {
    resumeRepo: {
      findByIdForUser: vi.fn(async (resumeId: string, userId: string) =>
        resumeId === RESUME_ID && userId === USER_ID ? makeResumeRecord() : null,
      ),
    },
    jobAnalysisRepo: {
      findByIdForUser: vi.fn(async (analysisId: string, userId: string) =>
        analysisId === ANALYSIS_ID && userId === USER_ID ? makeAnalysisRecord() : null,
      ),
    },
    coachRepo: {
      createConversation: vi.fn(async () => ({
        id: CONVERSATION_ID,
        user_id: USER_ID,
        resume_id: RESUME_ID,
        analysis_id: ANALYSIS_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      findConversationForUser: vi.fn(async (id: string, userId: string) =>
        id === CONVERSATION_ID && userId === USER_ID
          ? {
              id: CONVERSATION_ID,
              user_id: USER_ID,
              resume_id: RESUME_ID,
              analysis_id: ANALYSIS_ID,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : null,
      ),
      listMessages: vi.fn(async () => messages.map((m, i) => ({
        id: `m-${i}`,
        conversation_id: CONVERSATION_ID,
        role: m.role,
        content: m.content,
        created_at: new Date().toISOString(),
      }))),
      addMessage: vi.fn(async (_id: string, role: 'user' | 'assistant', content: string) => {
        messages.push({ role, content });
        return { id: `m-${messages.length}`, conversation_id: CONVERSATION_ID, role, content, created_at: new Date().toISOString() };
      }),
      touchConversation: vi.fn(async () => undefined),
    },
    retrieve: vi.fn(async () => [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'Use strong action verbs and quantify impact in bullets.',
        category: 'resume_writing',
        subcategory: 'action_verbs',
        role: null,
        source: 'seed',
        version: 'v1',
        chunkIndex: 0,
        similarity: 0.8,
        keywordScore: 0.4,
        combinedScore: 0.68,
      },
    ]),
    complete: vi.fn(async (options: { messages: Array<{ role: string; content: string }> }) => {
      completeCalls.push(options);
      return { content: 'Focus your project bullets on measurable outcomes using verbs like "Architected".', provider: 'groq', model: 'test', latencyMs: 5 };
    }),
    ...overrides,
  };
  return { deps, messages, completeCalls };
}

describe('AI Coach intent detection', () => {
  it('maps questions to resume, JD and analysis intents', () => {
    expect(detectCoachIntents('What skills am I missing?')).toContain('skills');
    expect(detectCoachIntents('Which keywords should I add for ATS?')).toContain('keywords');
    expect(detectCoachIntents('How can I improve my project section?')).toContain('projects');
    expect(detectCoachIntents('Which bullets should I rewrite?')).toContain('experience');
    expect(detectCoachIntents('Why is my match score low?')).toContain('score');
  });

  it('system prompt forbids fabrication', () => {
    expect(AI_COACH_SYSTEM_PROMPT).toMatch(/Never invent/i);
    expect(AI_COACH_SYSTEM_PROMPT).toMatch(/Never fabricate metrics/i);
  });
});

describe('AI Coach chat', () => {
  it('answers with RAG context and source refs without re-uploading', async () => {
    const { deps, completeCalls } = makeDeps();
    const service = new AiCoachService(deps);
    const result = await service.chat(USER_ID, {
      resumeId: RESUME_ID,
      analysisId: ANALYSIS_ID,
      message: 'How can I improve my project section?',
    });

    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(result.message).toContain('measurable outcomes');
    expect(result.sources.some((s) => s.type === 'resume')).toBe(true);
    expect(result.sources.some((s) => s.type === 'analysis')).toBe(true);
    expect(result.sources.some((s) => s.type === 'job')).toBe(true);
    expect(result.sources.some((s) => s.type === 'knowledge' && s.section === 'action_verbs')).toBe(true);

    // Compact, relevant context only — no full dumps.
    const userPrompt = completeCalls[0]!.messages[1]!.content;
    expect(userPrompt).toContain('GraphQL');
    expect(userPrompt).toContain('How can I improve my project section?');
    expect(userPrompt.length).toBeLessThan(12000);
    // History persisted: user + assistant messages saved.
    expect(deps.coachRepo.addMessage).toHaveBeenCalledTimes(2);
  });

  it('reuses an owned conversation and caps history sent to the LLM', async () => {
    const { deps, completeCalls } = makeDeps();
    // Seed 30 prior messages.
    for (let i = 0; i < 15; i++) {
      await deps.coachRepo.addMessage(CONVERSATION_ID, 'user', `Earlier question ${i} about my resume experience and skills`);
      await deps.coachRepo.addMessage(CONVERSATION_ID, 'assistant', `Earlier answer ${i} with guidance`);
    }
    (deps.coachRepo.addMessage as ReturnType<typeof vi.fn>).mockClear();

    const service = new AiCoachService(deps);
    const result = await service.chat(USER_ID, {
      resumeId: RESUME_ID,
      analysisId: ANALYSIS_ID,
      message: 'What should I improve first?',
      conversationId: CONVERSATION_ID,
    });

    expect(result.conversationId).toBe(CONVERSATION_ID);
    expect(deps.coachRepo.createConversation).not.toHaveBeenCalled();
    const historyBlock = completeCalls[0]!.messages[1]!.content;
    expect(historyBlock).toContain('Earlier question 14');
    expect(historyBlock).not.toContain('Earlier question 0');
  });

  it('rejects resumes the user does not own', async () => {
    const { deps } = makeDeps();
    const service = new AiCoachService(deps);
    await expect(
      service.chat(OTHER_USER, { resumeId: RESUME_ID, analysisId: ANALYSIS_ID, message: 'Hi' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects analyses bound to another resume', async () => {
    const { deps } = makeDeps();
    deps.jobAnalysisRepo.findByIdForUser = vi.fn(async () => makeAnalysisRecord(USER_ID, 'other-resume'));
    const service = new AiCoachService(deps);
    await expect(
      service.chat(USER_ID, { resumeId: RESUME_ID, analysisId: ANALYSIS_ID, message: 'Hi' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects conversations owned by another user', async () => {
    const { deps } = makeDeps();
    const service = new AiCoachService(deps);
    await expect(
      service.chat(OTHER_USER, {
        resumeId: RESUME_ID,
        analysisId: ANALYSIS_ID,
        message: 'Hi',
        conversationId: CONVERSATION_ID,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns a friendly error when every provider fails', async () => {
    const { deps } = makeDeps({
      complete: vi.fn(async () => {
        throw new AppError('boom', 503, 'AI_ALL_PROVIDERS_FAILED');
      }),
    });
    const service = new AiCoachService(deps);
    const err = await service.chat(USER_ID, {
      resumeId: RESUME_ID,
      analysisId: ANALYSIS_ID,
      message: 'How can I improve?',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(503);
    expect((err as AppError).message).toBe('Something went wrong while generating your response.');
  });

  it('degrades gracefully when knowledge retrieval fails', async () => {
    const { deps } = makeDeps({
      retrieve: vi.fn(async () => {
        throw new Error('store down');
      }),
    });
    // Retrieval failures degrade to deterministic-only context.
    const service = new AiCoachService(deps);
    const result = await service.chat(USER_ID, {
      resumeId: RESUME_ID,
      analysisId: ANALYSIS_ID,
      message: 'How can I improve my summary?',
    });
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.sources.some((s) => s.type === 'knowledge')).toBe(false);
  });
});
