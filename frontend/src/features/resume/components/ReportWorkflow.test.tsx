import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResumeAnalysisReportPage } from '@/features/resume/components/ResumeAnalysisReportPage';
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';

vi.mock('@/features/resume/api/resume.api', () => ({
  getResume: vi.fn(),
  getJobAnalysis: vi.fn(),
  getLatestJobAnalysis: vi.fn(),
  listResumes: vi.fn().mockResolvedValue({ resumes: [] }),
  downloadResumeReportPdf: vi.fn().mockResolvedValue('Report.pdf'),
  deleteResume: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/cover-letter/api/cover-letter.api', () => ({
  generateCoverLetter: vi.fn(),
  downloadCoverLetterFile: vi.fn().mockResolvedValue('Cover_Letter.pdf'),
  rewriteCoverLetter: vi.fn(),
  updateCoverLetter: vi.fn(),
}));

vi.mock('@/features/ai-coach/api/ai-coach.api', () => ({
  sendCoachMessage: vi.fn(),
}));

import {
  getResume,
  getJobAnalysis,
} from '@/features/resume/api/resume.api';
import { sendCoachMessage } from '@/features/ai-coach/api/ai-coach.api';
import {
  generateCoverLetter,
  rewriteCoverLetter,
  updateCoverLetter,
  downloadCoverLetterFile,
} from '@/features/cover-letter/api/cover-letter.api';

function makeAnalysis(): JobMatchAnalysis {
  return {
    matchScore: 72,
    category: 'Good Match',
    overview: 'Solid backend alignment.',
    breakdown: { skills: 80, experience: 65, responsibilities: 60, keywords: 70, education: 90, projects: 55 },
    matchedSkills: ['React'],
    missingRequiredSkills: ['GraphQL'],
    missingPreferredSkills: [],
    skillDetail: {
      matchedRequired: ['React'],
      missingRequired: ['GraphQL'],
      matchedPreferred: [],
      missingPreferred: [],
      scorePercent: 70,
    },
    experienceDetail: {
      requiredYears: 3,
      detectedProfessionalYears: 2,
      detectedInternshipMonths: 0,
      detectedProjectCount: 1,
      matchLevel: 'partial',
      scorePercent: 60,
      note: 'Partial experience.',
    },
    educationDetail: { required: [], detected: [], matchLevel: 'strong', scorePercent: 90 },
    responsibilityDetail: { matched: ['Build APIs'], unmatched: [], scorePercent: 60 },
    keywordDetail: { found: ['React'], missing: ['GraphQL'], scorePercent: 70 },
    projectDetail: { relevantProjects: [], scorePercent: 55 },
    strengths: ['Strong React skills'],
    recommendations: [{ priority: 'high', text: 'Add GraphQL only if experienced', impact: '+4 points' }],
  };
}

