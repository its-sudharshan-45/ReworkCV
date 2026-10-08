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

export async function rewriteCoverLetter(id: string, feedback: string): Promise<{ coverLetter: CoverLetter }> {
  return authenticatedApiFetch<{ coverLetter: CoverLetter }>(`/cover-letters/${id}/rewrite`, {
    method: 'POST',
    body: JSON.stringify({ feedback }),
  });
}

export async function deleteCoverLetter(id: string): Promise<void> {
  await authenticatedApiFetch<void>(`/cover-letters/${id}`, {
    method: 'DELETE',
  });
}

export async function downloadCoverLetterFile(id: string, format: 'pdf' | 'docx'): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again, then retry the download.');
  }

  let response: Response;
  try {
    response = await fetch(`${clientEnv.VITE_API_URL}/cover-letters/${id}/export/${format}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    let message = `Failed to export cover letter as ${format.toUpperCase()}`;
    try {
      const body = (await response.clone().json()) as {
        error?: { message?: unknown };
        message?: unknown;
      };
      const serverMessage =
        typeof body?.error?.message === 'string' && body.error.message.trim()
          ? body.error.message
          : typeof body?.message === 'string' && body.message.trim()
            ? body.message
            : null;
      if (serverMessage) message = serverMessage;
    } catch {
      // Non-JSON error body — keep the default message.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('content-disposition');
  let filename = `Cover_Letter.${format}`;
  if (disposition) {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
    const raw = (utf8Match?.[1] ?? asciiMatch?.[1] ?? '').trim();
    if (raw) {
      try {
        filename = decodeURIComponent(raw);
      } catch {
        filename = raw;
      }
    }
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('The server returned an empty file. Please try again.');
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 150);

  return filename;
}
