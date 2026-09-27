// cspell:ignore SUDHARSHAN sudharshan
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CakeMeReport } from './CakeMeReport';
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';

// Minimal mock for Button (uses @/components/ui/button)
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockAnalysis: JobMatchAnalysis = {
  matchScore: 82,
  category: 'Strong Match',
  overview: 'Your resume demonstrates strong alignment with the target role.',
  breakdown: {
    skills: 85,
    experience: 80,
    responsibilities: 75,
    keywords: 70,
    education: 90,
    projects: 80,
  },
  matchedSkills: ['React', 'TypeScript', 'Node.js'],
  missingRequiredSkills: ['Angular', 'GraphQL'],
  missingPreferredSkills: ['Docker'],
  skillDetail: {
    matchedRequired: ['React', 'TypeScript', 'Node.js'],
    missingRequired: ['Angular', 'GraphQL'],
    matchedPreferred: ['Express.js'],
    missingPreferred: ['Docker'],
    scorePercent: 70,
  },
  experienceDetail: {
    requiredYears: 3,
    detectedProfessionalYears: 2,
    detectedInternshipMonths: 6,
    detectedProjectCount: 4,
    matchLevel: 'partial',
    scorePercent: 65,
    note: 'Internship and project experience partially compensates for professional experience gap.',
  },
  educationDetail: {
    required: ["Bachelor's in Computer Science"],
    detected: ['B.E. Computer Science'],
    matchLevel: 'strong',
    scorePercent: 90,
  },
  responsibilityDetail: {
    matched: ['Build scalable APIs', 'Collaborate with cross-functional teams'],
    unmatched: ['Manage cloud infrastructure'],
    scorePercent: 75,
  },
  keywordDetail: {
    found: ['API', 'REST', 'TypeScript', 'testing'],
    missing: ['CI/CD', 'microservices'],
    scorePercent: 70,
  },
  projectDetail: {
    relevantProjects: [
      {
        name: 'Resume Intelligence Platform',
        technologies: ['React', 'Node.js', 'Supabase'],
        relevantTech: ['React', 'Node.js'],
        relevancePercent: 88,
      },
    ],
    scorePercent: 80,
  },
  strengths: ['Strong React and TypeScript skills', 'Backend API experience with Node.js'],
  recommendations: [
    {
      priority: 'high',
      text: 'Add Angular or Vue experience',
      impact: 'Increases skill match score by 15%',
    },
    { priority: 'medium', text: 'Include Docker in projects', impact: 'Improves DevOps alignment' },
  ],
};

