import { describe, it, expect } from 'vitest';
import { buildReportData, getCategoryScores } from './report-data';
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';

function makeResume(): ResumeDetail {
  return {
    id: 'r1',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    fileSize: 1000,
    processingStatus: 'PROCESSED',
    score: 77,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedText: null,
    structuredData: {
      sections: [
        { key: 'summary', title: 'Summary', content: 'Engineer' },
        { key: 'experience', title: 'Experience', content: 'Built APIs' },
      ],
      skills: ['React'],
    },
    analysisResult: null,
    failureReason: null,
  };
}

function makeAnalysis(): JobMatchAnalysis {
  return {
    matchScore: 79,
    category: 'Good Match',
    overview: 'Solid alignment.',
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
      note: 'Partial.',
    },
    educationDetail: { required: [], detected: [], matchLevel: 'strong', scorePercent: 90 },
    responsibilityDetail: { matched: [], unmatched: [], scorePercent: 60 },
    keywordDetail: { found: ['React'], missing: ['GraphQL'], scorePercent: 75 },
    projectDetail: { relevantProjects: [], scorePercent: 50 },
    strengths: ['Strong React'],
    recommendations: [{ priority: 'high', text: 'Add GraphQL if experienced', impact: '+4' }],
  };
}

describe('frontend REPORT_DATA', () => {
  it('preserves exact deterministic scores', () => {
    const report = buildReportData(makeAnalysis(), makeResume(), 'Backend Engineer');
    expect(report.overallScore).toBe(79);
    expect(report.breakdown).toEqual(makeAnalysis().breakdown);
    expect(report.contentScore).toBe(75);
    const cats = getCategoryScores(report);
    expect(cats).toEqual({ content: 75, skills: 85, format: 60, sections: 90, style: 70 });
  });

  it('omits missing optional data', () => {
    const report = buildReportData(null, makeResume());
    expect(report.overallScore).toBe(77);
    expect(report.breakdown).toBeUndefined();
    expect(report.matchedRequired).toEqual([]);
    expect(report.recommendations).toEqual([]);
    expect(report.aiSummary).toBeUndefined();
  });

  it('never emits placeholders and masks contacts', () => {
    const resume = makeResume();
    (resume.structuredData as unknown as Record<string, unknown>).structuredResume = {
      personal: { name: 'Alex', email: 'alex@example.com', phone: '+1-555-0199' },
    };
    const report = buildReportData(makeAnalysis(), resume);
    expect(report.candidate.emailMasked).toBe('a••••@example.com');
    expect(JSON.stringify(report)).not.toContain('alex@example.com');
    expect(JSON.stringify(report)).not.toContain('undefined');
    expect(JSON.stringify(report)).not.toContain('[object Object]');
  });

  it('handles long content', () => {
    const longSkill = `skill-${'x'.repeat(300)}`;
    const analysis = makeAnalysis();
    analysis.skillDetail.matchedRequired = [longSkill];
    const report = buildReportData(analysis, makeResume(), `Role ${'y'.repeat(300)}`);
    expect(report.matchedRequired[0]).toBe(longSkill);
    expect(report.overview.targetRole?.length).toBeGreaterThan(200);
  });
});
