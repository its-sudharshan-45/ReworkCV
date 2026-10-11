/**
 * Extracts normalized plain text from supported resume file formats.
 * Only PDF and TXT resumes are supported. Word documents (.doc/.docx)
 * are rejected during upload validation before reaching this service.
 */
import pdfParse from 'pdf-parse';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/errors.js';

/**
 * Enforces the defensive extracted-text cap. Documents yielding more text
 * than RESUME_MAX_EXTRACTED_CHARS are pathological (a genuine resume is tens
 * of KB); truncating protects NER parsing CPU and DB storage. Truncation is
 * logged so it is observable, never silent.
 */
function enforceExtractedTextCap(text: string, mimeType: string): string {
  const cap = env.RESUME_MAX_EXTRACTED_CHARS;
  if (text.length <= cap) return text;
  logger.warn(
    { mimeType, extractedChars: text.length, cap },
    'Resume extracted text exceeded cap; truncating',
  );
  return text.slice(0, cap);
}

/**
 * Extracts normalized plain text from supported resume file formats.
 * Only PDF and UTF-8 plain text resumes are supported.
 */
export async function extractResumeText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'text/plain') {
    const raw = buffer.toString('utf8');
    const normalized = normalizeExtractedText(raw);
    if (!normalized || normalized.length < 10) {
      throw new AppError('Resume file contains no readable text or is too short', 400, 'VALIDATION_ERROR');
    }
    return enforceExtractedTextCap(normalized, mimeType);
  }

  if (mimeType === 'application/pdf') {
    // pdf-parse 1.x bundles an old pdf.js that cannot read PDFs with
    // compressed xref streams / object streams (e.g. PDFKit defaults and
    // some modern generators fail with "bad XRef entry"). Such files fall
    // through to the user-friendly corrupted/unreadable error below — this
    // is a parser limitation, not a validation bypass. Do not weaken the
    // magic-byte or MIME checks to accommodate unparseable PDFs.
    try {
      const parsed = await pdfParse(buffer);
      const text = parsed.text?.trim() ?? '';
      const normalized = normalizeExtractedText(text);
      if (!normalized || normalized.length < 10) {
        throw new AppError(
          'Unable to extract text from the PDF resume. The file may be image-only, scanned, or empty.',
          400,
          'VALIDATION_ERROR',
        );
      }
      return enforceExtractedTextCap(normalized, mimeType);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to extract text from PDF resume: file may be corrupted or unreadable',
        400,
        'VALIDATION_ERROR',
      );
    }
  }

  throw new AppError(
    'Unsupported file format. Please upload a PDF or TXT resume.',
    400,
    'VALIDATION_ERROR',
  );
}

function normalizeExtractedText(text: string): string {
  const withoutNulls = text.split('\u0000').join('');

  return withoutNulls
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
