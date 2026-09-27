import { authenticatedApiFetch } from '@/lib/api/client';
import { clientEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import type { CoverLetter, GenerateCoverLetterPayload } from '../types/cover-letter';

export async function generateCoverLetter(payload: GenerateCoverLetterPayload): Promise<{ coverLetter: CoverLetter }> {
  return authenticatedApiFetch<{ coverLetter: CoverLetter }>('/cover-letters', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listCoverLetters(): Promise<{ coverLetters: CoverLetter[] }> {
  return authenticatedApiFetch<{ coverLetters: CoverLetter[] }>('/cover-letters');
}

export async function getCoverLetter(id: string): Promise<{ coverLetter: CoverLetter }> {
  return authenticatedApiFetch<{ coverLetter: CoverLetter }>(`/cover-letters/${id}`);
}

export async function updateCoverLetter(id: string, content: string): Promise<{ coverLetter: CoverLetter }> {
  return authenticatedApiFetch<{ coverLetter: CoverLetter }>(`/cover-letters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export async function deleteCoverLetter(id: string): Promise<void> {
  await authenticatedApiFetch<void>(`/cover-letters/${id}`, {
    method: 'DELETE',
  });
}

export async function downloadCoverLetterFile(id: string, format: 'pdf' | 'docx'): Promise<void> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`${clientEnv.VITE_API_URL}/cover-letters/${id}/export/${format}`, {
    headers: {
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to export cover letter as ${format.toUpperCase()}`);
  }

  const disposition = response.headers.get('content-disposition');
  let filename = `Cover_Letter.${format}`;
  if (disposition) {
    const match = disposition.match(/filename="?([^";]+)"?/i);
    if (match?.[1]) filename = match[1].trim();
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 150);
}
