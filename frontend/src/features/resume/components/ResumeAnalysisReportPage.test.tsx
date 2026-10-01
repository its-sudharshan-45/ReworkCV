import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResumeAnalysisReportPage } from './ResumeAnalysisReportPage';
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';

vi.mock('@/features/resume/api/resume.api', () => ({
  getResume: vi.fn(),
  getJobAnalysis: vi.fn(),
  getLatestJobAnalysis: vi.fn(),
  listResumes: vi.fn().mockResolvedValue({ resumes: [] }),
  downloadResumeReportPdf: vi.fn().mockResolvedValue(undefined),
  deleteResume: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/cover-letter/api/cover-letter.api', () => ({
  generateCoverLetter: vi.fn(),
}));

import {
  getResume,
  getJobAnalysis,
  getLatestJobAnalysis,
} from '@/features/resume/api/resume.api';

function makeAnalysis(): JobMatchAnalysis {
  return {
    matchScore: 79,
    category: 'Good Match',
    overview: 'Your backend work aligns with the stack.',
    breakdown: { skills: 85, experience: 70, responsibilities: 60, keywords: 75, education: 90, projects: 50 },
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
    keywordDetail: { found: ['React'], missing: ['GraphQL'], scorePercent: 75 },
    projectDetail: { relevantProjects: [], scorePercent: 50 },
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
    score: 79,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedText: null,
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

describe('ResumeAnalysisReportPage', () => {
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
    vi.mocked(getLatestJobAnalysis).mockResolvedValue({
      analysis: { success: true, data: makeAnalysis(), analysisId: 'analysis-1' },
    });
  });

  it('loads a specific analysis by id and renders exact deterministic scores', async () => {
    renderAt('/resume/report/resume-1/analysis-1');

    await waitFor(() => {
      expect(vi.mocked(getJobAnalysis)).toHaveBeenCalledWith('resume-1', 'analysis-1');
    });
    expect(await screen.findByText('Backend Engineer')).toBeDefined();
    expect(screen.getAllByText('79/100').length).toBeGreaterThan(0);
    expect(screen.getByText('85%')).toBeDefined();
  });

  it('resolves the latest analysis without in-memory state', async () => {
    renderAt('/resume/report/resume-1/latest');

    await waitFor(() => {
      expect(vi.mocked(getLatestJobAnalysis)).toHaveBeenCalledWith('resume-1');
    });
    expect(await screen.findByText('Backend Engineer')).toBeDefined();
  });

  it('shows a retryable error state when loading fails and never navigates away', async () => {
    vi.mocked(getResume).mockRejectedValue(new Error('network down'));
    renderAt('/resume/report/resume-1/analysis-1');

    expect(await screen.findByText('Report unavailable')).toBeDefined();
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /back to upload/i })).toBeDefined();
  });

  it('never renders forbidden placeholders', async () => {
    const { container } = renderAt('/resume/report/resume-1/analysis-1');
    await waitFor(() => {
      expect(vi.mocked(getJobAnalysis)).toHaveBeenCalled();
    });
    await screen.findByText('Backend Engineer');
    const html = container.innerHTML;
    for (const token of ['undefined', '[object Object]', 'NaN']) {
      expect(html).not.toContain(token);
    }
  });
});
