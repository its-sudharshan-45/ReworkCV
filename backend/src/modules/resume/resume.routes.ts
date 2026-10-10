import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiLimiter, authBurstLimiter } from '../../middleware/rate-limit.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  deleteResume,
  getJobAnalysis,
  getResume,
  listResumes,
  processResume,
  uploadResume,
  analyzeResumeForJob,
  listJobAnalyses,
  getLatestJobAnalysis,
  exportReportPdf,
} from './resume.controller.js';
import { resumeUpload } from './resume.upload.middleware.js';
import { limitUploadConcurrency } from './resume.concurrency.js';

export const resumeRouter = Router();

// Upload + process hold whole documents in RAM: the concurrency guard runs
// before multer parsing (upload) and before storage download (process) so
// excess load fails fast with 429 instead of OOMing the process.
resumeRouter.post(
  '/',
  authBurstLimiter,
  asyncHandler(requireAuth),
  limitUploadConcurrency,
  resumeUpload,
  asyncHandler(uploadResume),
);
resumeRouter.get('/', asyncHandler(requireAuth), asyncHandler(listResumes));
resumeRouter.get('/:id', asyncHandler(requireAuth), asyncHandler(getResume));
resumeRouter.post(
  '/:id/process',
  aiLimiter,
  asyncHandler(requireAuth),
  limitUploadConcurrency,
  asyncHandler(processResume),
);
resumeRouter.post('/:id/analyze-job', aiLimiter, asyncHandler(requireAuth), asyncHandler(analyzeResumeForJob));
resumeRouter.get('/:id/job-analyses', asyncHandler(requireAuth), asyncHandler(listJobAnalyses));
resumeRouter.get('/:id/job-analyses/latest', asyncHandler(requireAuth), asyncHandler(getLatestJobAnalysis));
resumeRouter.get('/:id/job-analyses/:analysisId', asyncHandler(requireAuth), asyncHandler(getJobAnalysis));
resumeRouter.get('/:id/report/pdf', aiLimiter, asyncHandler(requireAuth), asyncHandler(exportReportPdf));
resumeRouter.delete('/:id', asyncHandler(requireAuth), asyncHandler(deleteResume));
