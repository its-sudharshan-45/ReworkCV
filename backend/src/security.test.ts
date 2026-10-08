import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { sanitizeDownloadFilename } from './utils/download.js';
import { validateResumeUpload } from './modules/resume/resume.validation.js';
import { CoverLetterService } from './modules/cover-letter/cover-letter.service.js';
import { AppError } from './utils/errors.js';

vi.mock('./config/supabase.js', () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'test' }, error: null }),
        })),
      })),
    })),
  })),
  createSupabaseClient: vi.fn(),
}));

function pdfFile(name = 'resume.pdf', mime = 'application/pdf', content = '%PDF-1.4 fake') {
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: mime,
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
  } as Express.Multer.File;
}

describe('security hardening', () => {
  it('rejects CORS requests from non-allowlisted origins', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example.com');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('mints a fresh request id for untrusted client-supplied ids', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/health')
      .set('x-request-id', 'not valid!! has spaces and punctuation');

    const returned = response.headers['x-request-id'] as string;
    expect(returned).toBeDefined();
    expect(returned).not.toBe('not valid!! has spaces and punctuation');
    expect(returned).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('neutralizes CRLF and quote injection in download filenames', () => {
    expect(sanitizeDownloadFilename('a"\r\nSet-Cookie: x=1', 'fallback.pdf')).not.toMatch(
      /[\r\n"]/,
    );
    expect(sanitizeDownloadFilename('../../etc/passwd', 'fallback.pdf')).not.toContain('/');
    expect(sanitizeDownloadFilename('', 'fallback.pdf')).toBe('fallback.pdf');
    expect(sanitizeDownloadFilename('John Doe_Cover Letter.pdf', 'fallback.pdf')).toBe(
      'John_Doe_Cover_Letter.pdf',
    );
  });

  it('rejects uploads whose MIME type contradicts the extension', () => {
    expect(() =>
      validateResumeUpload(pdfFile('resume.pdf', 'text/plain', '%PDF-1.4 fake'), 5_242_880),
    ).toThrow(AppError);
  });

  it('rejects polyglot files whose bytes contradict the declared type', () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(() =>
      validateResumeUpload(
        {
          ...pdfFile(),
          buffer: pngBytes,
          size: pngBytes.length,
        },
        5_242_880,
      ),
    ).toThrow(AppError);
  });

  it('rejects admin RAG endpoints without a valid admin key', async () => {
    const app = createApp();
    const response = await request(app).post('/api/v1/rag/ingest').send({
      title: 'x',
      content: 'y',
      category: 'z',
      source: 's',
    });

    expect(response.status).toBe(403);
  });

  it('rejects oversized cover-letter edits before touching the database', async () => {
    const updateContent = vi.fn();
    const service = new CoverLetterService(
      { updateContent } as never,
      {} as never,
    );

    await expect(
      service.updateCoverLetter('id-1', 'user-1', { content: 'a'.repeat(20_001) }),
    ).rejects.toMatchObject({ statusCode: 413 });
    expect(updateContent).not.toHaveBeenCalled();
  });
});
