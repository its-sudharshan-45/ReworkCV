/**
 * REPORT_DATA transformation layer (frontend).
 * Converts the existing JobMatchAnalysis + ResumeDetail into a stable
 * report structure. Copies deterministic scores verbatim — never recalculates.
 */
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';
import { sanitizeList, sanitizeText } from './sanitize';
import { maskEmail, maskPhone } from './privacy';

export interface ReportCandidate {
  name?: string;
  emailMasked?: string;
  phoneMasked?: string;
  links?: string[];
  filename: string;
}

export interface ReportOverview {
  targetRole?: string;
  reportDate: string;
  overallScore: number;
  category?: string;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  suggestionCount: number;
}

export interface ReportBreakdown {
  skills: number;
  experience: number;
  responsibilities: number;
  keywords: number;
  education: number;
  projects: number;
}

export interface ReportData {
  candidate: ReportCandidate;
  overview: ReportOverview;
  breakdown?: ReportBreakdown;
  overallScore: number;
  contentScore?: number;
  matchedRequired: string[];
  missingRequired: string[];
  matchedPreferred: string[];
  missingPreferred: string[];
  matchedSoft: string[];
  missingSoft: string[];
  keywordsFound: string[];
  keywordsMissing: string[];
  recommendations: Array<{ priority: string; text: string; impact?: string }>;
  experienceNote?: string;
  experienceYears?: { required: number | null; detected: number; level: string };
  educationMatch?: { required: string[]; detected: string[]; level: string };
  responsibilitiesMatched: string[];
  responsibilitiesUnmatched: string[];
  relevantProjects: Array<{ name: string; relevantTech: string[]; relevancePercent: number }>;
  presentSections: Array<{ key: string; title: string }>;
  summaryText?: string;
  experienceText?: string;
  aiSummary?: string;
}

function getPersonal(resume: ResumeDetail | null | undefined): {
  name?: string;
  email?: string;
  phone?: string;
  links?: string[];
} {
  const structured = resume?.structuredData as unknown as {
    personal?: { name?: string; phone?: string; email?: string; links?: string[] };
    structuredResume?: { personal?: { name?: string; phone?: string; email?: string } };
  } | null;
  if (!structured || typeof structured !== 'object') return {};
  return {
    name: structured.personal?.name ?? structured.structuredResume?.personal?.name,
    email: structured.personal?.email ?? structured.structuredResume?.personal?.email,
    phone: structured.personal?.phone ?? structured.structuredResume?.personal?.phone,
    links: Array.isArray(structured.personal?.links) ? structured.personal.links : undefined,
  };
}

function getSection(resume: ResumeDetail | null | undefined, key: string): string | undefined {
  const sections = resume?.structuredData?.sections;
  if (!Array.isArray(sections)) return undefined;
  const found = sections.find((s) => s.key === key);
  const text = sanitizeText(found?.content ?? '');
  return text ? text : undefined;
}

