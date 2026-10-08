import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  generateCoverLetter,
  listCoverLetters,
  getCoverLetter,
  updateCoverLetter,
  rewriteCoverLetter,
  deleteCoverLetter,
  exportCoverLetter,
} from './cover-letter.controller.js';

export const coverLetterRouter = Router();

coverLetterRouter.post('/', asyncHandler(requireAuth), asyncHandler(generateCoverLetter));
coverLetterRouter.get('/', asyncHandler(requireAuth), asyncHandler(listCoverLetters));
coverLetterRouter.get('/:id', asyncHandler(requireAuth), asyncHandler(getCoverLetter));
coverLetterRouter.patch('/:id', asyncHandler(requireAuth), asyncHandler(updateCoverLetter));
coverLetterRouter.post('/:id/rewrite', asyncHandler(requireAuth), asyncHandler(rewriteCoverLetter));
coverLetterRouter.delete('/:id', asyncHandler(requireAuth), asyncHandler(deleteCoverLetter));
coverLetterRouter.get('/:id/export', asyncHandler(requireAuth), asyncHandler(exportCoverLetter));
coverLetterRouter.get('/:id/export/:format', asyncHandler(requireAuth), asyncHandler(exportCoverLetter));
