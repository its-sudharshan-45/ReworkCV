import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { sendCoachMessage, type AiCoachChatMessage } from '@/features/ai-coach/api/ai-coach.api';
import { ApiClientError } from '@/lib/api/client';

export interface AiCoachContextSummary {
  matchScore: number;
  missingSkillsCount: number;
  missingKeywordsCount: number;
  suggestionCount: number;
}

interface AICoachProps {
  resumeId: string | null;
  analysisId: string | null;
  jobTitle?: string;
  contextSummary: AiCoachContextSummary | null;
  messages: AiCoachChatMessage[];
  conversationId: string | null;
  onMessagesChange: (messages: AiCoachChatMessage[]) => void;
  onConversationChange: (conversationId: string | null) => void;
  onContinueToCoverLetter: () => void;
}

const SUGGESTED_QUESTIONS = [
  'How can I improve my project section?',
  'What skills am I missing for this job?',
  'How can I improve my professional summary?',
  'Which resume bullets should I rewrite?',
  'How can I improve my ATS match?',
];

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `msg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm" aria-label="AI is typing">
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#7C3AED]" style={{ animationDelay: '0ms' }} />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#7C3AED]" style={{ animationDelay: '150ms' }} />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#7C3AED]" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

export function AICoach({
  resumeId,
  analysisId,
  jobTitle,
  contextSummary,
  messages,
  conversationId,
  onMessagesChange,
  onConversationChange,
  onContinueToCoverLetter,
}: AICoachProps) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  function friendlyErrorMessage(err: unknown): string {
    if (err instanceof ApiClientError) {
      if (err.status === 401) return 'Your session expired. Please sign in again.';
      return err.message || 'Something went wrong while generating your response.';
    }
    return err instanceof Error && err.message
      ? err.message
      : 'Something went wrong while generating your response.';
  }

  async function send(message: string, attempt = 0): Promise<void> {
    const text = message.trim();
    if (!text || isSending || !resumeId || !analysisId) return;
    setIsSending(true);

    let working = messages;
    // On retry, drop the previous failed assistant message.
    if (attempt > 0) {
      working = working.filter((m) => !m.failed);
    }
    const userMessage: AiCoachChatMessage = { id: makeId(), role: 'user', content: text };
    working = [...working, userMessage];
    onMessagesChange(working);
    setDraft('');

    try {
      const result = await sendCoachMessage({
        resumeId,
        analysisId,
        message: text,
        conversationId,
      });
      onConversationChange(result.conversationId);
      onMessagesChange([
        ...working,
        { id: makeId(), role: 'assistant', content: result.message },
      ]);
    } catch (err) {
      onMessagesChange([
        ...working,
        { id: makeId(), role: 'assistant', content: friendlyErrorMessage(err), failed: true },
      ]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleRetry(failedMessageId: string): void {
    const idx = messages.findIndex((m) => m.id === failedMessageId);
    const lastUser = [...messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
    if (lastUser) void send(lastUser.content, 1);
  }

  function handleCopy(id: string, content: string): void {
    try {
      void navigator.clipboard?.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1400);
    } catch {
      // clipboard unavailable
    }
  }

  function handleNewConversation(): void {
    onMessagesChange([]);
    onConversationChange(null);
    setDraft('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  const canChat = !!resumeId && !!analysisId;
  const hasConversation = messages.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      {/* Header */}
      <section className="shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6" aria-label="AI Resume Coach">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#1E1235]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7C3AED] text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              AI Resume Coach
            </h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-500">
              Your resume has been analyzed{jobTitle ? ` for ${jobTitle}` : ''}. Ask questions and get
              personalized advice for this specific job — no re-upload needed.
            </p>
          </div>
          {hasConversation && (
            <button
              type="button"
              onClick={handleNewConversation}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> New chat
            </button>
          )}
        </div>

        {!hasConversation && (
          <>
            <div className="mt-4 rounded-lg bg-[#F5F3FF] p-4">
              <p className="text-[12px] font-bold text-[#1E1235]">Your AI Coach already knows:</p>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 text-[12.5px] text-slate-600 sm:grid-cols-2">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} /> Your resume
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} /> Your job description
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                  Your analysis{contextSummary ? ` (${contextSummary.matchScore}/100)` : ''}
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                  Your skill gaps{contextSummary ? ` (${contextSummary.missingSkillsCount} missing)` : ''}
                </li>
                <li className="flex items-center gap-1.5 sm:col-span-2">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                  Your ATS recommendations{contextSummary ? ` (${contextSummary.suggestionCount} suggestions)` : ''}
                </li>
              </ul>
            </div>

            <p className="mt-4 text-[12px] font-bold text-[#1E1235]">Suggested questions:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={!canChat || isSending}
                  onClick={() => void send(q)}
                  className="cursor-pointer rounded-full border border-purple-200 bg-purple-50/60 px-3.5 py-1.5 text-[12px] font-semibold text-purple-800 transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Conversation */}
      {hasConversation && (
        <div ref={scrollRef} className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pb-2" role="log" aria-label="Coach conversation" aria-live="polite">
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-line break-words rounded-xl rounded-br-sm bg-[#7C3AED] px-4 py-2.5 text-[13px] leading-relaxed text-white">
                  {m.content}
                </div>
              </div>
            ) : m.failed ? (
              <div key={m.id} className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="flex items-start gap-2 text-[13px] font-semibold text-rose-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m.content}
                </p>
                <button
                  type="button"
                  onClick={() => handleRetry(m.id)}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#6D28D9]"
                >
                  <RotateCcw className="h-3 w-3" /> Try Again
                </button>
              </div>
            ) : (
              <div key={m.id} className="group rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                <div className="break-words text-[13px] leading-relaxed text-slate-700 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_strong]:text-slate-900 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-[12px] [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:text-[14px] [&_h2]:font-bold [&_h3]:text-[13px] [&_h3]:font-bold">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleCopy(m.id, m.content)}
                    aria-label="Copy response"
                    className="inline-flex cursor-pointer items-center gap-1 rounded p-1 text-[11px] font-semibold text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 focus:opacity-100"
                  >
                    {copiedId === m.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === m.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ),
          )}
          {isSending && <TypingIndicator />}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 pt-3">
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-[#7C3AED]">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={canChat ? 'Ask about your resume…' : 'Load a report to start coaching…'}
            disabled={!canChat || isSending}
            aria-label="Ask about your resume"
            className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send(draft)}
            disabled={!draft.trim() || !canChat || isSending}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#7C3AED] text-white transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between px-1 pt-1.5">
          <p className="text-[11px] text-slate-400">Enter to send · Shift + Enter for a new line</p>
          {hasConversation && (
            <button
              type="button"
              onClick={handleNewConversation}
              className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600"
            >
              <Trash2 className="h-3 w-3" /> Clear conversation
            </button>
          )}
        </div>
      </div>

      {/* Continue */}
      {hasConversation && (
        <div className="mt-3 flex shrink-0 flex-col items-start justify-between gap-3 rounded-xl bg-[#F5F3FF] p-4 pb-1 sm:flex-row sm:items-center">
          <p className="text-[12.5px] leading-snug text-slate-600">
            <span className="font-bold text-[#1E1235]">Ready to create your application?</span>{' '}
            Create a personalized cover letter using your resume and this job description.
          </p>
          <button
            type="button"
            onClick={onContinueToCoverLetter}
            className="shrink-0 cursor-pointer rounded-lg bg-[#7C3AED] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#6D28D9]"
          >
            Continue to Cover Letter →
          </button>
        </div>
      )}
    </div>
  );
}
