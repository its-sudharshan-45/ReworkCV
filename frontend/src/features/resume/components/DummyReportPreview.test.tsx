import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DUMMY_REPORT_PREVIEW, DummyReportPreview } from './DummyReportPreview';

vi.mock('@/features/resume/api/resume.api', () => ({
  getResume: vi.fn(),
  getJobAnalysis: vi.fn(),
  getLatestJobAnalysis: vi.fn(),
  listResumes: vi.fn(),
  analyzeResumeForJob: vi.fn(),
  downloadResumeReportPdf: vi.fn(),
}));

import {
  getResume,
  getJobAnalysis,
  getLatestJobAnalysis,
  listResumes,
  analyzeResumeForJob,
} from '@/features/resume/api/resume.api';

describe('DummyReportPreview (static upload-page preview)', () => {
  it('exposes the specified dummy values in DUMMY_REPORT_PREVIEW', () => {
    expect(DUMMY_REPORT_PREVIEW.jobRole).toBe('Backend Engineer');
    expect(DUMMY_REPORT_PREVIEW.jobCompany).toBe('Google');
    expect(DUMMY_REPORT_PREVIEW.overallScore).toBe(92);
    expect(DUMMY_REPORT_PREVIEW.issuesToFix).toBe(10);
    expect(DUMMY_REPORT_PREVIEW.analysisTitle).toBe('Your Application Signals');
    expect(DUMMY_REPORT_PREVIEW.contentScore).toBe(88);
    expect(DUMMY_REPORT_PREVIEW.measurableResults).toBe(3);
    expect(DUMMY_REPORT_PREVIEW.spellingGrammar).toBe(5);
    expect(DUMMY_REPORT_PREVIEW.categories.map((c) => c.label)).toEqual([
      'Content',
      'Skills',
      'Format',
      'Sections',
      'Style',
    ]);
  });

  it('renders the dummy report structure without a router or real data', () => {
    // Intentionally rendered outside any router/provider: the preview must
    // not depend on route params, auth, or analysis state.
    render(<DummyReportPreview />);

    expect(screen.getByText('Backend Engineer')).toBeDefined();
    expect(screen.getByText('Google')).toBeDefined();
    expect(screen.getByText('Your Application Signals')).toBeDefined();
    expect(screen.getByText('Signal Map')).toBeDefined();
    expect(screen.getByText('Key Insights')).toBeDefined();
    expect(screen.getByText('Content Analysis')).toBeDefined();
    expect(screen.getByText(/Content Score: 88\/100/)).toBeDefined();
    expect(screen.getByText('Great potential!')).toBeDefined();
    expect(screen.getByText(/Strong technical skills in backend technologies/)).toBeDefined();
    expect(
      screen.getByText(/Let's refine your content to make it more impactful/),
    ).toBeDefined();
    expect(
      screen.getByText(/Add specific, measurable achievements/),
    ).toBeDefined();
  });

  it('never calls the analysis API or reads persisted data', () => {
    render(<DummyReportPreview />);

    expect(vi.mocked(getResume)).not.toHaveBeenCalled();
    expect(vi.mocked(getJobAnalysis)).not.toHaveBeenCalled();
    expect(vi.mocked(getLatestJobAnalysis)).not.toHaveBeenCalled();
    expect(vi.mocked(listResumes)).not.toHaveBeenCalled();
    expect(vi.mocked(analyzeResumeForJob)).not.toHaveBeenCalled();
  });

  it('contains no interactive controls that could leak into real flows', () => {
    const { container } = render(<DummyReportPreview />);
    // Static mock: zero buttons/links/inputs — nothing to click or submit.
    expect(container.querySelectorAll('button, a, input, textarea, select, form').length).toBe(0);
  });
});
