import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const mockGetUser = vi.fn();

vi.mock('../../config/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
  createSupabaseClient: vi.fn(),
}));

vi.mock('./resume.repository.js', () => ({
  resumeRepository: {
    findByIdForUser: vi.fn(),
  },
}));

vi.mock('./resume-job-analysis.repository.js', () => ({
  resumeJobAnalysisRepository: {
    findByIdForUser: vi.fn(),
    findLatestByResumeForUser: vi.fn(),
  },
}));

import { resumeRepository } from './resume.repository.js';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const RESUME_ID = '33333333-3333-3333-3333-333333333333';
const ACCESS_TOKEN = 'test-token';

const sampleRecord = {
  id: RESUME_ID,
  user_id: USER_ID,
  original_filename: 'resume.pdf',
  storage_path: `${USER_ID}/${RESUME_ID}/file.pdf`,
  mime_type: 'application/pdf',
  file_size: 1024,
  processing_status: 'PROCESSED' as const,
  extracted_text: 'Software Engineer with TypeScript experience.',
  structured_data: null,
  analysis_result: null,
  score: 80,
  failure_reason: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('Resume report PDF export validation', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'user@example.com' } },
      error: null,
    });
    vi.mocked(resumeRepository.findByIdForUser).mockResolvedValue(sampleRecord);
  });

  it('rejects a malformed analysisId query with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get(`/api/v1/resumes/${RESUME_ID}/report/pdf?analysisId=not-a-uuid`)
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
