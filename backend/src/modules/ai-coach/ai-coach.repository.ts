import { getSupabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../utils/errors.js';

// ---------------------------------------------------------------------------
// Persistence for AI Coach conversations. Uses the Supabase admin client
// (RLS bypass) with explicit per-query ownership filters, mirroring the
// existing repository pattern. A conversation is always scoped to one user,
// one resume and one analysis.
// ---------------------------------------------------------------------------

export interface AiCoachConversationRecord {
  id: string;
  user_id: string;
  resume_id: string;
  analysis_id: string;
  created_at: string;
  updated_at: string;
}

export interface AiCoachMessageRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export class AiCoachRepository {
  async createConversation(input: {
    userId: string;
    resumeId: string;
    analysisId: string;
  }): Promise<AiCoachConversationRecord> {
    const { data, error } = await getSupabaseAdmin()
      .from('ai_coach_conversations')
      .insert({
        user_id: input.userId,
        resume_id: input.resumeId,
        analysis_id: input.analysisId,
      })
      .select('*')
      .single();

    if (error) {
      throw new AppError('Failed to start coach conversation', 500, 'DATABASE_ERROR');
    }

    return data as AiCoachConversationRecord;
  }

  async findConversationForUser(
    conversationId: string,
    userId: string,
  ): Promise<AiCoachConversationRecord | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('ai_coach_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new AppError('Failed to retrieve coach conversation', 500, 'DATABASE_ERROR');
    }

    return (data as AiCoachConversationRecord | null) ?? null;
  }

  async listMessages(conversationId: string, limit = 50): Promise<AiCoachMessageRecord[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('ai_coach_messages')
      .select('id,conversation_id,role,content,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new AppError('Failed to retrieve coach messages', 500, 'DATABASE_ERROR');
    }

    return (data ?? []) as AiCoachMessageRecord[];
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<AiCoachMessageRecord> {
    const { data, error } = await getSupabaseAdmin()
      .from('ai_coach_messages')
      .insert({ conversation_id: conversationId, role, content })
      .select('id,conversation_id,role,content,created_at')
      .single();

    if (error) {
      throw new AppError('Failed to save coach message', 500, 'DATABASE_ERROR');
    }

    return data as AiCoachMessageRecord;
  }

  async touchConversation(conversationId: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('ai_coach_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      throw new AppError('Failed to update coach conversation', 500, 'DATABASE_ERROR');
    }
  }
}

export const aiCoachRepository = new AiCoachRepository();
