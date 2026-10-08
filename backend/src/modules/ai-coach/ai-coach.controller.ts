import type { Request, Response } from 'express';
import { AppError } from '../../utils/errors.js';
import { aiCoachService } from './ai-coach.service.js';
import { aiCoachChatSchema } from './ai-coach.types.js';

export async function chatWithCoach(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
  }
  const input = aiCoachChatSchema.parse(req.body);
  const result = await aiCoachService.chat(req.user.id, input);
  res.status(200).json(result);
}
