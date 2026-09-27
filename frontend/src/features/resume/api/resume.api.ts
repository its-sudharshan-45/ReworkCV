import { authenticatedApiFetch } from '@/lib/api/client';
import { clientEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import type {
  AnalyzeJobResponse,
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

export async function downloadResumeReportPdf(resumeId: string, fallbackName = 'Analysis_Report.pdf') {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`${clientEnv.VITE_API_URL}/resumes/${resumeId}/report/pdf`, {
    headers: {
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to download report PDF');
  }

  const disposition = response.headers.get('content-disposition');
  let filename = fallbackName;
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
