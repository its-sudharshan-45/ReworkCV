// cspell:ignore msword openxmlformats officedocument wordprocessingml
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
 * Currently supports PDF and UTF-8 plain text.
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

  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/octet-stream'
  ) {
    const raw = buffer.toString('utf8');
    const xmlMatches = raw.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    let text = '';
    if (xmlMatches && xmlMatches.length > 0) {
      text = xmlMatches.map((tag) => tag.replace(/<[^>]+>/g, '')).join(' ');
    } else {
      text = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ');
    }
    const normalized = normalizeExtractedText(text);
    if (!normalized || normalized.length < 10) {
      throw new AppError('Unable to extract text from the Word document', 400, 'VALIDATION_ERROR');
    }
    return enforceExtractedTextCap(normalized, mimeType);
  }

  throw new AppError('Unsupported resume file format', 400, 'VALIDATION_ERROR');
}

function normalizeExtractedText(text: string): string {
  const withoutNulls = text.split('\u0000').join('');

  return withoutNulls
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
