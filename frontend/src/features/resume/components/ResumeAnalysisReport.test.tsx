import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResumeAnalysisReport } from './ResumeAnalysisReport';
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

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
    id: 'r1',
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

describe('ResumeAnalysisReport', () => {
  it('renders exact deterministic scores', () => {
    render(<ResumeAnalysisReport analysis={makeAnalysis()} resume={makeResume()} jobTitle="Backend Engineer" />);
    expect(screen.getAllByText('79/100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('85%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('70%').length).toBeGreaterThan(0);
  });

  it('never renders forbidden placeholders', () => {
    const { container } = render(<ResumeAnalysisReport analysis={makeAnalysis()} resume={makeResume()} />);
    const html = container.innerHTML;
    // Note: '&amp;' is valid HTML serialization for '&' in titles (e.g. "Content & Impact")
    // and is not a placeholder. Only check true placeholders.
    for (const token of ['undefined', '[object Object]', 'NaN', '&amp;amp;']) {
      expect(html).not.toContain(token);
    }
  });

  it('never invents skills', () => {
    render(<ResumeAnalysisReport analysis={makeAnalysis()} resume={makeResume()} />);
    expect(screen.getAllByText('React').length).toBeGreaterThan(0);
    expect(screen.getAllByText('GraphQL').length).toBeGreaterThan(0);
  });

  it('renders empty states with missing optional data', () => {
    render(<ResumeAnalysisReport analysis={null} resume={makeResume()} />);
    expect(
      screen.getAllByText(/Your Report Will Appear Here|Content findings|Skill match data|Format checks/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it('handles long job titles without breaking', () => {
    const longTitle = `Senior Backend Engineer ${'with extra '.repeat(20)}`.trim();
    render(<ResumeAnalysisReport analysis={makeAnalysis()} resume={makeResume()} jobTitle={longTitle} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Senior Backend Engineer');
  });

  it('lists hard technical skills under Preferred Skills, never Soft Skills', () => {
    const analysis = makeAnalysis();
    analysis.skillDetail.matchedPreferred = ['Docker'];
    analysis.skillDetail.missingPreferred = ['AWS'];
    analysis.skillDetail.matchedSoft = ['Communication'];
    analysis.skillDetail.missingSoft = ['Leadership'];
    render(<ResumeAnalysisReport analysis={analysis} resume={makeResume()} jobTitle="Backend Engineer" />);

    const softTable = screen.getByRole('heading', { name: 'Soft Skills' }).closest('div');
    expect(softTable?.textContent).toContain('Communication');
    expect(softTable?.textContent).toContain('Leadership');
    expect(softTable?.textContent).not.toContain('Docker');
    expect(softTable?.textContent).not.toContain('AWS');

    const preferredTable = screen.getByRole('heading', { name: 'Preferred Skills' }).closest('div');
    expect(preferredTable?.textContent).toContain('Docker');
    expect(preferredTable?.textContent).toContain('AWS');
    expect(preferredTable?.textContent).not.toContain('Communication');
  });

  it('splits legacy preferred lists via vocabulary fallback when soft fields are absent', () => {
    const analysis = makeAnalysis();
    // Pre-soft-skill record shape: no matchedSoft/missingSoft at all.
    analysis.skillDetail.matchedPreferred = ['Docker', 'Communication'];
    analysis.skillDetail.missingPreferred = ['AWS', 'Leadership'];
    render(<ResumeAnalysisReport analysis={analysis} resume={makeResume()} jobTitle="Backend Engineer" />);

    const softTable = screen.getByRole('heading', { name: 'Soft Skills' }).closest('div');
    expect(softTable?.textContent).toContain('Communication');
    expect(softTable?.textContent).toContain('Leadership');
    expect(softTable?.textContent).not.toContain('Docker');

    const preferredTable = screen.getByRole('heading', { name: 'Preferred Skills' }).closest('div');
    expect(preferredTable?.textContent).toContain('Docker');
    expect(preferredTable?.textContent).toContain('AWS');
  });
});
