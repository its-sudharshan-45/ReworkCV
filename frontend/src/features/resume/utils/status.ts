import type { ResumeProcessingStatus } from '@/features/resume/types/resume';

export function getResumeStatusLabel(status: ResumeProcessingStatus): string {
  switch (status) {
    case 'UPLOADED':
      return 'Uploaded';
    case 'PROCESSING':
      return 'Processing';
    case 'PROCESSED':
      return 'Processed';
    case 'FAILED':
      return 'Failed';
    default:
      return status;
  }
}

export function getResumeStatusTone(
  status: ResumeProcessingStatus,
): 'neutral' | 'info' | 'success' | 'error' {
  switch (status) {
    case 'PROCESSED':
      return 'success';
    case 'FAILED':
      return 'error';
    case 'PROCESSING':
      return 'info';
    default:
      return 'neutral';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SUPPORTED_RESUME_EXTENSIONS = ['.pdf', '.txt'];

export function validateResumeFile(file: File | null, maxBytes = 5_242_880): string | null {
  if (!file) {
    return 'Select a resume file to upload.';
  }

  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!SUPPORTED_RESUME_EXTENSIONS.includes(extension)) {
    return 'Unsupported file format. Please upload a PDF or TXT resume.';
  }

  if (file.size <= 0) {
    return 'The selected file is empty.';
  }

  if (file.size > maxBytes) {
    return 'The selected file exceeds the 5 MB limit.';
  }

  return null;
}
