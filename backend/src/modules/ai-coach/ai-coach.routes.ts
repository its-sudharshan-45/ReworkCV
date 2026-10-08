import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { chatWithCoach } from './ai-coach.controller.js';

export const aiCoachRouter = Router();

aiCoachRouter.post('/chat', asyncHandler(requireAuth), asyncHandler(chatWithCoach));
