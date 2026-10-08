import { Router } from 'express';
import { requireAdminKey } from '../../middleware/admin.middleware.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { adminLimiter } from '../../middleware/rate-limit.middleware.js';
import { aiModelsController } from './ai-models.controller.js';

export const aiModelsRouter = Router();

// GET /api/v1/ai/models — list all registered models
aiModelsRouter.get('/', requireAuth, (req, res, next) => {
  aiModelsController.listModels(req, res).catch(next);
});

// GET /api/v1/ai/models/health — health check across all models
aiModelsRouter.get('/health', requireAuth, (req, res, next) => {
  aiModelsController.getAllModelHealth(req, res).catch(next);
});

// GET /api/v1/ai/models/scan — trigger codebase scan (admin only in production)
aiModelsRouter.get('/scan', adminLimiter, requireAuth, requireAdminKey, (req, res, next) => {
  aiModelsController.scanCodebase(req, res).catch(next);
});

// GET /api/v1/ai/models/drift — check Hub revision drift across all models
aiModelsRouter.get('/drift', adminLimiter, requireAuth, requireAdminKey, (req, res, next) => {
  aiModelsController.checkDrift(req, res).catch(next);
});

// GET /api/v1/ai/models/:id — get specific model details
aiModelsRouter.get('/:id', requireAuth, (req, res, next) => {
  aiModelsController.getModel(req, res).catch(next);
});

// GET /api/v1/ai/models/:id/health — health status for specific model
aiModelsRouter.get('/:id/health', requireAuth, (req, res, next) => {
  aiModelsController.getModelHealth(req, res).catch(next);
});

// GET /api/v1/ai/models/:id/metrics — latency metrics for specific model
aiModelsRouter.get('/:id/metrics', requireAuth, (req, res, next) => {
  aiModelsController.getModelMetrics(req, res).catch(next);
});
