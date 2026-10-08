import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const mockGetUser = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageDownload = vi.fn();
const mockStorageDelete = vi.fn();

vi.mock('../../config/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        download: mockStorageDownload,
        remove: mockStorageDelete,
      })),
    },
  })),
  createSupabaseClient: vi.fn(),
}));

vi.mock('./resume.repository.js', async () => {
  const actual = await vi.importActual<typeof import('./resume.repository.js')>(
    './resume.repository.js',
  );

  return {
    ...actual,
    resumeRepository: {
      create: vi.fn(),
      findByIdForUser: vi.fn(),
      listByUserId: vi.fn(),
      updateProcessing: vi.fn(),
      deleteByIdForUser: vi.fn(),
    },
  };
});

import { resumeRepository } from './resume.repository.js';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const RESUME_ID = '33333333-3333-3333-3333-333333333333';
const ACCESS_TOKEN = 'valid-access-token';

const sampleRecord = {
  id: RESUME_ID,
  user_id: USER_A,
  original_filename: 'resume.pdf',
  storage_path: `${USER_A}/${RESUME_ID}/file.pdf`,
  mime_type: 'application/pdf',
  file_size: 1024,
  processing_status: 'UPLOADED' as const,
  extracted_text: null,
  structured_data: null,
  analysis_result: null,
  score: null,
  failure_reason: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function authHeader(token = ACCESS_TOKEN) {
  return { Authorization: `Bearer ${token}` };
}

describe('Resume API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_A, email: 'jane@example.com' } },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({ data: { path: 'ok' }, error: null });
    mockStorageDownload.mockResolvedValue({
      data: {
        arrayBuffer: async () => Buffer.from('SUMMARY\nExperienced developer').buffer,
      },
      error: null,
    });
    mockStorageDelete.mockResolvedValue({ data: [], error: null });
  });

  it('returns 401 for unauthenticated upload', async () => {
    const app = createApp();
    const response = await request(app).post('/api/v1/resumes');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('uploads a valid resume for authenticated user', async () => {
    vi.mocked(resumeRepository.create).mockResolvedValue(sampleRecord);

    const app = createApp();
    const response = await request(app)
      .post('/api/v1/resumes')
      .set(authHeader())
      .attach('file', Buffer.from('%PDF-1.4 sample'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    expect(response.body.resume.originalFilename).toBe('resume.pdf');
    expect(mockStorageUpload).toHaveBeenCalled();
  });

  it('lists only authenticated user resumes', async () => {
    vi.mocked(resumeRepository.listByUserId).mockResolvedValue([sampleRecord]);

    const app = createApp();
    const response = await request(app).get('/api/v1/resumes').set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.resumes).toHaveLength(1);
    expect(resumeRepository.listByUserId).toHaveBeenCalledWith(USER_A);
    expect(response.body.resumes[0]).not.toHaveProperty('extractedText');
  });

  it('returns 404 when user requests another users resume', async () => {
    vi.mocked(resumeRepository.findByIdForUser).mockResolvedValue(null);

    const app = createApp();
    const response = await request(app)
      .get(`/api/v1/resumes/${RESUME_ID}`)
      .set(authHeader());

    expect(response.status).toBe(404);
    expect(resumeRepository.findByIdForUser).toHaveBeenCalledWith(RESUME_ID, USER_A);
  });

  it('deletes owned resume and storage object', async () => {
    vi.mocked(resumeRepository.deleteByIdForUser).mockResolvedValue(sampleRecord);

    const app = createApp();
    const response = await request(app)
      .delete(`/api/v1/resumes/${RESUME_ID}`)
      .set(authHeader());

    expect(response.status).toBe(204);
    expect(mockStorageDelete).toHaveBeenCalled();
  });

  it('rejects unsupported upload types', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/resumes')
      .set(authHeader())
      .attach('file', Buffer.from('bad'), {
        filename: 'resume.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('scopes resume access to authenticated identity', async () => {
    vi.mocked(resumeRepository.findByIdForUser).mockResolvedValue(sampleRecord);

    const app = createApp();
    await request(app).get(`/api/v1/resumes/${RESUME_ID}`).set(authHeader());

    expect(resumeRepository.findByIdForUser).toHaveBeenCalledWith(RESUME_ID, USER_A);
    expect(resumeRepository.findByIdForUser).not.toHaveBeenCalledWith(RESUME_ID, USER_B);
  });
});
