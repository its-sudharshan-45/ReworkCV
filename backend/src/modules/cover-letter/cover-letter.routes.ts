import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { aiLimiter } from '../../middleware/rate-limit.middleware.js';
import { validateRequest } from '../../middleware/validate.middleware.js';
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
import {
  generateCoverLetterSchema,
  rewriteCoverLetterSchema,
  updateCoverLetterSchema,
} from './cover-letter.validation.js';

export const coverLetterRouter = Router();

coverLetterRouter.post(
  '/',
  aiLimiter,
  asyncHandler(requireAuth),
  validateRequest(generateCoverLetterSchema),
  asyncHandler(generateCoverLetter),
);
coverLetterRouter.get('/', asyncHandler(requireAuth), asyncHandler(listCoverLetters));
coverLetterRouter.get('/:id', asyncHandler(requireAuth), asyncHandler(getCoverLetter));
coverLetterRouter.patch(
  '/:id',
  asyncHandler(requireAuth),
  validateRequest(updateCoverLetterSchema),
  asyncHandler(updateCoverLetter),
);
coverLetterRouter.post(
  '/:id/rewrite',
  aiLimiter,
  asyncHandler(requireAuth),
  validateRequest(rewriteCoverLetterSchema),
  asyncHandler(rewriteCoverLetter),
);
coverLetterRouter.delete('/:id', asyncHandler(requireAuth), asyncHandler(deleteCoverLetter));
// Document generation (pdfkit/DOCX) is CPU-heavy: same AI-cost budget as generation.
coverLetterRouter.get('/:id/export', aiLimiter, asyncHandler(requireAuth), asyncHandler(exportCoverLetter));
coverLetterRouter.get(
  '/:id/export/:format',
  aiLimiter,
  asyncHandler(requireAuth),
  asyncHandler(exportCoverLetter),
);
