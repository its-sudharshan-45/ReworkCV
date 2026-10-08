import { describe, expect, it } from 'vitest';
import { AppError } from '../../utils/errors.js';
import { validateResumeUpload } from './resume.validation.js';

function createFile(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'resume.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('%PDF-1.4 sample'),
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('validateResumeUpload', () => {
  it('accepts supported PDF files', () => {
    const result = validateResumeUpload(createFile({}), 5_242_880);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.safeFilename.endsWith('.pdf')).toBe(true);
  });

  it('rejects missing files', () => {
    expect(() => validateResumeUpload(undefined, 5_242_880)).toThrow(AppError);
  });

  it('rejects unsupported file types', () => {
    expect(() =>
      validateResumeUpload(
        createFile({ originalname: 'resume.png', mimetype: 'image/png' }),
        5_242_880,
      ),
    ).toThrow(AppError);
  });

  it('rejects files above configured limit', () => {
    try {
      validateResumeUpload(createFile({ size: 10_000_000 }), 5_242_880);
      expect.fail('Expected validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(413);
    }
  });
});
