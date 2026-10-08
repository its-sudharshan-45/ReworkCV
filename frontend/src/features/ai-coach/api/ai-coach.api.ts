import { authenticatedApiFetch } from '@/lib/api/client';

export interface AiCoachChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
}

export interface AiCoachSource {
  type: 'resume' | 'job' | 'analysis' | 'knowledge';
  section: string;
}

export interface AiCoachChatResult {
  message: string;
  sources: AiCoachSource[];
  conversationId: string;
}

export async function sendCoachMessage(input: {
  resumeId: string;
  analysisId: string;
  message: string;
  conversationId?: string | null;
}): Promise<AiCoachChatResult> {
  return authenticatedApiFetch<AiCoachChatResult>('/ai-coach/chat', {
    method: 'POST',
    body: JSON.stringify({
      resumeId: input.resumeId,
      analysisId: input.analysisId,
      message: input.message,
      conversationId: input.conversationId ?? undefined,
    }),
  });
}
