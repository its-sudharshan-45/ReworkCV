import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  getActiveUploadCount,
  getUploadConcurrencyLimit,
  limitUploadConcurrency,
  resetUploadConcurrencyForTests,
} from './resume.concurrency.js';
import { extractResumeText } from './resume.extraction.service.js';

const mockGetUser = vi.fn();
const mockStorageUpload = vi.fn();

vi.mock('../../config/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        download: vi.fn(),
        remove: vi.fn(),
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

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ACCESS_TOKEN = 'valid-access-token';

function mockReqRes() {
  const req = new EventEmitter() as unknown as Parameters<typeof limitUploadConcurrency>[0];
  const headers: Record<string, string> = {};
  const res = new EventEmitter() as unknown as Parameters<typeof limitUploadConcurrency>[1] & {
    getTestHeader: (name: string) => string | undefined;
  };
  (res as unknown as Record<string, unknown>).setHeader = (name: string, value: string) => {
    headers[name.toLowerCase()] = value;
  };
  (res as unknown as Record<string, unknown>).getTestHeader = (name: string) =>
    headers[name.toLowerCase()];
  return { req, res };
}

/** Occupy one permit with a request/response pair that never terminates. */
function occupyPermit(): { req: EventEmitter; res: EventEmitter } {
  const { req, res } = mockReqRes();
  let nextCalled = false;
  let nextError: unknown;
  limitUploadConcurrency(req, res as never, ((err?: unknown) => {
    nextCalled = true;
    nextError = err;
  }) as never);
  expect(nextCalled).toBe(true);
  expect(nextError).toBeUndefined();
  return { req: req as unknown as EventEmitter, res: res as unknown as EventEmitter };
}

describe('Upload resource protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUploadConcurrencyForTests();
    mockGetUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: 'user@example.com' } },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({ data: { path: 'ok' }, error: null });
  });

  it('exposes a sane default concurrency limit', () => {
    expect(getUploadConcurrencyLimit()).toBeGreaterThanOrEqual(1);
    expect(getUploadConcurrencyLimit()).toBeLessThanOrEqual(64);
    expect(getActiveUploadCount()).toBe(0);
  });

  it('rejects requests beyond the limit with a retryable 429', () => {
    const held: Array<{ req: EventEmitter; res: EventEmitter }> = [];
    for (let i = 0; i < getUploadConcurrencyLimit(); i++) {
      held.push(occupyPermit());
    }
    expect(getActiveUploadCount()).toBe(getUploadConcurrencyLimit());

    const { req, res } = mockReqRes();
    let nextError: unknown;
    limitUploadConcurrency(req, res as never, ((err?: unknown) => {
      nextError = err;
    }) as never);

    expect(nextError).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' });
    expect(
      (res as unknown as { getTestHeader: (n: string) => string | undefined }).getTestHeader(
        'retry-after',
      ),
    ).toBe('5');
    expect(getActiveUploadCount()).toBe(getUploadConcurrencyLimit());

    for (const h of held) h.res.emit('finish');
    expect(getActiveUploadCount()).toBe(0);
  });

  it('releases the permit exactly once on response finish', () => {
    const { res } = occupyPermit();
    expect(getActiveUploadCount()).toBe(1);
    res.emit('finish');
    res.emit('finish');
    res.emit('close');
    expect(getActiveUploadCount()).toBe(0);
  });

  it('releases the permit on aborted responses and client disconnects', () => {
    const first = occupyPermit();
    first.res.emit('close');
    expect(getActiveUploadCount()).toBe(0);

    const second = occupyPermit();
    second.req.emit('close');
    expect(getActiveUploadCount()).toBe(0);
  });

  it('returns 429 with a consistent error shape on the live upload route when saturated', async () => {
    const held: Array<{ req: EventEmitter; res: EventEmitter }> = [];
    for (let i = 0; i < getUploadConcurrencyLimit(); i++) {
      held.push(occupyPermit());
    }

    const app = createApp();
    const response = await request(app)
      .post('/api/v1/resumes')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .attach('file', Buffer.from('%PDF-1.4 sample'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(response.body.error.message).toBeTruthy();
    expect(response.body.error.requestId).toBeTruthy();
    expect(response.headers['retry-after']).toBe('5');
    // Rejected before multer/storage: nothing stored, nothing created.
    expect(mockStorageUpload).not.toHaveBeenCalled();

    for (const h of held) h.res.emit('finish');

    vi.mocked(resumeRepository.create).mockResolvedValue({
      id: 'new-resume-id',
      user_id: USER_ID,
      original_filename: 'resume.pdf',
      storage_path: `${USER_ID}/new-resume-id/resume.pdf`,
      mime_type: 'application/pdf',
      file_size: 14,
      processing_status: 'UPLOADED',
      extracted_text: null,
      structured_data: null,
      analysis_result: null,
      score: null,
      failure_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);

    const retry = await request(app)
      .post('/api/v1/resumes')
      .set('Authorization', `Bearer ${ACCESS_TOKEN}`)
      .attach('file', Buffer.from('%PDF-1.4 sample'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      });

    expect(retry.status).toBe(201);
    expect(getActiveUploadCount()).toBe(0);
  });

  it('caps extracted text from oversized documents', async () => {
    const oversized = `word `.repeat(env.RESUME_MAX_EXTRACTED_CHARS / 5 + 100);
    const text = await extractResumeText(Buffer.from(oversized, 'utf8'), 'text/plain');
    expect(text.length).toBeLessThanOrEqual(env.RESUME_MAX_EXTRACTED_CHARS);
  });

  it('still extracts normal resumes fully', async () => {
    const body = 'Alex Johnson\nalex@example.com\nExperienced software engineer.';
    const text = await extractResumeText(Buffer.from(body, 'utf8'), 'text/plain');
    expect(text).toContain('Alex Johnson');
  });
});
