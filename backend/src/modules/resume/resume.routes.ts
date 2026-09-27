import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  deleteResume,
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

resumeRouter.post('/', asyncHandler(requireAuth), resumeUpload, asyncHandler(uploadResume));
resumeRouter.get('/', asyncHandler(requireAuth), asyncHandler(listResumes));
resumeRouter.get('/:id', asyncHandler(requireAuth), asyncHandler(getResume));
resumeRouter.post('/:id/process', asyncHandler(requireAuth), asyncHandler(processResume));
resumeRouter.post('/:id/analyze-job', asyncHandler(requireAuth), asyncHandler(analyzeResumeForJob));
resumeRouter.get('/:id/job-analyses', asyncHandler(requireAuth), asyncHandler(listJobAnalyses));
resumeRouter.get('/:id/job-analyses/latest', asyncHandler(requireAuth), asyncHandler(getLatestJobAnalysis));
resumeRouter.get('/:id/report/pdf', asyncHandler(requireAuth), asyncHandler(exportReportPdf));
resumeRouter.delete('/:id', asyncHandler(requireAuth), asyncHandler(deleteResume));
