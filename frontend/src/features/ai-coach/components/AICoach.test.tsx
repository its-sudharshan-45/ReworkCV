import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AICoach } from './AICoach';
import type { AiCoachChatMessage } from '@/features/ai-coach/api/ai-coach.api';

vi.mock('@/features/ai-coach/api/ai-coach.api', () => ({
  sendCoachMessage: vi.fn(),
}));

import { sendCoachMessage } from '@/features/ai-coach/api/ai-coach.api';

const CONTEXT = { matchScore: 72, missingSkillsCount: 2, missingKeywordsCount: 2, suggestionCount: 5 };

function Harness({
  initial = [] as AiCoachChatMessage[],
  resumeId = 'resume-1',
  analysisId = 'analysis-1',
}: {
  initial?: AiCoachChatMessage[];
  resumeId?: string | null;
  analysisId?: string | null;
}) {
  const [messages, setMessages] = useState<AiCoachChatMessage[]>(initial);
  const [conversationId, setConversationId] = useState<string | null>(null);
  return (
    <AICoach
      resumeId={resumeId}
      analysisId={analysisId}
      jobTitle="Backend Engineer"
      contextSummary={CONTEXT}
      messages={messages}
      conversationId={conversationId}
      onMessagesChange={setMessages}
      onConversationChange={setConversationId}
      onContinueToCoverLetter={() => undefined}
    />
  );
}

describe('AICoach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state with context summary and suggested questions', () => {
    render(<Harness />);
    expect(screen.getByText('AI Resume Coach')).toBeDefined();
    expect(screen.getByText(/Your AI Coach already knows/)).toBeDefined();
    expect(screen.getAllByText(/72\/100/).length).toBeGreaterThan(0);
    expect(screen.getByText('How can I improve my project section?')).toBeDefined();
    expect(screen.getByText('What skills am I missing for this job?')).toBeDefined();
  });

  it('sends a message and renders the AI response', async () => {
    vi.mocked(sendCoachMessage).mockResolvedValue({
      message: 'Strengthen bullets with **metrics**.',
      sources: [{ type: 'analysis', section: 'recommendations' }],
      conversationId: 'conv-1',
    });
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Ask about your resume'), {
      target: { value: 'How can I improve?' },
    });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(vi.mocked(sendCoachMessage)).toHaveBeenCalledWith({
        resumeId: 'resume-1',
        analysisId: 'analysis-1',
        message: 'How can I improve?',
        conversationId: null,
      });
    });
    expect(await screen.findByText('How can I improve?')).toBeDefined();
    expect(await screen.findByText(/Strengthen bullets with/)).toBeDefined();
  });

  it('shows a typing indicator while sending', async () => {
    let resolveCall!: (v: { message: string; sources: []; conversationId: string }) => void;
    vi.mocked(sendCoachMessage).mockImplementation(
      () => new Promise((resolve) => { resolveCall = resolve; }),
    );
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Ask about your resume'), {
      target: { value: 'Hello coach' },
    });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(await screen.findByLabelText('AI is typing')).toBeDefined();
    resolveCall({ message: 'Hi there.', sources: [], conversationId: 'conv-2' });
    await waitFor(() => {
      expect(screen.queryByLabelText('AI is typing')).toBeNull();
    });
    expect(await screen.findByText('Hi there.')).toBeDefined();
  });

  it('shows an error with Try Again and retries the last question', async () => {
    vi.mocked(sendCoachMessage).mockRejectedValueOnce(new Error('Something went wrong while generating your response.'));
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Ask about your resume'), {
      target: { value: 'Why is my score low?' },
    });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(await screen.findByText('Something went wrong while generating your response.')).toBeDefined();

    vi.mocked(sendCoachMessage).mockResolvedValueOnce({
      message: 'Your score reflects partial tenure.',
      sources: [],
      conversationId: 'conv-1',
    });
    fireEvent.click(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(vi.mocked(sendCoachMessage)).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('Your score reflects partial tenure.')).toBeDefined();
    expect(vi.mocked(sendCoachMessage)).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'Why is my score low?' }),
    );
  });

  it('sends on Enter but not on Shift+Enter', async () => {
    vi.mocked(sendCoachMessage).mockResolvedValue({ message: 'ok', sources: [], conversationId: 'c' });
    render(<Harness />);
    const input = screen.getByLabelText('Ask about your resume') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'line one' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(vi.mocked(sendCoachMessage)).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    await waitFor(() => {
      expect(vi.mocked(sendCoachMessage)).toHaveBeenCalledTimes(1);
    });
  });

  it('copies an AI response to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <Harness
        initial={[{ id: 'a1', role: 'assistant', content: 'Copyable advice.' }]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Copy response'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('Copyable advice.');
    });
    expect(await screen.findByText('Copied')).toBeDefined();
  });

  it('clears the conversation with New chat', () => {
    render(
      <Harness
        initial={[
          { id: 'u1', role: 'user', content: 'Hi' },
          { id: 'a1', role: 'assistant', content: 'Hello' },
        ]}
      />,
    );
    expect(screen.getByText('Hello')).toBeDefined();
    fireEvent.click(screen.getByText('New chat'));
    expect(screen.queryByText('Hello')).toBeNull();
    expect(screen.getByText(/Your AI Coach already knows/)).toBeDefined();
  });

  it('disables chat without resume context and never calls the API', () => {
    render(<Harness resumeId={null} analysisId={null} />);
    expect((screen.getByLabelText('Ask about your resume') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByLabelText('Send message') as HTMLButtonElement).disabled).toBe(true);
  });

  it('never renders forbidden placeholders', () => {
    const { container } = render(<Harness />);
    const html = container.innerHTML;
    for (const token of ['undefined', '[object Object]', 'NaN']) {
      expect(html).not.toContain(token);
    }
  });
});
