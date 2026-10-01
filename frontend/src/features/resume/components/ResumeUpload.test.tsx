import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResumeUpload } from '@/features/resume/components/ResumeUpload';

describe('ResumeUpload', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows validation error for unsupported file types', async () => {
    const onUploadAndAnalyze = vi.fn();
    render(
      <ResumeUpload
        onUploadAndAnalyze={onUploadAndAnalyze}
        isUploading={false}
        isProcessing={false}
      />,
    );

    const input = screen.getByLabelText('Upload resume');
    const file = new File(['content'], 'resume.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      await screen.findByText(/Only PDF, DOC, DOCX, and plain text resumes are supported/i),
    ).toBeTruthy();
  });

  it('uploads a valid resume file and job description', async () => {
    const onUploadAndAnalyze = vi.fn().mockResolvedValue(undefined);
    render(
      <ResumeUpload
        onUploadAndAnalyze={onUploadAndAnalyze}
        isUploading={false}
        isProcessing={false}
      />,
    );

    const input = screen.getByLabelText('Upload resume');
    const file = new File(['SUMMARY\nDeveloper'], 'resume.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    const jdTextarea = screen.getByPlaceholderText(/Paste the full job description here/i);
    fireEvent.change(jdTextarea, {
      target: { value: 'Looking for a skilled developer with React and Node.js experience.' },
    });

    const button = screen.getByRole('button', { name: /analyze my resume/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => {
      expect(onUploadAndAnalyze).toHaveBeenCalledWith(
        file,
        'Looking for a skilled developer with React and Node.js experience.',
        '',
      );
    });
  });

  it('analyzes a saved resume against a job description', async () => {
    const onUploadAndAnalyze = vi.fn().mockResolvedValue(undefined);
    const onAnalyzeSavedResume = vi.fn().mockResolvedValue(undefined);
    const mockSavedResumes = [
      {
        id: 'res-123',
        originalFilename: 'software_engineer.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        processingStatus: 'PROCESSED' as const,
        score: 85,
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: '2026-03-01T00:00:00Z',
      },
    ];

    render(
      <ResumeUpload
        onUploadAndAnalyze={onUploadAndAnalyze}
        onAnalyzeSavedResume={onAnalyzeSavedResume}
        isUploading={false}
        isProcessing={false}
        savedResumes={mockSavedResumes}
      />,
    );

    // Switch to "Saved Resume" tab
    const savedTabButton = screen.getByRole('button', { name: /saved resume/i });
    fireEvent.click(savedTabButton);

    // Select the saved resume radio button
    const radio = screen.getByRole('radio');
    fireEvent.click(radio);

    // Enter Job Title and Job Description
    const titleInput = screen.getByPlaceholderText(/e\.g\. Backend Engineer/i);
    fireEvent.change(titleInput, { target: { value: 'Full Stack Engineer' } });

    const jdTextarea = screen.getByPlaceholderText(/Paste the full job description here/i);
    fireEvent.change(jdTextarea, {
      target: {
        value: 'Seeking a Full Stack Engineer with strong TypeScript and Node.js expertise.',
      },
    });

    const button = screen.getByRole('button', { name: /analyze my resume/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(onAnalyzeSavedResume).toHaveBeenCalledWith(
        'res-123',
        'Seeking a Full Stack Engineer with strong TypeScript and Node.js expertise.',
        'Full Stack Engineer',
      );
    });
  });
});