export function buildReportData(
  analysis: JobMatchAnalysis | null | undefined,
  resume: ResumeDetail | null | undefined,
  jobTitle?: string,
): ReportData {
  const personal = getPersonal(resume);
  const name = sanitizeText(personal.name ?? '');
  const candidate: ReportCandidate = {
    filename: sanitizeText(resume?.originalFilename ?? '') || 'Resume',
  };
  if (name) candidate.name = name;
  const emailMasked = maskEmail(personal.email);
  const phoneMasked = maskPhone(personal.phone);
  if (emailMasked) candidate.emailMasked = emailMasked;
  if (phoneMasked) candidate.phoneMasked = phoneMasked;
  const links = sanitizeList(personal.links);
  if (links.length > 0) candidate.links = links.slice(0, 5);

  const overallScore = analysis?.matchScore ?? resume?.score ?? 0;
  const targetRole = sanitizeText(jobTitle ?? '');

  const strengths = analysis ? sanitizeList(analysis.strengths) : [];
  const recommendations = (analysis?.recommendations ?? [])
    .map((r) => ({
      priority: sanitizeText(r.priority) || 'medium',
      text: sanitizeText(r.text),
      impact: sanitizeText(r.impact) || undefined,
    }))
    .filter((r) => r.text);
  const improvements = recommendations.map((r) => r.text);
  const summary = analysis ? sanitizeText(analysis.overview) : '';

  const overview: ReportOverview = {
    reportDate: new Date().toLocaleDateString(),
    overallScore,
    suggestionCount: recommendations.length,
  };
  if (targetRole) overview.targetRole = targetRole;
  if (analysis?.category) overview.category = sanitizeText(analysis.category);
  if (summary) overview.summary = summary;
  if (strengths.length > 0) overview.strengths = strengths;
  if (improvements.length > 0) overview.improvements = improvements;

  const breakdown: ReportBreakdown | undefined = analysis?.breakdown
    ? {
        skills: analysis.breakdown.skills,
        experience: analysis.breakdown.experience,
        responsibilities: analysis.breakdown.responsibilities,
        keywords: analysis.breakdown.keywords,
        education: analysis.breakdown.education,
        projects: analysis.breakdown.projects,
      }
    : undefined;

  const presentSections = Array.isArray(resume?.structuredData?.sections)
    ? resume.structuredData.sections
        .filter((s) => s?.key && s?.title)
        .map((s) => ({ key: sanitizeText(s.key), title: sanitizeText(s.title) }))
        .filter((s) => s.key && s.title)
    : [];

  return {
    candidate,
    overview,
    breakdown,
    overallScore,
    contentScore: breakdown?.keywords,
    matchedRequired: sanitizeList(analysis?.skillDetail?.matchedRequired),
    missingRequired: sanitizeList(analysis?.skillDetail?.missingRequired),
    matchedPreferred: sanitizeList(analysis?.skillDetail?.matchedPreferred),
    missingPreferred: sanitizeList(analysis?.skillDetail?.missingPreferred),
    matchedSoft: sanitizeList(analysis?.skillDetail?.matchedSoft),
    missingSoft: sanitizeList(analysis?.skillDetail?.missingSoft),
    keywordsFound: sanitizeList(analysis?.keywordDetail?.found),
    keywordsMissing: sanitizeList(analysis?.keywordDetail?.missing),
    recommendations,
    experienceNote: analysis?.experienceDetail ? sanitizeText(analysis.experienceDetail.note) || undefined : undefined,
    experienceYears: analysis?.experienceDetail
      ? {
          required: analysis.experienceDetail.requiredYears,
          detected: analysis.experienceDetail.detectedProfessionalYears,
          level: sanitizeText(analysis.experienceDetail.matchLevel) || 'unspecified',
        }
      : undefined,
    educationMatch: analysis?.educationDetail
      ? {
          required: sanitizeList(analysis.educationDetail.required),
          detected: sanitizeList(analysis.educationDetail.detected),
          level: sanitizeText(analysis.educationDetail.matchLevel) || 'none',
        }
      : undefined,
    responsibilitiesMatched: sanitizeList(analysis?.responsibilityDetail?.matched),
    responsibilitiesUnmatched: sanitizeList(analysis?.responsibilityDetail?.unmatched),
    relevantProjects: (analysis?.projectDetail?.relevantProjects ?? [])
      .map((p) => ({
        name: sanitizeText(p.name),
        relevantTech: sanitizeList(p.relevantTech),
        relevancePercent: p.relevancePercent,
      }))
      .filter((p) => p.name)
      .slice(0, 10),
    presentSections,
    summaryText: getSection(resume, 'summary'),
    experienceText: getSection(resume, 'experience'),
    aiSummary: analysis?.aiInsights?.summary ? sanitizeText(analysis.aiInsights.summary) : undefined,
  };
}

/** Category scores mapped to the 5 reference rails. Exact copies, no math. */
export function getCategoryScores(report: ReportData): {
  content: number;
  skills: number;
  format: number;
  sections: number;
  style: number;
} | null {
  if (!report.breakdown) return null;
  return {
    content: report.breakdown.keywords,
    skills: report.breakdown.skills,
    format: report.breakdown.responsibilities,
    sections: report.breakdown.education,
    style: report.breakdown.experience,
  };
}
