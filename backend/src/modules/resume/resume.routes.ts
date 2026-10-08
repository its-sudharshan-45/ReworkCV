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

export const resumeRouter = Router();

resumeRouter.post('/', authBurstLimiter, asyncHandler(requireAuth), resumeUpload, asyncHandler(uploadResume));
resumeRouter.get('/', asyncHandler(requireAuth), asyncHandler(listResumes));
resumeRouter.get('/:id', asyncHandler(requireAuth), asyncHandler(getResume));
resumeRouter.post('/:id/process', aiLimiter, asyncHandler(requireAuth), asyncHandler(processResume));
resumeRouter.post('/:id/analyze-job', aiLimiter, asyncHandler(requireAuth), asyncHandler(analyzeResumeForJob));
resumeRouter.get('/:id/job-analyses', asyncHandler(requireAuth), asyncHandler(listJobAnalyses));
resumeRouter.get('/:id/job-analyses/latest', asyncHandler(requireAuth), asyncHandler(getLatestJobAnalysis));
resumeRouter.get('/:id/job-analyses/:analysisId', asyncHandler(requireAuth), asyncHandler(getJobAnalysis));
resumeRouter.get('/:id/report/pdf', asyncHandler(requireAuth), asyncHandler(exportReportPdf));
resumeRouter.delete('/:id', asyncHandler(requireAuth), asyncHandler(deleteResume));
