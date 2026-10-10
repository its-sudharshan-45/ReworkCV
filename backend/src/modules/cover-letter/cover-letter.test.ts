import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const mockGetUser = vi.fn();

vi.mock('../../config/supabase.js', () => {
  const createQueryBuilder = () => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.insert = vi.fn(() => builder);
    builder.update = vi.fn((data: Record<string, unknown>) => {
      if (data?.content) {
        builder.maybeSingle = vi.fn().mockResolvedValue({ data: { ...sampleCoverLetter, content: data.content }, error: null });
      }
      return builder;
    });
    builder.delete = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn().mockResolvedValue({ data: [sampleCoverLetter], error: null });
    builder.single = vi.fn().mockResolvedValue({ data: sampleCoverLetter, error: null });
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: sampleCoverLetter, error: null });
    return builder;
  };

  return {
    getSupabaseAdmin: vi.fn(() => ({
      auth: { getUser: mockGetUser },
      from: vi.fn(() => createQueryBuilder()),
    })),
    createSupabaseClient: vi.fn(),
  };
});

vi.mock('../resume/resume.repository.js', () => ({
  resumeRepository: {
    findByIdForUser: vi.fn(),
  },
}));

vi.mock('../resume/resume-job-analysis.repository.js', () => ({
  resumeJobAnalysisRepository: {
    findByIdForUser: vi.fn(),
    findLatestByResumeForUser: vi.fn(),
  },
}));

vi.mock('../../ai/cover-letter/cover-letter-generator.js', () => ({
  generateCoverLetterText: vi.fn().mockResolvedValue('Dear Hiring Team,\n\nI am thrilled to apply for this role.\n\nSincerely,\nCandidate'),
}));

import { resumeRepository } from '../resume/resume.repository.js';
import { resumeJobAnalysisRepository } from '../resume/resume-job-analysis.repository.js';
import { generateCoverLetterText } from '../../ai/cover-letter/cover-letter-generator.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const RESUME_ID = '22222222-2222-2222-2222-222222222222';
const COVER_LETTER_ID = '33333333-3333-3333-3333-333333333333';
const ACCESS_TOKEN = 'test-token';

