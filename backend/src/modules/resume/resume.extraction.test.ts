import { describe, expect, it, vi } from 'vitest';
import { extractResumeText } from './resume.extraction.service.js';
import { AppError } from '../../utils/errors.js';

// Mock pdf-parse
vi.mock('pdf-parse', () => {
  return {
    default: vi.fn(async (buffer: Buffer) => {
      const str = buffer.toString('utf8');
      if (str.includes('CORRUPTED_PDF')) {
        throw new Error('Invalid PDF structure');
      }
      if (str.includes('SCANNED_IMAGE_ONLY')) {
        return { text: '   ' };
      }
      return { text: str };
    }),
  };
});

describe('extractResumeText', () => {
  it('extracts and normalizes plain text successfully', async () => {
    const text = 'John Doe\nSoftware Engineer\nExperience with React and Node.js';
    const buffer = Buffer.from(text, 'utf8');
    const result = await extractResumeText(buffer, 'text/plain');
    expect(result).toContain('John Doe');
    expect(result).toContain('React and Node.js');
  });

  it('throws 400 VALIDATION_ERROR for empty plain text', async () => {
    const buffer = Buffer.from('   \n\t  ', 'utf8');
    await expect(extractResumeText(buffer, 'text/plain')).rejects.toThrow(AppError);
    await expect(extractResumeText(buffer, 'text/plain')).rejects.toThrow(
      'Resume file contains no readable text or is too short',
    );
  });

  it('throws 400 VALIDATION_ERROR for null-byte-only text', async () => {
    const buffer = Buffer.from('\u0000\u0000\u0000\u0000\u0000', 'utf8');
    await expect(extractResumeText(buffer, 'text/plain')).rejects.toThrow(AppError);
  });

  it('throws 400 VALIDATION_ERROR for plain text shorter than 10 characters', async () => {
    const buffer = Buffer.from('Hi', 'utf8');
    await expect(extractResumeText(buffer, 'text/plain')).rejects.toThrow(AppError);
  });

  it('extracts and normalizes valid PDF resume text', async () => {
    const pdfContent = 'Jane Doe\nSenior Backend Engineer\nExtensive Python and AWS background';
    const buffer = Buffer.from(pdfContent, 'utf8');
    const result = await extractResumeText(buffer, 'application/pdf');
    expect(result).toContain('Jane Doe');
    expect(result).toContain('Senior Backend Engineer');
  });

  it('throws 400 VALIDATION_ERROR for scanned/image-only PDF with truthful message', async () => {
    const buffer = Buffer.from('SCANNED_IMAGE_ONLY', 'utf8');
    await expect(extractResumeText(buffer, 'application/pdf')).rejects.toThrow(
      'Unable to extract text from the PDF resume. The file may be image-only, scanned, or empty.',
    );
  });

  it('throws 400 VALIDATION_ERROR for corrupted PDF with truthful message', async () => {
    const buffer = Buffer.from('CORRUPTED_PDF', 'utf8');
    await expect(extractResumeText(buffer, 'application/pdf')).rejects.toThrow(
      'Failed to extract text from PDF resume: file may be corrupted or unreadable',
    );
  });

  it('throws 400 VALIDATION_ERROR for unsupported file format', async () => {
    const buffer = Buffer.from('some content here that is longer than 10 chars', 'utf8');
    await expect(extractResumeText(buffer, 'image/png')).rejects.toThrow(
      'Unsupported file format. Please upload a PDF or TXT resume.',
    );
  });

  it('rejects Word MIME types without attempting extraction', async () => {
    const buffer = Buffer.from('PK\x03\x04 fake docx content longer than ten', 'utf8');
    await expect(
      extractResumeText(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).rejects.toThrow('Unsupported file format. Please upload a PDF or TXT resume.');
    await expect(extractResumeText(buffer, 'application/msword')).rejects.toThrow(
      'Unsupported file format. Please upload a PDF or TXT resume.',
    );
  });
});
