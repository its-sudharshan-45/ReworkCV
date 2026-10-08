import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ResumeJobAnalysisService } from './resume-job-analysis.service.js';
import type { ResumeRepository } from './resume.repository.js';
import type { ResumeJobAnalysisRepository } from './resume-job-analysis.repository.js';
import type { ResumeRecord } from './resume.types.js';
import { AppError } from '../../utils/errors.js';
import { aiInsightsService } from '../rag/ai-insights.service.js';

// Mock the RAG/AI layer (network + LLMs); fallback behavior is what's under test.
vi.mock('../rag/ai-insights.service.js', () => ({
  aiInsightsService: {
    generateInsights: vi.fn().mockResolvedValue(null),
    mergeWithDeterministic: vi.fn((deterministic: unknown, insights: unknown) =>
      insights ? { ...(deterministic as object), aiInsights: insights } : deterministic,
    ),
  },
}));

// Short RAG timeout so the timeout test doesn't wait 15s.
vi.mock('../rag/rag.config.js', () => ({
  getRagConfig: vi.fn(() => ({
    enabled: true,
    topK: 5,
    similarityThreshold: 0.1,
    chunkSize: 800,
    chunkOverlap: 100,
    embeddingProvider: 'hash',
    embeddingDimensions: 384,
    maxContextChars: 6000,
    retrievalCacheTtlMs: 300_000,
    timeoutMs: 50,
    adminApiKey: undefined,
  })),
}));

const userId = 'user-123';
const resumeId = '123e4567-e89b-12d3-a456-426614174000';

const FULLSTACK_JD = `# Full Stack Developer

## About the Role
We are hiring a Full Stack Developer (React/Node.js) to join our engineering team!

## Required Skills
- JavaScript/TypeScript, React, Node.js & Express
- PostgreSQL and/or MongoDB
- REST API design; GraphQL is a plus
- Docker, CI/CD (GitHub Actions), AWS

## Preferred Qualifications
- 3+ years of professional experience
- Bachelor's degree in Computer Science
- Strong communication skills & ownership mindset

## Responsibilities
- Build and ship full-stack features end-to-end.
- Collaborate with product/design; mentor junior engineers.
- Improve performance, testing (Jest, Cypress) & code quality.`;

