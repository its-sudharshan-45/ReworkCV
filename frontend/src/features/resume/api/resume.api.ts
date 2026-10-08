import { authenticatedApiFetch } from '@/lib/api/client';
import { clientEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import type {
  AnalyzeJobResponse,
  JobAnalysisDetail,
  JobAnalysisListResponse,
  ResumeDetailResponse,
  ResumeListResponse,
} from '@/features/resume/types/resume';

export async function listResumes() {
  return authenticatedApiFetch<ResumeListResponse>('/resumes');
}

export async function getResume(resumeId: string) {
  return authenticatedApiFetch<ResumeDetailResponse>(`/resumes/${resumeId}`);
}

export async function uploadResume(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return authenticatedApiFetch<ResumeDetailResponse>('/resumes', {
    method: 'POST',
    body: formData,
  });
}

export async function processResume(resumeId: string) {
  return authenticatedApiFetch<ResumeDetailResponse>(`/resumes/${resumeId}/process`, {
    method: 'POST',
  });
}

export async function deleteResume(resumeId: string) {
  await authenticatedApiFetch<void>(`/resumes/${resumeId}`, {
    method: 'DELETE',
  });
}

export async function analyzeResumeForJob(
  resumeId: string,
  jobDescription: string,
  jobTitle?: string,
) {
  return authenticatedApiFetch<AnalyzeJobResponse>(`/resumes/${resumeId}/analyze-job`, {
    method: 'POST',
    body: JSON.stringify({
      jobDescription,
      jobTitle: jobTitle?.trim() || undefined,
    }),
  });
}

export async function listJobAnalyses(resumeId: string) {
  return authenticatedApiFetch<JobAnalysisListResponse>(`/resumes/${resumeId}/job-analyses`);
}

export async function getLatestJobAnalysis(resumeId: string) {
  return authenticatedApiFetch<{ analysis: AnalyzeJobResponse | null }>(
    `/resumes/${resumeId}/job-analyses/latest`,
  );
}

export async function getJobAnalysis(resumeId: string, analysisId: string) {
  return authenticatedApiFetch<{ analysis: JobAnalysisDetail }>(
    `/resumes/${resumeId}/job-analyses/${analysisId}`,
  );
}

export async function downloadResumeReportPdf(
  resumeId: string,
  fallbackName = 'Analysis_Report.pdf',
  analysisId?: string | null,
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again, then retry the download.');
  }

  let response: Response;
  try {
    const url = analysisId
      ? `${clientEnv.VITE_API_URL}/resumes/${resumeId}/report/pdf?analysisId=${encodeURIComponent(analysisId)}`
      : `${clientEnv.VITE_API_URL}/resumes/${resumeId}/report/pdf`;
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch {
    throw new Error('Could not reach the report server. Check your connection and try again.');
  }

  if (!response.ok) {
    let message = 'Failed to download report PDF. Please try again.';
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

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !contentType.includes('application/pdf')) {
    let message = 'The server did not return a PDF file. Please try again.';
    try {
      const body = (await response.clone().json()) as {
        error?: { message?: unknown };
      };
      if (typeof body?.error?.message === 'string' && body.error.message.trim()) {
        message = body.error.message;
      }
    } catch {
      // Ignore parse errors.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('content-disposition');
  let filename = fallbackName;
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
