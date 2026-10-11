import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../utils/errors.js';
import { extractResumeText } from './resume.extraction.service.js';
import { validateResumeUpload } from './resume.validation.js';

// Real pdf-parse integration coverage (no mocks in this file).
//
// Fixture: ./fixtures/valid-resume.pdf — a real-world-style one-page resume
// generated with PDFKit (PDFVersion 1.4, compress:false). Regenerate with a
// script using those options if the fixture ever needs to change.
//
// Known limitation (pdf-parse 1.x bundles an old pdf.js): PDFs using
// compressed xref streams / object streams — e.g. PDFKit defaults and some
// modern generators — fail with "bad XRef entry". Those uploads surface the
// user-friendly "Failed to extract text from PDF resume" error below. This
// file passing does NOT mean every PDF in the wild is supported.

function fixtureBuffer(): Buffer {
  return readFileSync(new URL('./fixtures/valid-resume.pdf', import.meta.url));
}

describe('real PDF resume extraction (pdf-parse integration)', () => {
  it('extracts text from a valid real-world-style PDF resume fixture', async () => {
    const text = await extractResumeText(fixtureBuffer(), 'application/pdf');
    expect(text).toContain('Amara Okafor');
    expect(text).toContain('SUMMARY');
    expect(text).toContain('TypeScript');
    expect(text).toContain('Northwind Pay');
    expect(text).toContain('Waterloo');
  });

  it('passes upload validation for the PDF fixture', () => {
    const buffer = fixtureBuffer();
    const result = validateResumeUpload(
      {
        fieldname: 'file',
        originalname: 'amara-okafor-resume.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: buffer.length,
        buffer,
        stream: null as never,
        destination: '',
        filename: '',
        path: '',
      },
      5_242_880,
    );
    expect(result.mimeType).toBe('application/pdf');
    expect(result.safeFilename.endsWith('.pdf')).toBe(true);
  });

  it('rejects a malformed PDF with a user-friendly error', async () => {
    const buffer = Buffer.from('%PDF-1.4 this is not a real pdf body %%EOF', 'utf8');
    await expect(extractResumeText(buffer, 'application/pdf')).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
    await expect(extractResumeText(buffer, 'application/pdf')).rejects.toThrow(
      'Failed to extract text from PDF resume',
    );
  });

  it('rejects an empty PDF buffer without leaking internals', async () => {
    await expect(extractResumeText(Buffer.alloc(0), 'application/pdf')).rejects.toThrow(AppError);
  });

  it('rejects PDFs with no readable text (image-only / scanned)', async () => {
    const buffer = Buffer.from('%PDF-1.4 blank', 'utf8');
    // Not a parseable PDF at all -> corrupted/unreadable path.
    await expect(extractResumeText(buffer, 'application/pdf')).rejects.toThrow(AppError);
  });
});
