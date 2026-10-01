import { describe, it, expect } from 'vitest';
import { resumeReportExportService } from './resume-report-export.service.js';
import { buildReportData, scanForForbiddenValues } from './resume-report-data.js';
import type { JobMatchAnalysis } from '../../ai/job/job-types.js';
import type { ResumeDetailResponse } from './resume.types.js';

function makeResume(): ResumeDetailResponse {
  return {
    id: 'resume-1',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    fileSize: 1000,
    processingStatus: 'PROCESSED',
    score: 79,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedText: 'Sample resume text with React and Node experience.',
    structuredData: {
      sections: [
        { key: 'summary', title: 'Summary', content: 'Backend engineer with 3 years experience.' },
        { key: 'experience', title: 'Experience', content: 'Built APIs with Node.js and improved latency 20%.' },
        { key: 'education', title: 'Education', content: 'BSc Computer Science' },
        { key: 'skills', title: 'Skills', content: 'React, Node.js' },
      ],
      skills: ['React', 'Node.js'],
    },
    analysisResult: null,
    failureReason: null,
  } as unknown as ResumeDetailResponse;
}

function makeAnalysis(): JobMatchAnalysis {
  return {
    matchScore: 79,
    category: 'Good Match',
    overview: 'Your TypeScript and backend work aligns with the stack.',
    breakdown: { skills: 85, experience: 70, responsibilities: 60, keywords: 75, education: 90, projects: 50 },
    matchedSkills: ['React', 'Node.js'],
    missingRequiredSkills: ['GraphQL'],
    missingPreferredSkills: ['Docker'],
    skillDetail: {
      matchedRequired: ['React', 'Node.js'],
      missingRequired: ['GraphQL'],
      matchedPreferred: [],
      missingPreferred: ['Docker'],
      scorePercent: 85,
    },
    experienceDetail: {
      requiredYears: 3,
      detectedProfessionalYears: 2,
      detectedInternshipMonths: 0,
      detectedProjectCount: 1,
      matchLevel: 'partial',
      scorePercent: 70,
      note: 'Partial experience match.',
    },
    educationDetail: { required: ['BSc'], detected: ['BSc CS'], matchLevel: 'strong', scorePercent: 90 },
    responsibilityDetail: { matched: ['Build APIs'], unmatched: ['On-call'], scorePercent: 60 },
    keywordDetail: { found: ['React', 'Node.js'], missing: ['GraphQL'], scorePercent: 75 },
    projectDetail: {
      relevantProjects: [{ name: 'API Platform', technologies: ['Node.js'], relevantTech: ['Node.js'], relevancePercent: 80 }],
      scorePercent: 50,
    },
    strengths: ['Strong backend API experience'],
    recommendations: [{ priority: 'high', text: 'Add GraphQL only if experienced', impact: '+4 points' }],
  };
}

describe('resume report PDF export', () => {
  it('generates a readable PDF buffer', async () => {
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), makeAnalysis(), 'Backend Engineer');
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('produces text-selectable content with exact scores', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const analysis = makeAnalysis();
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), analysis);
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string; numpages: number }>)(buffer)) as {
      text: string;
      numpages: number;
    };
    expect(parsed.numpages).toBeGreaterThanOrEqual(1);
    expect(parsed.text).toContain('79/100');
    expect(parsed.text).toContain('Skills: 85/100');
    expect(parsed.text).toContain('Experience: 70/100');
    expect(parsed.text).toContain('Backend Engineer'.slice(0, 7));
  });

  it('contains no forbidden values', async () => {
    const { default: pdfParse } = await import('pdf-parse');
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), makeAnalysis());
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer)) as { text: string };
    for (const token of ['undefined', '[object Object]', 'NaN', '&amp;']) {
      expect(parsed.text).not.toContain(token);
    }
    const report = buildReportData({ resume: makeResume(), analysis: makeAnalysis() });
    expect(scanForForbiddenValues(report)).toEqual([]);
  });

  it('renders without analysis (deterministic resume score only)', async () => {
    const buffer = await resumeReportExportService.generateReportPdf(makeResume(), null);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    const { default: pdfParse } = await import('pdf-parse');
    const parsed = (await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer)) as { text: string };
    expect(parsed.text).toContain('79/100');
  });
});