const sampleResume = {
  id: RESUME_ID,
  user_id: USER_ID,
  original_filename: 'Software_Engineer.pdf',
  storage_path: 'user/resume.pdf',
  mime_type: 'application/pdf',
  file_size: 1024,
  processing_status: 'PROCESSED' as const,
  extracted_text: 'Experienced Software Engineer with TypeScript and React skills.',
  structured_data: {
    sections: [
      { key: 'experience' as const, title: 'Experience', content: 'Frontend Engineer at TechCorp. Built web apps.' },
      { key: 'skills' as const, title: 'Skills', content: 'TypeScript, React' },
    ],
    skills: ['TypeScript', 'React'],
    structuredResume: {
      personal: { name: 'Alex Johnson', email: 'alex@example.com' },
      skills: ['TypeScript', 'React'],
      experience: [{ title: 'Frontend Engineer', company: 'TechCorp', description: 'Built web apps.' }],
      education: [],
      projects: [],
      certifications: [],
      languages: [],
    },
  },
  analysis_result: null,
  score: 85,
  failure_reason: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const sampleCoverLetter = {
  id: COVER_LETTER_ID,
  user_id: USER_ID,
  resume_id: RESUME_ID,
  job_analysis_id: null,
  job_title: 'Frontend Engineer',
  company_name: 'Acme Corp',
  job_description: 'Looking for a senior frontend developer with React experience.',
  content: 'Dear Hiring Team,\n\nI am thrilled to apply for this role.\n\nSincerely,\nCandidate',
  tone: 'professional',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Cover Letter API & Service', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'user@example.com' } },
      error: null,
    });
    vi.mocked(resumeRepository.findByIdForUser).mockResolvedValue(sampleResume);
    vi.mocked(resumeJobAnalysisRepository.findLatestByResumeForUser).mockResolvedValue(null);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/cover-letters');
    expect(res.status).toBe(401);
  });

  it('generates a cover letter based on resume and job description', async () => {
    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({
        resumeId: RESUME_ID,
        jobTitle: 'Frontend Engineer',
        companyName: 'Acme Corp',
        jobDescription: 'Looking for a senior frontend developer with React experience.',
      });

    expect(res.status).toBe(201);
    expect(res.body.coverLetter).toBeDefined();
    expect(generateCoverLetterText).toHaveBeenCalled();
  });

  it('generates with the analysis job when it belongs to the same resume', async () => {
    vi.mocked(resumeJobAnalysisRepository.findByIdForUser).mockResolvedValueOnce({
      id: 'analysis-1',
      resume_id: RESUME_ID,
      job_description: 'Looking for a senior frontend developer with React experience.',
      job_title: 'Frontend Engineer',
      analysis_result: null,
    } as never);
    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ resumeId: RESUME_ID, jobAnalysisId: 'analysis-1' });

    expect(res.status).toBe(201);
    expect(res.body.coverLetter).toBeDefined();
  });

  it('rejects generation when the analysis belongs to a different resume', async () => {
    vi.mocked(resumeJobAnalysisRepository.findByIdForUser).mockResolvedValueOnce({
      id: 'analysis-1',
      resume_id: 'other-resume-id',
      job_description: 'Some job description text here.',
      job_title: 'Backend Engineer',
      analysis_result: null,
    } as never);
    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ resumeId: RESUME_ID, jobAnalysisId: 'analysis-1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects generation for an unknown job analysis', async () => {
    vi.mocked(resumeJobAnalysisRepository.findByIdForUser).mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ resumeId: RESUME_ID, jobAnalysisId: 'missing-analysis' });

    expect(res.status).toBe(404);
  });

  it('refuses to generate when the resume has no identifiable candidate name', async () => {
    vi.mocked(resumeRepository.findByIdForUser).mockResolvedValueOnce({
      ...sampleResume,
      original_filename: 'cv.pdf',
      extracted_text: 'Just some prose without any identity markers in it here.',
      structured_data: null,
    });
    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({
        resumeId: RESUME_ID,
        jobDescription: 'Looking for a senior frontend developer with React experience.',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists cover letters for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/cover-letters')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.coverLetters).toBeDefined();
  });

  it('gets a specific cover letter by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/cover-letters/${COVER_LETTER_ID}`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.coverLetter.id).toBe(COVER_LETTER_ID);
  });

  it('updates cover letter content', async () => {
    const res = await request(app)
      .patch(`/api/v1/cover-letters/${COVER_LETTER_ID}`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ content: 'Updated content' });

    expect(res.status).toBe(200);
    expect(res.body.coverLetter.content).toBe('Updated content');
  });

  it('rewrites a cover letter with user feedback without inventing new facts', async () => {
    vi.mocked(generateCoverLetterText).mockResolvedValueOnce(
      'Dear Hiring Manager,\n\nI am applying for the Frontend Engineer role. My React work maps directly onto it.\n\nSincerely,\nAlex Johnson',
    );
    const res = await request(app)
      .post(`/api/v1/cover-letters/${COVER_LETTER_ID}/rewrite`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ feedback: 'Make the opening shorter and mention my React work' });

    expect(res.status).toBe(200);
    expect(res.body.coverLetter.content).toContain('I am applying for the Frontend Engineer role');
    expect(generateCoverLetterText).toHaveBeenCalledWith(
      expect.objectContaining({
        previousLetter: expect.stringContaining('Dear Hiring Team'),
        userFeedback: 'Make the opening shorter and mention my React work',
      }),
    );
  });

  it('rejects rewrite feedback that is missing or too short', async () => {
    const missing = await request(app)
      .post(`/api/v1/cover-letters/${COVER_LETTER_ID}/rewrite`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({});
    expect(missing.status).toBe(400);

    const short = await request(app)
      .post(`/api/v1/cover-letters/${COVER_LETTER_ID}/rewrite`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ feedback: 'ok' });
    expect(short.status).toBe(400);
  });

  it('exports cover letter as PDF', async () => {
    const res = await request(app)
      .get(`/api/v1/cover-letters/${COVER_LETTER_ID}/export/pdf`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  it('exports cover letter as DOCX', async () => {
    const res = await request(app)
      .get(`/api/v1/cover-letters/${COVER_LETTER_ID}/export/docx`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('wordprocessingml');
  });

  it('deletes a cover letter', async () => {
    const res = await request(app)
      .delete(`/api/v1/cover-letters/${COVER_LETTER_ID}`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`);

    expect(res.status).toBe(204);
  });

  it('rejects generation with a missing resumeId via schema validation', async () => {
    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ jobDescription: 'Looking for a senior frontend developer with React experience.' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects generation with an overlong job title instead of truncating silently', async () => {
    const res = await request(app)
      .post('/api/v1/cover-letters')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ resumeId: RESUME_ID, jobTitle: 'x'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty content updates via schema validation', async () => {
    const res = await request(app)
      .patch(`/api/v1/cover-letters/${COVER_LETTER_ID}`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
