import { z } from 'zod';

// ---------------------------------------------------------------------------
// AI Resume Coach API types. Job description context is resolved server-side
// from the persisted analysis record — the frontend never re-sends it.
// ---------------------------------------------------------------------------

export const aiCoachChatSchema = z.object({
  resumeId: z.string().uuid(),
  analysisId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});

export type AiCoachChatRequest = z.infer<typeof aiCoachChatSchema>;

export type AiCoachSourceType = 'resume' | 'job' | 'analysis' | 'knowledge';

export interface AiCoachSourceRef {
  type: AiCoachSourceType;
  section: string;
}

export interface AiCoachChatResponse {
  message: string;
  sources: AiCoachSourceRef[];
  conversationId: string;
}

export interface AiCoachHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}
