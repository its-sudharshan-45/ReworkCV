import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

// ---------------------------------------------------------------------------
// Upload concurrency guard.
//
// Resume uploads use multer memory storage (up to RESUME_MAX_FILE_SIZE_BYTES
// per file) and the process step downloads + parses the whole document in
// memory. Without a bound, N concurrent uploads hold N x 5MB in RAM plus
// parsing overhead and can OOM a small instance. This in-process semaphore
// caps concurrent memory-intensive resume requests; excess requests fail fast
// with a retryable 429 instead of degrading the whole server.
//
// Single-process by design (same constraint as the RAG retrieval cache).
// Deployments run a single backend replica (see docs/deployment.md), so an
// in-memory counter is coherent. Do not raise the default without sizing RAM:
// worst case ≈ limit × (max file size + extraction overhead).
// ---------------------------------------------------------------------------

let activeUploads = 0;

export function getUploadConcurrencyLimit(): number {
  return env.RESUME_UPLOAD_MAX_CONCURRENT;
}

export function getActiveUploadCount(): number {
  return activeUploads;
}

/** Test-only hook: reset the counter between isolated tests. */
export function resetUploadConcurrencyForTests(): void {
  activeUploads = 0;
}

export function limitUploadConcurrency(req: Request, res: Response, next: NextFunction): void {
  if (activeUploads >= getUploadConcurrencyLimit()) {
    // Tell well-behaved clients (and the frontend retry UI) when to come back.
    res.setHeader('Retry-After', '5');
    next(
      new AppError(
        'The upload server is busy processing other resumes. Please wait a few seconds and try again.',
        429,
        'RATE_LIMITED',
      ),
    );
    return;
  }

  activeUploads += 1;
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    activeUploads = Math.max(0, activeUploads - 1);
  };

  // Exactly-once release across every terminal path: normal completion
  // (finish), aborted/errored responses (close), and client disconnects
  // mid-upload (req close). The guard flag makes duplicate events safe.
  res.on('finish', release);
  res.on('close', release);
  req.on('close', release);

  next();
}
