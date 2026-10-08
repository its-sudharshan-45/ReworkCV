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

/** Expected magic bytes per extension — the client-supplied MIME type is
 *  attacker-controlled, so the actual content is verified independently. */
function hasExpectedMagic(buffer: Buffer, extension: string): boolean {
  if (buffer.length < 5) return false;
  switch (extension) {
    case '.pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case '.docx':
      // OOXML is a ZIP archive.
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    case '.doc':
      // OLE compound document, RTF text, or a misnamed OOXML zip.
      return (
        (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) ||
        buffer.subarray(0, 5).toString('ascii') === '{\\rtf' ||
        (buffer[0] === 0x50 && buffer[1] === 0x4b)
      );
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
    case '.doc':
      return mimeType === 'application/msword' || mimeType === 'application/octet-stream';
    case '.docx':
      return (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/octet-stream'
      );
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
      'Unsupported resume file type. Upload a PDF or plain text resume.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const mimeType = file.mimetype.toLowerCase();
  if (!SUPPORTED_RESUME_MIME_TYPES.includes(mimeType as (typeof SUPPORTED_RESUME_MIME_TYPES)[number])) {
    throw new AppError(
      'Unsupported resume MIME type. Upload a PDF or plain text resume.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (!mimeMatchesExtension(mimeType, extension)) {
    throw new AppError(
      'Resume file type and extension do not match. Upload a PDF or plain text resume.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (!hasExpectedMagic(file.buffer, extension)) {
    throw new AppError(
      'Resume file content does not match its declared type. Upload a valid PDF or plain text resume.',
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
