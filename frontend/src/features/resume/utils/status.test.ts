import { describe, expect, it } from 'vitest';
import {
  formatFileSize,
  getResumeStatusLabel,
  validateResumeFile,
} from '@/features/resume/utils/status';

describe('resume status utils', () => {
  it('formats file sizes for display', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(2_097_152)).toBe('2.0 MB');
  });

  it('maps processing statuses to readable labels', () => {
    expect(getResumeStatusLabel('PROCESSING')).toBe('Processing');
    expect(getResumeStatusLabel('PROCESSED')).toBe('Processed');
  });

  it('rejects unsupported resume files', () => {
    const file = new File(['content'], 'resume.png', {
      type: 'image/png',
    });

    expect(validateResumeFile(file)).toBe('Unsupported file format. Please upload a PDF or TXT resume.');
  });

  it('accepts supported PDF and TXT files within size limits', () => {
    const pdfFile = new File(['content'], 'resume.pdf', {
      type: 'application/pdf',
    });
    const txtFile = new File(['content'], 'resume.txt', {
      type: 'text/plain',
    });

    expect(validateResumeFile(pdfFile)).toBeNull();
    expect(validateResumeFile(txtFile)).toBeNull();
  });

  it('rejects Word documents', () => {
    const docFile = new File(['content'], 'resume.doc', {
      type: 'application/msword',
    });
    const docxFile = new File(['content'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    expect(validateResumeFile(docFile)).toBe(
      'Unsupported file format. Please upload a PDF or TXT resume.',
    );
    expect(validateResumeFile(docxFile)).toBe(
      'Unsupported file format. Please upload a PDF or TXT resume.',
    );
  });
});
