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
    expect(screen.getByText('85%')).toBeDefined();
    expect(screen.getByText('70%')).toBeDefined();
  });

  it('never renders forbidden placeholders', () => {
    const { container } = render(<ResumeAnalysisReport analysis={makeAnalysis()} resume={makeResume()} />);
    const html = container.innerHTML;
    for (const token of ['undefined', '[object Object]', 'NaN', '&amp;']) {
      expect(html).not.toContain(token);
    }
  });

  it('never invents skills', () => {
    render(<ResumeAnalysisReport analysis={makeAnalysis()} resume={makeResume()} />);
    expect(screen.getByText('React')).toBeDefined();
    expect(screen.getByText('GraphQL')).toBeDefined();
  });

  it('renders empty states with missing optional data', () => {
    render(<ResumeAnalysisReport analysis={null} resume={makeResume()} />);
    expect(screen.getByText(/Your Report Will Appear Here|Content findings|Skill match data|Format checks/i)).toBeDefined();
  });

  it('handles long job titles without breaking', () => {
    const longTitle = `Senior Backend Engineer ${'with extra '.repeat(20)}`.trim();
    render(<ResumeAnalysisReport analysis={makeAnalysis()} resume={makeResume()} jobTitle={longTitle} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Senior Backend Engineer');
  });
});
