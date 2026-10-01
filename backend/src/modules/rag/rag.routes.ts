import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  analyzeWithRag,
  deleteDocument,
  ingestDocument,
  reindexKnowledge,
  searchKnowledge,
} from './rag.controller.js';

export const ragRouter = Router();

ragRouter.post('/search', asyncHandler(requireAuth), asyncHandler(searchKnowledge));
ragRouter.post('/analyze', asyncHandler(requireAuth), asyncHandler(analyzeWithRag));
// Admin-only: ingestion / reindex / delete are guarded by x-admin-api-key
// inside the controller and never exposed to normal users.
ragRouter.post('/ingest', asyncHandler(ingestDocument));
ragRouter.post('/reindex', asyncHandler(reindexKnowledge));
ragRouter.delete('/documents/:id', asyncHandler(deleteDocument));