const mockResume: Partial<ResumeDetail> = {
  id: 'resume-abc-123',
  originalFilename: 'my_resume.pdf',
  mimeType: 'application/pdf',
  fileSize: 102400,
  processingStatus: 'PROCESSED',
  score: 82,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  extractedText: 'Sample resume text...',
  structuredData: {
    // StructuredResumeData: sections[] + skills[] at top level
    sections: [
      { key: 'summary', title: 'Summary', content: 'Experienced developer...' },
      { key: 'experience', title: 'Experience', content: 'Company A, 2022–2024' },
      { key: 'education', title: 'Education', content: 'B.E. Computer Science' },
      { key: 'skills', title: 'Skills', content: 'React, TypeScript, Node.js' },
    ],
    skills: ['React', 'TypeScript', 'Node.js'],
  },
  analysisResult: null,
  failureReason: null,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CakeMeReport', () => {
  it('renders real match score from analysis', () => {
    render(<CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />);
    expect(screen.getByText('82')).toBeDefined();
  });

  it('renders real overview text from analysis (no hardcoded fallback)', () => {
    render(<CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />);
    expect(
      screen.getByText('Your resume demonstrates strong alignment with the target role.'),
    ).toBeDefined();
  });

  it('renders real strengths from analysis', () => {
    render(<CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />);
    expect(screen.getByText('Strong React and TypeScript skills')).toBeDefined();
  });

  it('renders real recommendations from analysis', () => {
    render(<CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />);
    // Recommendations appear in both Overview and Content sections
    const items = screen.getAllByText('Add Angular or Vue experience');
    expect(items.length).toBeGreaterThan(0);
  });

  it('renders matched skills from analysis', () => {
    render(<CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />);
    // 'React' appears in both skills table and the skills content column
    const items = screen.getAllByText('React');
    expect(items.length).toBeGreaterThan(0);
  });

  it('shows empty state for overview when no analysis provided', () => {
    render(<CakeMeReport resume={mockResume as ResumeDetail} />);
    expect(
      screen.getByText(/Run an ATS job match analysis to see a detailed overview/i),
    ).toBeDefined();
  });

  it('shows empty state for skills when no analysis and no structured skills', () => {
    const emptyResume = {
      ...mockResume,
      structuredData: { sections: [], skills: [] },
    };
    render(<CakeMeReport resume={emptyResume as ResumeDetail} />);
    expect(screen.getByText(/No skills data available/i)).toBeDefined();
  });

  it('does NOT render hardcoded SUDHARSHAN or fake phone/email', () => {
    const { container } = render(
      <CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />,
    );
    const html = container.innerHTML;
    expect(html).not.toContain('SUDHARSHAN');
    expect(html).not.toContain('sudharshan');
    expect(html).not.toContain('+91-9025596771');
    expect(html).not.toContain('its.sudharshan.in@gmail.com');
    expect(html).not.toContain('sudharshan-portfolio');
  });

  it('does NOT render hardcoded fake skill frequency columns', () => {
    const { container } = render(
      <CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />,
    );
    const html = container.innerHTML;
    // The old fake hardSkillsList rendered "jobCount" and "resumeCount" as numbers
    // in "Job Description" and "Your Resume" column headers.
    // These specific column headers should not appear in the new real-data driven component.
    expect(html).not.toContain('data-job-count');
    expect(html).not.toContain('resumeCount');
  });

  it('does NOT render hardcoded fallback overview paragraph', () => {
    const { container } = render(
      <CakeMeReport resume={mockResume as ResumeDetail} />, // no analysis
    );
    const html = container.innerHTML;
    expect(html).not.toContain('full-stack skills with React');
    expect(html).not.toContain('internships demonstrate practical deployment');
  });

  it('does NOT render fake spelling/grammar examples', () => {
    const { container } = render(
      <CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />,
    );
    const html = container.innerHTML;
    expect(html).not.toContain('Irregular spacing around unit abbreviations');
    expect(html).not.toContain('Sentence fragment lacking subject');
  });

  it('renders with no props and shows graceful empty states', () => {
    // Should not throw, should show honest messages
    render(<CakeMeReport />);
    // Score ring shows dash when score is 0
    expect(screen.getByText('—')).toBeDefined();
  });

  it('shows resume skills when no analysis but resume has skills', () => {
    render(<CakeMeReport resume={mockResume as ResumeDetail} />);
    // Should show skill badges from structuredData.skills
    expect(screen.getByText('React')).toBeDefined();
    expect(screen.getByText('TypeScript')).toBeDefined();
  });

  it('renders ATS Component Breakdown with backend weights and scores', () => {
    render(<CakeMeReport analysis={mockAnalysis} resume={mockResume as ResumeDetail} />);

    expect(screen.getByText(/ATS Component Breakdown/i)).toBeDefined();
    expect(screen.getByText('40%')).toBeDefined(); // Skills weight
    expect(screen.getByText('20%')).toBeDefined(); // Experience weight
    expect(screen.getByText('15%')).toBeDefined(); // Responsibilities weight
    expect(screen.getByText('5%')).toBeDefined(); // Education weight
    expect(screen.getByText('85%')).toBeDefined(); // Skills score
    expect(screen.getByText('90%')).toBeDefined(); // Education score
  });

  it('renders candidate contact info from structuredResume.personal', () => {
    const resumeWithPersonal = {
      ...mockResume,
      structuredData: {
        ...mockResume.structuredData!,
        structuredResume: {
          personal: {
            name: 'Alex Johnson',
            email: 'alex.johnson@example.com',
            phone: '555-0199',
          },
          skills: ['React'],
          experience: [],
          education: [],
          projects: [],
          certifications: [],
          languages: [],
        },
      },
    };

    render(<CakeMeReport analysis={mockAnalysis} resume={resumeWithPersonal as ResumeDetail} />);
    expect(screen.getByText('Alex Johnson')).toBeDefined();
    expect(screen.getByText('alex.johnson@example.com')).toBeDefined();
    expect(screen.getByText('555-0199')).toBeDefined();
  });

  it('triggers onDownloadReportPdf when clicking the Download Report button', () => {
    const onDownloadReportPdf = vi.fn();
    render(
      <CakeMeReport
        analysis={mockAnalysis}
        resume={mockResume as ResumeDetail}
        onDownloadReportPdf={onDownloadReportPdf}
      />,
    );

    const downloadBtn = screen.getByRole('button', { name: /Download Report \(PDF\)/i });
    downloadBtn.click();
    expect(onDownloadReportPdf).toHaveBeenCalledTimes(1);
  });

  it('triggers onGenerateCoverLetter when clicking the Generate Cover Letter button', () => {
    const onGenerateCoverLetter = vi.fn();
    render(
      <CakeMeReport
        analysis={mockAnalysis}
        resume={mockResume as ResumeDetail}
        onGenerateCoverLetter={onGenerateCoverLetter}
      />,
    );

    const coverLetterBtn = screen.getByRole('button', { name: /Generate Cover Letter/i });
    coverLetterBtn.click();
    expect(onGenerateCoverLetter).toHaveBeenCalledTimes(1);
  });
});
