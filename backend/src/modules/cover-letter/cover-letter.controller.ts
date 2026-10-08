import { Request, Response } from 'express';
import { AppError } from '../../utils/errors.js';
import { getRouteParam } from '../../utils/route-params.js';
import { coverLetterService } from './cover-letter.service.js';

export async function generateCoverLetter(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const { resumeId, jobAnalysisId, jobTitle, companyName, jobDescription, tone } = req.body;
  if (!resumeId) {
    throw new AppError('resumeId is required', 400, 'VALIDATION_ERROR');
  }

  const coverLetter = await coverLetterService.generateCoverLetter(req.user.id, {
    resumeId,
    jobAnalysisId,
    jobTitle,
    companyName,
    jobDescription,
    tone,
  });

  res.status(201).json({ coverLetter });
}

export async function listCoverLetters(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const coverLetters = await coverLetterService.listCoverLetters(req.user.id);
  res.status(200).json({ coverLetters });
}

export async function getCoverLetter(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const id = getRouteParam(req.params, 'id');
  const coverLetter = await coverLetterService.getCoverLetter(id, req.user.id);
  res.status(200).json({ coverLetter });
}

export async function updateCoverLetter(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const id = getRouteParam(req.params, 'id');
  const { content } = req.body;
  if (typeof content !== 'string') {
    throw new AppError('content must be a string', 400, 'VALIDATION_ERROR');
  }

  const coverLetter = await coverLetterService.updateCoverLetter(id, req.user.id, { content });
  res.status(200).json({ coverLetter });
}

export async function rewriteCoverLetter(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const id = getRouteParam(req.params, 'id');
  const { feedback } = req.body;
  if (typeof feedback !== 'string') {
    throw new AppError('feedback must be a string', 400, 'VALIDATION_ERROR');
  }

  const coverLetter = await coverLetterService.rewriteCoverLetter(id, req.user.id, { feedback });
  res.status(200).json({ coverLetter });
}

export async function deleteCoverLetter(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const id = getRouteParam(req.params, 'id');
  await coverLetterService.deleteCoverLetter(id, req.user.id);
  res.status(204).send();
}

export async function exportCoverLetter(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }

  const id = getRouteParam(req.params, 'id');
  const rawFormat = (req.query.format as string) || (req.params.format as string) || 'pdf';
  const format = rawFormat.toLowerCase() === 'docx' ? 'docx' : 'pdf';

  const file = await coverLetterService.exportCoverLetter(id, req.user.id, format);

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('Content-Length', file.buffer.length);
  res.status(200).send(file.buffer);
}
