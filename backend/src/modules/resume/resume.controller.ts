import { Request, Response } from 'express';
import { AppError } from '../../utils/errors.js';
import { sanitizeDownloadFilename, setDownloadHeaders } from '../../utils/download.js';
import { getRouteParam } from '../../utils/route-params.js';
import { resumeService } from './resume.service.js';
import { resumeJobAnalysisService } from './resume-job-analysis.service.js';
import { resumeReportExportService } from './resume-report-export.service.js';

export async function uploadResume(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resume = await resumeService.uploadResume(req.user.id, req.file);
  res.status(201).json({ resume });
}

export async function listResumes(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resumes = await resumeService.listResumes(req.user.id);
  res.status(200).json({ resumes });
}

export async function getResume(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resume = await resumeService.getResume(req.user.id, getRouteParam(req.params, 'id'));
  res.status(200).json({ resume });
}

export async function deleteResume(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  await resumeService.deleteResume(req.user.id, getRouteParam(req.params, 'id'));
  res.status(204).send();
}

export async function processResume(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resume = await resumeService.processResume(req.user.id, getRouteParam(req.params, 'id'));
  res.status(200).json({ resume });
}

export async function analyzeResumeForJob(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resumeId = getRouteParam(req.params, 'id');
  const { jobTitle, jobDescription } = (req.body ?? {}) as {
    jobTitle?: string;
    jobDescription: string;
  };

  const result = await resumeJobAnalysisService.analyzeResumeForJob(req.user.id, {
    resumeId,
    jobTitle,
    jobDescription,
  });

  res.status(200).json(result);
}

export async function listJobAnalyses(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resumeId = getRouteParam(req.params, 'id');
  const analyses = await resumeJobAnalysisService.listJobAnalyses(req.user.id, resumeId);

  res.status(200).json({ analyses });
}

export async function getLatestJobAnalysis(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resumeId = getRouteParam(req.params, 'id');
  const analysis = await resumeJobAnalysisService.getLatestJobAnalysis(req.user.id, resumeId);

  res.status(200).json({ analysis });
}

export async function getJobAnalysis(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resumeId = getRouteParam(req.params, 'id');
  const analysisId = getRouteParam(req.params, 'analysisId');
  const analysis = await resumeJobAnalysisService.getJobAnalysis(req.user.id, resumeId, analysisId);

  res.status(200).json({ analysis });
}

export async function exportReportPdf(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const resumeId = getRouteParam(req.params, 'id');
  const resumeDetail = await resumeService.getResume(req.user.id, resumeId);

  // Export the analysis the user is actually viewing when specified;
  // otherwise fall back to the latest analysis for this resume.
  const requestedAnalysisId =
    typeof req.query.analysisId === 'string' && req.query.analysisId.trim()
      ? req.query.analysisId.trim()
      : null;

  let analysisData = null;
  let jobTitle = null;
  if (requestedAnalysisId) {
    const detail = await resumeJobAnalysisService.getJobAnalysis(req.user.id, resumeId, requestedAnalysisId);
    analysisData = detail.data;
    jobTitle = detail.jobTitle;
  } else {
    const latestAnalysis = await resumeJobAnalysisService.getLatestJobAnalysis(req.user.id, resumeId);
    analysisData = latestAnalysis?.data ?? null;
  }

  const buffer = await resumeReportExportService.generateReportPdf(
    resumeDetail,
    analysisData,
    jobTitle,
  );

  const baseName = resumeDetail.originalFilename.replace(/\.[^/.]+$/, '');
  const safeFilename = sanitizeDownloadFilename(`${baseName}_Analysis_Report.pdf`, 'Analysis_Report.pdf');

  setDownloadHeaders(res, {
    filename: safeFilename,
    mimeType: 'application/pdf',
    contentLength: buffer.length,
  });
  res.status(200).send(buffer);
}
