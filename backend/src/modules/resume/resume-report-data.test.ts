import { describe, it, expect } from 'vitest';
import {
  buildReportData,
  maskEmail,
  maskPhone,
  sanitizeText,
  scanForForbiddenValues,
  validateReportScores,
} from './resume-report-data.js';
import type { JobMatchAnalysis } from '../../ai/job/job-types.js';
import type { ResumeDetailResponse } from './resume.types.js';

function makeResume(overrides: Partial<ResumeDetailResponse> = {}): ResumeDetailResponse {
  return {
    id: 'resume-1',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    fileSize: 1000,
    processingStatus: 'PROCESSED',
    score: 77,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    extractedText: 'text',
    structuredData: {
      sections: [
        { key: 'summary', title: 'Summary', content: 'Experienced engineer' },
        { key: 'experience', title: 'Experience', content: 'Company A' },
        { key: 'skills', title: 'Skills', content: 'React, Node' },
      ],
      skills: ['React', 'Node'],
      structuredResume: {
        personal: { name: 'Alex Johnson', email: 'alex.johnson@example.com', phone: '+1-555-0199' },
        skills: ['React'],
        experience: [],
        education: [],
        projects: [],
        certifications: [],
        languages: [],
      },
    },
    analysisResult: null,
    failureReason: null,
    ...overrides,
  } as ResumeDetailResponse;
}

function makeAnalysis(overrides: Partial<JobMatchAnalysis> = {}): JobMatchAnalysis {
  return {
    matchScore: 79,
    category: 'Good Match',
    overview: 'Strong alignment with the role.',
    breakdown: { skills: 85, experience: 70, responsibilities: 60, keywords: 75, education: 90, projects: 50 },
    matchedSkills: ['React'],
    missingRequiredSkills: ['GraphQL'],
    missingPreferredSkills: ['Docker'],
    skillDetail: {
      matchedRequired: ['React'],
      missingRequired: ['GraphQL'],
      matchedPreferred: [],
      missingPreferred: ['Docker'],
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
    educationDetail: { required: ['BSc'], detected: ['BSc CS'], matchLevel: 'strong', scorePercent: 90 },
    responsibilityDetail: { matched: ['Build APIs'], unmatched: ['On-call'], scorePercent: 60 },
    keywordDetail: { found: ['React'], missing: ['GraphQL'], scorePercent: 75 },
    projectDetail: {
      relevantProjects: [{ name: 'P1', technologies: ['React'], relevantTech: ['React'], relevancePercent: 80 }],
      scorePercent: 50,
    },
    strengths: ['Strong React skills'],
    recommendations: [{ priority: 'high', text: 'Add GraphQL if experienced', impact: '+4 points' }],
    ...overrides,
  };
}

describe('REPORT_DATA builder', () => {
  it('preserves exact deterministic scores', () => {
    const resume = makeResume();
    const analysis = makeAnalysis();
    const report = buildReportData({ resume, analysis, jobTitle: 'Senior Engineer' });
    expect(report.scores.overall).toBe(79);
    expect(report.scores.breakdown).toEqual(analysis.breakdown);
    expect(report.content?.score).toBe(75);
    expect(validateReportScores(report, analysis)).toEqual([]);
  });

  it('omits optional data when unavailable', () => {
    const resume = makeResume({ structuredData: { sections: [], skills: [] } } as never);
    const report = buildReportData({ resume, analysis: null });
    expect(report.scores.overall).toBe(77);
    expect(report.content).toBeUndefined();
    expect(report.skills).toBeUndefined();
    expect(report.format).toBeUndefined();
    expect(report.action_plan).toBeUndefined();
  });

  it('handles empty sections gracefully', () => {
    const resume = makeResume();
    const analysis = makeAnalysis({
      strengths: [],
      recommendations: [],
      skillDetail: {
        matchedRequired: [],
        missingRequired: [],
        matchedPreferred: [],
        missingPreferred: [],
        scorePercent: 0,
      },
    });
    const report = buildReportData({ resume, analysis });
    expect(report.overview.strengths).toBeUndefined();
    expect(report.overview.improvements).toBeUndefined();
    expect(report.skills).toBeUndefined();
  });

  it('handles long content without breaking structure', () => {
    const longSkill = `very-long-skill-name-${'x'.repeat(200)}`;
    const longTitle = `Senior ${'Engineer '.repeat(30)}`;
    const resume = makeResume();
    const analysis = makeAnalysis({
      skillDetail: {
        matchedRequired: [longSkill],
        missingRequired: [],
        matchedPreferred: [],
        missingPreferred: [],
        scorePercent: 80,
      },
    });
    const report = buildReportData({ resume, analysis, jobTitle: longTitle });
    expect(report.skills?.matchedRequired?.[0]).toBe(longSkill);
    expect(report.overview.targetRole).toContain('Senior');
    expect(scanForForbiddenValues(report)).toEqual([]);
  });

  it('sanitizes special characters and entities', () => {
    expect(sanitizeText('a &amp; b')).toBe('a & b');
    expect(sanitizeText('“smart” – dash…')).toBe('"smart" - dash...');
    expect(sanitizeText('a​b⁠c')).toBe('abc');
    const resume = makeResume();
    const analysis = makeAnalysis({ overview: 'x &amp; y [object Object]' });
    const report = buildReportData({ resume, analysis });
    // decoded entity is fine; object coercion string from source is preserved as text
    // but builder itself must not introduce forbidden tokens
    expect(report.overview.summary).toContain('x & y');
  });

  it('masks contact information', () => {
    expect(maskEmail('sandra@gmail.com')).toBe('s••••@gmail.com');
    expect(maskPhone('+91-9012346771')).toContain('••••');
    expect(maskPhone('+91-9012346771')!.endsWith('6771')).toBe(true);
    const resume = makeResume();
    const report = buildReportData({ resume, analysis: makeAnalysis() });
    expect(report.candidate.emailMasked).toBe('a••••@example.com');
    expect(report.candidate.phoneMasked).toContain('••••');
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('alex.johnson@example.com');
  });
});