function mockResume(overrides: Partial<ResumeRecord> = {}): ResumeRecord {
  return {
    id: resumeId,
    user_id: userId,
    original_filename: 'resume.pdf',
    storage_path: 'resumes/resume.pdf',
    mime_type: 'application/pdf',
    file_size: 1024,
    processing_status: 'PROCESSED',
    extracted_text: 'Senior Full Stack Developer with React, Node.js, PostgreSQL, Docker and AWS experience.',
    structured_data: {
      sections: [],
      skills: ['React', 'Node.js'],
      structuredResume: {
        personal: { name: 'Dev', email: 'dev@example.com' },
        skills: ['React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
        experience: [
          {
            title: 'Full Stack Developer',
            company: 'Acme',
            startDate: '2020',
            endDate: 'Present',
            description: 'Built apps with React and Node.js',
          },
        ],
        education: [{ degree: 'B.Tech', field: 'CS', institution: 'Uni' }],
        projects: [{ name: 'App', technologies: ['React', 'Node.js'], description: 'Full stack app' }],
        certifications: [],
        languages: [],
      },
    },
    analysis_result: null,
    score: 80,
    failure_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createService(opts: {
  resumeRecord?: ResumeRecord | null;
  createImpl?: (...args: unknown[]) => Promise<unknown>;
  updateImpl?: (...args: unknown[]) => Promise<unknown>;
} = {}) {
  const resumeRepo = {
    findByIdForUser: vi.fn().mockResolvedValue(
      opts.resumeRecord !== undefined ? opts.resumeRecord : mockResume(),
    ),
    updateProcessing: opts.updateImpl
      ? vi.fn(opts.updateImpl)
      : vi.fn().mockResolvedValue(mockResume()),
  } as unknown as ResumeRepository;

  const jobAnalysisRepo = {
    create: opts.createImpl
      ? vi.fn(opts.createImpl)
      : vi.fn().mockResolvedValue({ id: 'analysis-123' }),
  } as unknown as ResumeJobAnalysisRepository;

  return new ResumeJobAnalysisService(resumeRepo, jobAnalysisRepo);
}

async function expectAppError(
  promise: Promise<unknown>,
  statusCode: number,
  code: string,
) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(statusCode);
    expect((err as AppError).code).toBe(code);
    return;
  }
  throw new Error(`Expected AppError ${statusCode}/${code} but request succeeded`);
}

beforeEach(() => {
  vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(null);
});

describe('analyze-job fallback hardening', () => {
  it('completes a full successful analysis with warnings array', async () => {
    const service = createService();
    const res = await service.analyzeResumeForJob(userId, {
      resumeId,
      jobTitle: 'Full Stack Developer',
      jobDescription: 'Seeking Full Stack Developer with React, Node.js and PostgreSQL expertise.',
    });
    expect(res.success).toBe(true);
    expect(res.data.matchScore).toBeGreaterThanOrEqual(0);
    expect(res.analysisId).toBe('analysis-123');
    expect(Array.isArray(res.warnings)).toBe(true);
  });

  it('handles a markdown-heavy Full Stack JD with special characters', async () => {
    const service = createService();
    const res = await service.analyzeResumeForJob(userId, {
      resumeId,
      jobTitle: 'Full Stack Developer',
      jobDescription: FULLSTACK_JD,
    });
    expect(res.success).toBe(true);
    expect(res.data.matchedSkills.length).toBeGreaterThan(0);
  });

  it('rejects a missing JD with INVALID_JOB_DESCRIPTION', async () => {
    const service = createService();
    await expectAppError(
      service.analyzeResumeForJob(userId, { resumeId, jobDescription: undefined as never }),
      400,
      'INVALID_JOB_DESCRIPTION',
    );
  });

  it('rejects a short JD with INVALID_JOB_DESCRIPTION', async () => {
    const service = createService();
    await expectAppError(
      service.analyzeResumeForJob(userId, { resumeId, jobDescription: 'hire dev' }),
      400,
      'INVALID_JOB_DESCRIPTION',
    );
  });

  it('rejects an oversized JD with 413 INVALID_JOB_DESCRIPTION', async () => {
    const service = createService();
    await expectAppError(
      service.analyzeResumeForJob(userId, { resumeId, jobDescription: 'a'.repeat(20001) }),
      413,
      'INVALID_JOB_DESCRIPTION',
    );
  });

  it('rejects an invalid resume id with RESUME_NOT_FOUND', async () => {
    const service = createService();
    await expectAppError(
      service.analyzeResumeForJob(userId, {
        resumeId: 'not-a-uuid',
        jobDescription: 'Seeking developer with React skills and Node.js experience.',
      }),
      400,
      'RESUME_NOT_FOUND',
    );
  });

  it('returns RESUME_NOT_FOUND when the resume does not belong to the user', async () => {
    const service = createService({ resumeRecord: null });
    await expectAppError(
      service.analyzeResumeForJob(userId, {
        resumeId,
        jobDescription: 'Seeking developer with React skills and Node.js experience.',
      }),
      404,
      'RESUME_NOT_FOUND',
    );
  });

  it('returns RESUME_NOT_PROCESSED for an unprocessed resume', async () => {
    const service = createService({
      resumeRecord: mockResume({ processing_status: 'FAILED', failure_reason: 'NER blew up' }),
    });
    await expectAppError(
      service.analyzeResumeForJob(userId, {
        resumeId,
        jobDescription: 'Seeking developer with React skills and Node.js experience.',
      }),
      400,
      'RESUME_NOT_PROCESSED',
    );
  });

  it('returns RESUME_TEXT_EMPTY when resume text is missing', async () => {
    const service = createService({
      resumeRecord: mockResume({ extracted_text: '   ' }),
    });
    await expectAppError(
      service.analyzeResumeForJob(userId, {
        resumeId,
        jobDescription: 'Seeking developer with React skills and Node.js experience.',
      }),
      400,
      'RESUME_TEXT_EMPTY',
    );
  });

  it('still succeeds with warnings when the AI provider fails', async () => {
    vi.mocked(aiInsightsService.generateInsights).mockRejectedValueOnce(new Error('AI down'));
    const service = createService();
    const res = await service.analyzeResumeForJob(userId, {
      resumeId,
      jobDescription: 'Seeking developer with React skills and Node.js experience.',
    });
    expect(res.success).toBe(true);
    expect(res.data.matchScore).toBeGreaterThanOrEqual(0);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings[0]).toMatch(/deterministic/i);
  });

  it('still succeeds with warnings when RAG times out', async () => {
    vi.mocked(aiInsightsService.generateInsights).mockImplementationOnce(
      () => new Promise(() => {}) as never,
    );
    const service = createService();
    const res = await service.analyzeResumeForJob(userId, {
      resumeId,
      jobDescription: 'Seeking developer with React skills and Node.js experience.',
    });
    expect(res.success).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('still succeeds with warnings on malformed AI output', async () => {
    vi.mocked(aiInsightsService.generateInsights).mockRejectedValueOnce(
      new Error('AI_SCHEMA_VALIDATION_FAILED: summary required'),
    );
    const service = createService();
    const res = await service.analyzeResumeForJob(userId, {
      resumeId,
      jobDescription: 'Seeking developer with React skills and Node.js experience.',
    });
    expect(res.success).toBe(true);
    expect(res.data.matchScore).toBeGreaterThanOrEqual(0);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('keeps deterministic scores when AI insights merge', async () => {
    const fakeInsights = {
      summary: 'RAG contextual summary.',
      strengths: [],
      weaknesses: [],
      recommendations: [],
      bulletAnalysis: [],
      knowledgeReferences: [],
      ragUsed: true,
    };
    vi.mocked(aiInsightsService.generateInsights).mockResolvedValueOnce(fakeInsights as never);
    const service = createService();
    const res = await service.analyzeResumeForJob(userId, {
      resumeId,
      jobDescription: 'Seeking developer with React skills and Node.js experience.',
    });
    expect(res.success).toBe(true);
    expect(res.data.matchScore).toBeGreaterThanOrEqual(0);
    expect(res.data.aiInsights?.summary).toBe('RAG contextual summary.');
  });

  it('maps a deterministic engine crash to DETERMINISTIC_ANALYSIS_FAILED', async () => {
    const broken = mockResume();
    (broken.structured_data as unknown as { structuredResume: { skills: null } }).structuredResume.skills =
      null as never;
    const service = createService({ resumeRecord: broken });
    await expectAppError(
      service.analyzeResumeForJob(userId, {
        resumeId,
        jobDescription: 'Seeking developer with React skills and Node.js experience.',
      }),
      500,
      'DETERMINISTIC_ANALYSIS_FAILED',
    );
  });

  it('maps a persistence failure to REPORT_BUILD_FAILED', async () => {
    const service = createService({
      createImpl: async () => {
        throw new Error('connection refused');
      },
    });
    await expectAppError(
      service.analyzeResumeForJob(userId, {
        resumeId,
        jobDescription: 'Seeking developer with React skills and Node.js experience.',
      }),
      500,
      'REPORT_BUILD_FAILED',
    );
  });

  it('still succeeds when the non-critical resume score sync fails', async () => {
    const service = createService({
      updateImpl: async () => {
        throw new Error('db write failed');
      },
    });
    const res = await service.analyzeResumeForJob(userId, {
      resumeId,
      jobDescription: 'Seeking developer with React skills and Node.js experience.',
    });
    expect(res.success).toBe(true);
    expect(res.analysisId).toBe('analysis-123');
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});