function makeResume(): ResumeDetail {
  return {
    id: 'resume-1',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    fileSize: 1000,
    processingStatus: 'PROCESSED',
    score: 72,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedText: 'Backend Engineer with React experience.',
    structuredData: { sections: [{ key: 'summary', title: 'Summary', content: 'Engineer' }], skills: ['React'] },
    analysisResult: null,
    failureReason: null,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/resume/report/:resumeId/:analysisId" element={<ResumeAnalysisReportPage />} />
        <Route path="/analysis" element={<div>Upload page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('3-step post-analysis workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResume).mockResolvedValue({ resume: makeResume() });
    vi.mocked(getJobAnalysis).mockResolvedValue({
      analysis: {
        success: true,
        data: makeAnalysis(),
        analysisId: 'analysis-1',
        resumeId: 'resume-1',
        jobTitle: 'Backend Engineer',
        jobDescription: 'Seeking a backend engineer.',
        createdAt: new Date().toISOString(),
      },
    });
    vi.mocked(sendCoachMessage).mockResolvedValue({
      message: 'Add measurable outcomes to your bullets.',
      sources: [{ type: 'analysis', section: 'recommendations' }],
      conversationId: 'conv-1',
    });
  });

  it('shows all three steps with current-step state', async () => {
    renderAt('/resume/report/resume-1/analysis-1');
    expect((await screen.findAllByText('Backend Engineer')).length).toBeGreaterThan(0);
    const stepOne = screen.getAllByRole('button', { name: /Step 1.*Report/i });
    expect(stepOne.length).toBeGreaterThan(0);
    expect(stepOne[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByRole('button', { name: /Step 2.*AI Coach/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Step 3.*Cover Letter/i }).length).toBeGreaterThan(0);
  });

  it('navigates report → coach → cover without losing the coach conversation', async () => {
    renderAt('/resume/report/resume-1/analysis-1');
    await screen.findAllByText('Backend Engineer');

    // Report offers the next step.
    const continueButtons = screen.getAllByRole('button', { name: /Step 2: AI Resume Coach/i });
    fireEvent.click(continueButtons[0]!);
    expect(await screen.findByText('AI Resume Coach')).toBeDefined();
    // Coach already knows the analysis context — no re-upload.
    expect(screen.getAllByText(/72\/100/).length).toBeGreaterThan(0);

    // Ask a question.
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
    expect(await screen.findByText('Add measurable outcomes to your bullets.')).toBeDefined();

    // Back to Step 1, then forward again — conversation preserved.
    const stepOneTabs = screen.getAllByRole('button', { name: /Step 1.*Report/i });
    fireEvent.click(stepOneTabs[0]!);
    expect(await screen.findByText('Overview')).toBeDefined();
    const stepTwoTabs = screen.getAllByRole('button', { name: /Step 2.*AI Coach/i });
    fireEvent.click(stepTwoTabs[0]!);
    expect(await screen.findByText('Add measurable outcomes to your bullets.')).toBeDefined();

    // Continue to Step 3 reuses the same resume + job description.
    fireEvent.click(screen.getByRole('button', { name: /Continue to Cover Letter/i }));
    expect(await screen.findByRole('button', { name: 'Generate Cover Letter' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Back to AI Resume Coach/i })).toBeDefined();
  });

  it('sends the persisted analysis id (not latest) to the coach', async () => {
    renderAt('/resume/report/resume-1/analysis-1');
    await screen.findAllByText('Backend Engineer');
    const stepTwoTabs = screen.getAllByRole('button', { name: /Step 2.*AI Coach/i });
    fireEvent.click(stepTwoTabs[0]!);
    fireEvent.click(screen.getByText('What skills am I missing for this job?'));
    await waitFor(() => {
      expect(vi.mocked(sendCoachMessage)).toHaveBeenCalledWith(
        expect.objectContaining({ resumeId: 'resume-1', analysisId: 'analysis-1' }),
      );
    });
  });

  it('cover letter displays, rewrites with user suggestions, edits and downloads PDF', async () => {
    const baseLetter = {
      id: 'cl-1',
      userId: 'user-1',
      resumeId: 'resume-1',
      jobAnalysisId: 'analysis-1',
      jobTitle: 'Backend Engineer',
      companyName: null,
      jobDescription: 'Seeking a backend engineer.',
      content: 'Dear Hiring Manager,\n\nI am applying for the Backend Engineer role.\n\nSincerely,\nJane',
      tone: 'professional',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(generateCoverLetter).mockResolvedValue({ coverLetter: baseLetter });
    vi.mocked(rewriteCoverLetter).mockResolvedValue({
      coverLetter: { ...baseLetter, content: 'Dear Hiring Manager,\n\nShorter revised draft.\n\nSincerely,\nJane' },
    });
    vi.mocked(updateCoverLetter).mockResolvedValue({
      coverLetter: { ...baseLetter, content: 'Dear Hiring Manager,\n\nManually edited draft.\n\nSincerely,\nJane' },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderAt('/resume/report/resume-1/analysis-1');
    await screen.findAllByText('Backend Engineer');
    const stepThreeTabs = screen.getAllByRole('button', { name: /Step 3.*Cover Letter/i });
    fireEvent.click(stepThreeTabs[0]!);

    // Generate → the letter displays on the same page.
    fireEvent.click(screen.getByRole('button', { name: 'Generate Cover Letter' }));
    expect(await screen.findByText('Generated Cover Letter')).toBeDefined();
    expect(await screen.findByText(/I am applying for the Backend Engineer role/)).toBeDefined();

    // Manual PDF download of the displayed letter.
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => {
      expect(vi.mocked(downloadCoverLetterFile)).toHaveBeenCalledWith('cl-1', 'pdf');
    });

    // User suggestions → rewrite → updated letter displays.
    fireEvent.change(screen.getByLabelText('Suggest changes to the cover letter'), {
      target: { value: 'Make it shorter' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite with my suggestions' }));
    expect(await screen.findByText(/Shorter revised draft/)).toBeDefined();
    expect(vi.mocked(rewriteCoverLetter)).toHaveBeenCalledWith('cl-1', 'Make it shorter');

    // Copy + manual edit + save.
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Shorter revised draft'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit cover letter'), {
      target: { value: 'Dear Hiring Manager,\n\nManually edited draft.\n\nSincerely,\nJane' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Edits' }));
    await waitFor(() => {
      expect(vi.mocked(updateCoverLetter)).toHaveBeenCalledWith(
        'cl-1',
        expect.stringContaining('Manually edited draft'),
      );
    });
    expect(await screen.findByText(/Manually edited draft/)).toBeDefined();
  });
});
