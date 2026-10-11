import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/errors.js';
import {
  SUPPORTED_RESUME_EXTENSIONS,
  SUPPORTED_RESUME_MIME_TYPES,
} from './resume.constants.js';

export interface ValidatedResumeFile {
  originalFilename: string;
  safeFilename: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}

function normalizeExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function normalizeMimeType(mimeType: string | undefined): string {
  return (mimeType ?? '').split(';', 1)[0].trim().toLowerCase();
}

/** Expected magic bytes per extension — the client-supplied MIME type is
 *  attacker-controlled, so the actual content is verified independently.
 *  Only PDF and TXT resumes are supported. */
function hasExpectedMagic(buffer: Buffer, extension: string): boolean {
  if (buffer.length < 5) return false;
  switch (extension) {
    case '.pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case '.txt': {
      // Plain text must not contain NUL bytes or heavy binary content.
      if (buffer.includes(0x00)) return false;
      const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
      let nonText = 0;
      for (const byte of sample) {
        if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f) nonText++;
      }
      return nonText / sample.length < 0.05;
    }
    default:
      return false;
  }
}

/** Declared MIME must agree with the filename extension (blocks type
 *  confusion, e.g. an executable served to the text extractor). */
function mimeMatchesExtension(mimeType: string, extension: string): boolean {
  switch (extension) {
    case '.pdf':
      return mimeType === 'application/pdf';
    case '.txt':
      return mimeType === 'text/plain';
    default:
      return false;
  }
}

/**
 * Validates uploaded resume files before storage or extraction.
 * Rejects unsupported types, oversize files, and unsafe filenames.
 */
export function validateResumeUpload(
  file: Express.Multer.File | undefined,
  maxFileSizeBytes: number,
): ValidatedResumeFile {
  if (!file) {
    throw new AppError('Resume file is required', 400, 'VALIDATION_ERROR');
  }

  if (file.size <= 0) {
    throw new AppError('Resume file is empty', 400, 'VALIDATION_ERROR');
  }

  if (file.size > maxFileSizeBytes) {
    throw new AppError('Resume file exceeds the maximum allowed size', 413, 'VALIDATION_ERROR');
  }

  const extension = normalizeExtension(file.originalname);
  if (!SUPPORTED_RESUME_EXTENSIONS.includes(extension as (typeof SUPPORTED_RESUME_EXTENSIONS)[number])) {
    throw new AppError(
      'Unsupported file format. Please upload a PDF or TXT resume.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const mimeType = normalizeMimeType(file.mimetype);
  if (!SUPPORTED_RESUME_MIME_TYPES.includes(mimeType as (typeof SUPPORTED_RESUME_MIME_TYPES)[number])) {
    throw new AppError(
      'Unsupported file format. Please upload a PDF or TXT resume.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (!mimeMatchesExtension(mimeType, extension)) {
    throw new AppError(
      'Unsupported file format. Please upload a PDF or TXT resume.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (!file.buffer || !hasExpectedMagic(file.buffer, extension)) {
    throw new AppError(
      'Resume file content does not match its declared type. Please upload a valid PDF or TXT resume.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const safeFilename = `${randomUUID()}${extension}`;

  return {
    originalFilename: path.basename(file.originalname),
    safeFilename,
    mimeType,
    fileSize: file.size,
    buffer: file.buffer,
  };
}

export function buildResumeStoragePath(userId: string, resumeId: string, safeFilename: string): string {
  return `${userId}/${resumeId}/${safeFilename}`;
}
