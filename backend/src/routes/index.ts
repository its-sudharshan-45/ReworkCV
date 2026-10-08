import { Router } from 'express';
import { aiCoachRouter } from '../modules/ai-coach/ai-coach.routes.js';
import { aiModelsRouter } from '../modules/ai-models/ai-models.routes.js';
import { coverLetterRouter } from '../modules/cover-letter/cover-letter.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { profileRouter } from '../modules/profile/profile.routes.js';
import { ragRouter } from '../modules/rag/rag.routes.js';
import { resumeRouter } from '../modules/resume/resume.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/resumes', resumeRouter);
apiRouter.use('/rag', ragRouter);
apiRouter.use('/ai-coach', aiCoachRouter);
apiRouter.use('/cover-letters', coverLetterRouter);
apiRouter.use('/ai/models', aiModelsRouter);
