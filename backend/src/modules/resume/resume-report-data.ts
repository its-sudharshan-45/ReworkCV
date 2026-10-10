/**
 * REPORT_DATA transformation layer.
 *
 * Pipeline: Existing Analysis + Existing Deterministic Scores -> REPORT_DATA -> PDF.
 *
 * Rules:
 * - Never calculates scores. All scores are copied verbatim from the
 *   deterministic match engine (JobMatchAnalysis) or resume analysis.
 * - Never fabricates data. Optional blocks are omitted when source data
 *   is unavailable.
 * - All dynamic resume/JD/AI text is sanitized (untrusted input).
 * - Contact info is masked.
 */

import type { JobMatchAnalysis } from '../../ai/job/job-types.js';
import type { ResumeDetailResponse } from './resume.types.js';

// ---------------------------------------------------------------------------
// Sanitization (treat resume/JD/AI content as untrusted input)
// ---------------------------------------------------------------------------

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#x2F;': '/',
  '&nbsp;': ' ',
};

export function decodeHtmlEntities(input: string): string {
  let out = input;
  for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
    out = out.split(entity).join(char);
  }
  // Numeric entities: &#123; and &#x1F;
  out = out.replace(/&#(\d+);/g, (_m, code: string) => {
    const n = parseInt(code, 10);
    return Number.isFinite(n) ? String.fromCharCode(n) : '';
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => {
    const n = parseInt(code, 16);
    return Number.isFinite(n) ? String.fromCharCode(n) : '';
  });
  return out;
}

export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  let out = decodeHtmlEntities(input);
  // Remove zero-width / control characters (keep \n and \t)
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Normalize smart quotes and dashes
  out = out
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...');
  // Normalize whitespace: collapse spaces/tabs, collapse >2 newlines to 2
  out = out.replace(/[ \t\u00A0]+/g, ' ');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

export function sanitizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const s = sanitizeText(item);
    if (s) out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Contact privacy
// ---------------------------------------------------------------------------

export function maskEmail(email: unknown): string | undefined {
  if (typeof email !== 'string') return undefined;
  const clean = email.trim();
  if (!clean || !clean.includes('@')) return undefined;
  const [local, domain] = clean.split('@');
  if (!local || !domain) return undefined;
  const first = sanitizeText(local).charAt(0) || '•';
  return `${first}••••@${sanitizeText(domain)}`;
}

export function maskPhone(phone: unknown): string | undefined {
  if (typeof phone !== 'string') return undefined;
  const clean = sanitizeText(phone);
  if (!clean) return undefined;
  const digits = clean.replace(/\D/g, '');
  if (digits.length < 4) return undefined;
  const last4 = digits.slice(-4);
  const prefix = clean.slice(0, 3);
  return `${prefix}••••${last4}`;
}

// ---------------------------------------------------------------------------
// REPORT_DATA types (stable structure for renderer; optional blocks omitted)
// ---------------------------------------------------------------------------

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

export interface ReportScores {
  /** Exact deterministic overall score. Never recalculated. */
  overall: number;
  /** Exact deterministic per-category breakdown. Never modified. */
  breakdown?: {
    skills: number;
    experience: number;
    responsibilities: number;
    keywords: number;
    education: number;
    projects: number;
  };
}

export interface ReportContent {
  /** Exact copy of breakdown.keywords (content proxy). */
  score?: number;
  summaryText?: string;
  experienceText?: string;
  recommendations?: Array<{ priority: string; text: string; impact?: string }>;
  bulletImprovements?: Array<{ original: string; issue: string; suggestion: string }>;
  keywordsFound?: string[];
  keywordsMissing?: string[];
}

export interface ReportSkillEntry {
  name: string;
}

export interface ReportSkills {
  matchedRequired?: string[];
  missingRequired?: string[];
  matchedPreferred?: string[];
  missingPreferred?: string[];
  /** JD soft skills evidenced in the resume (communication, …). */
  matchedSoft?: string[];
  /** JD soft skills not evidenced in the resume. */
  missingSoft?: string[];
}

export interface ReportFormat {
  experience?: {
    requiredYears: number | null;
    detectedProfessionalYears: number;
    matchLevel: string;
    scorePercent: number;
    note?: string;
  };
  education?: {
    required: string[];
    detected: string[];
    matchLevel: string;
    scorePercent: number;
  };
}

export interface ReportSections {
  present: Array<{ key: string; title: string }>;
  educationMatch?: string;
}

export interface ReportStyle {
  responsibilitiesMatched?: string[];
  responsibilitiesUnmatched?: string[];
  relevantProjects?: Array<{
    name: string;
    relevantTech: string[];
    relevancePercent: number;
  }>;
}

export interface ReportActionPlan {
  prioritized: Array<{ priority: string; text: string; impact?: string }>;
  quickWins?: Array<{ priority: string; text: string; impact?: string }>;
  keywordsToConsider?: string[];
  aiActions?: Array<{ priority: string; recommendation: string; reason?: string }>;
}

export interface ReportData {
  candidate: ReportCandidate;
  overview: ReportOverview;
  scores: ReportScores;
  content?: ReportContent;
  skills?: ReportSkills;
  format?: ReportFormat;
  sections?: ReportSections;
  style?: ReportStyle;
  action_plan?: ReportActionPlan;
  aiSummary?: string;
}

export interface BuildReportInput {
  resume: ResumeDetailResponse;
  analysis?: JobMatchAnalysis | null;
  jobTitle?: string | null;
}

function getStructuredPersonal(resume: ResumeDetailResponse): {
  name?: string;
  email?: string;
  phone?: string;
  links?: string[];
} {
  const structured = resume.structuredData as unknown as {
    personal?: { name?: string; phone?: string; email?: string; links?: string[] };
    structuredResume?: {
      personal?: { name?: string; phone?: string; email?: string; location?: string };
    };
  } | null;
  if (!structured || typeof structured !== 'object') return {};
  return {
    name: structured.personal?.name ?? structured.structuredResume?.personal?.name,
    email: structured.personal?.email ?? structured.structuredResume?.personal?.email,
    phone: structured.personal?.phone ?? structured.structuredResume?.personal?.phone,
    links: Array.isArray(structured.personal?.links) ? structured.personal.links : undefined,
  };
}

function getSectionContent(resume: ResumeDetailResponse, key: string): string | undefined {
  const sections = resume.structuredData?.sections;
  if (!Array.isArray(sections)) return undefined;
  const found = sections.find((s) => s.key === key);
  const text = sanitizeText(found?.content ?? '');
  return text ? text : undefined;
}

/**
 * Build validated REPORT_DATA from existing analysis. Copies scores verbatim.
 */
export function buildReportData(input: BuildReportInput): ReportData {
  const { resume, analysis, jobTitle } = input;

  const personal = getStructuredPersonal(resume);
  const name = sanitizeText(personal.name ?? '');
  const emailMasked = maskEmail(personal.email);
  const phoneMasked = maskPhone(personal.phone);
  const links = sanitizeList(personal.links);

  const candidate: ReportCandidate = {
    filename: sanitizeText(resume.originalFilename) || 'Resume',
  };
  if (name) candidate.name = name;
  if (emailMasked) candidate.emailMasked = emailMasked;
  if (phoneMasked) candidate.phoneMasked = phoneMasked;
  if (links.length > 0) candidate.links = links.slice(0, 5);

  const overall = analysis?.matchScore ?? resume.score ?? 0;
  const targetRoleRaw = jobTitle ?? (analysis as { jobTitle?: string } | null)?.jobTitle;
  const targetRole = sanitizeText(typeof targetRoleRaw === 'string' ? targetRoleRaw : '');

  const strengths = analysis ? sanitizeList(analysis.strengths) : [];
  const improvements = analysis
    ? sanitizeList(analysis.recommendations.map((r) => r.text))
    : [];
  const summary = analysis ? sanitizeText(analysis.overview) : '';

  const overview: ReportOverview = {
    reportDate: new Date().toLocaleDateString(),
    overallScore: overall,
    suggestionCount: improvements.length,
  };
  if (targetRole) overview.targetRole = targetRole;
  if (analysis?.category) overview.category = sanitizeText(analysis.category);
  if (summary) overview.summary = summary;
  if (strengths.length > 0) overview.strengths = strengths;
  if (improvements.length > 0) overview.improvements = improvements;

  const scores: ReportScores = { overall };
  if (analysis?.breakdown) {
    // Exact verbatim copy — never recalculated.
    scores.breakdown = {
      skills: analysis.breakdown.skills,
      experience: analysis.breakdown.experience,
      responsibilities: analysis.breakdown.responsibilities,
      keywords: analysis.breakdown.keywords,
      education: analysis.breakdown.education,
      projects: analysis.breakdown.projects,
    };
  }

  const report: ReportData = { candidate, overview, scores };

  if (analysis) {
    const content: ReportContent = {};
    if (Number.isFinite(analysis.breakdown?.keywords)) {
      content.score = analysis.breakdown.keywords;
    }
    const summaryText = getSectionContent(resume, 'summary');
    const experienceText = getSectionContent(resume, 'experience');
    if (summaryText) content.summaryText = summaryText;
    if (experienceText) content.experienceText = experienceText;
    const recs = (analysis.recommendations ?? [])
      .map((r) => ({
        priority: sanitizeText(r.priority) || 'medium',
        text: sanitizeText(r.text),
        impact: sanitizeText(r.impact) || undefined,
      }))
      .filter((r) => r.text);
    if (recs.length > 0) content.recommendations = recs;
    const bullets = (analysis.aiInsights?.bulletAnalysis ?? [])
      .map((b) => ({
        original: sanitizeText(b.original),
        issue: sanitizeText(b.issue),
        suggestion: sanitizeText(b.suggestion),
      }))
      .filter((b) => b.original || b.issue || b.suggestion);
    if (bullets.length > 0) content.bulletImprovements = bullets.slice(0, 10);
    const kwFound = sanitizeList(analysis.keywordDetail?.found);
    const kwMissing = sanitizeList(analysis.keywordDetail?.missing);
    if (kwFound.length > 0) content.keywordsFound = kwFound;
    if (kwMissing.length > 0) content.keywordsMissing = kwMissing;
    if (Object.keys(content).length > 0) report.content = content;

    const skillDetail = analysis.skillDetail;
    if (skillDetail) {
      const skills: ReportSkills = {};
      const mr = sanitizeList(skillDetail.matchedRequired);
      const mir = sanitizeList(skillDetail.missingRequired);
      const mp = sanitizeList(skillDetail.matchedPreferred);
      const mip = sanitizeList(skillDetail.missingPreferred);
      const ms = sanitizeList(skillDetail.matchedSoft);
      const mis = sanitizeList(skillDetail.missingSoft);
      if (mr.length > 0) skills.matchedRequired = mr;
      if (mir.length > 0) skills.missingRequired = mir;
      if (mp.length > 0) skills.matchedPreferred = mp;
      if (mip.length > 0) skills.missingPreferred = mip;
      // Tolerant read: analyses persisted before soft-skill reporting omit
      // these fields and simply leave the section out of the report.
      if (ms.length > 0) skills.matchedSoft = ms;
      if (mis.length > 0) skills.missingSoft = mis;
      if (Object.keys(skills).length > 0) report.skills = skills;
    }

    const format: ReportFormat = {};
    if (analysis.experienceDetail) {
      format.experience = {
        requiredYears: analysis.experienceDetail.requiredYears,
        detectedProfessionalYears: analysis.experienceDetail.detectedProfessionalYears,
        matchLevel: sanitizeText(analysis.experienceDetail.matchLevel) || 'unspecified',
        scorePercent: analysis.experienceDetail.scorePercent,
        note: sanitizeText(analysis.experienceDetail.note) || undefined,
      };
    }
    if (analysis.educationDetail) {
      const req = sanitizeList(analysis.educationDetail.required);
      const det = sanitizeList(analysis.educationDetail.detected);
      format.education = {
        required: req,
        detected: det,
        matchLevel: sanitizeText(analysis.educationDetail.matchLevel) || 'none',
        scorePercent: analysis.educationDetail.scorePercent,
      };
    }
    if (Object.keys(format).length > 0) report.format = format;

    const sectionsList = Array.isArray(resume.structuredData?.sections)
      ? resume.structuredData.sections
          .filter((s) => s?.key && s?.title)
          .map((s) => ({ key: sanitizeText(s.key), title: sanitizeText(s.title) }))
          .filter((s) => s.key && s.title)
      : [];
    if (sectionsList.length > 0 || analysis.educationDetail) {
      const sections: ReportSections = { present: sectionsList };
      if (analysis.educationDetail?.matchLevel) {
        sections.educationMatch = sanitizeText(analysis.educationDetail.matchLevel);
      }
      report.sections = sections;
    }

    const style: ReportStyle = {};
    const respMatched = sanitizeList(analysis.responsibilityDetail?.matched);
    const respUnmatched = sanitizeList(analysis.responsibilityDetail?.unmatched);
    if (respMatched.length > 0) style.responsibilitiesMatched = respMatched;
    if (respUnmatched.length > 0) style.responsibilitiesUnmatched = respUnmatched;
    const relProjects = (analysis.projectDetail?.relevantProjects ?? [])
      .map((p) => ({
        name: sanitizeText(p.name),
        relevantTech: sanitizeList(p.relevantTech),
        relevancePercent: p.relevancePercent,
      }))
      .filter((p) => p.name);
    if (relProjects.length > 0) style.relevantProjects = relProjects.slice(0, 10);
    if (Object.keys(style).length > 0) report.style = style;

    const prioritized = (analysis.recommendations ?? [])
      .map((r) => ({
        priority: sanitizeText(r.priority) || 'medium',
        text: sanitizeText(r.text),
        impact: sanitizeText(r.impact) || undefined,
      }))
      .filter((r) => r.text);
    if (prioritized.length > 0 || kwMissing.length > 0 || analysis.aiInsights) {
      const actionPlan: ReportActionPlan = { prioritized };
      const quickWins = prioritized.filter((r) => r.priority === 'high');
      if (quickWins.length > 0) actionPlan.quickWins = quickWins;
      if (kwMissing.length > 0) actionPlan.keywordsToConsider = kwMissing.slice(0, 12);
      const aiActions = (analysis.aiInsights?.recommendations ?? [])
        .map((r) => ({
          priority: sanitizeText(r.priority) || 'medium',
          recommendation: sanitizeText(r.recommendation),
          reason: sanitizeText(r.reason) || undefined,
        }))
        .filter((r) => r.recommendation);
      if (aiActions.length > 0) actionPlan.aiActions = aiActions.slice(0, 6);
      report.action_plan = actionPlan;
    }

    if (analysis.aiInsights?.summary) {
      const aiSummary = sanitizeText(analysis.aiInsights.summary);
      if (aiSummary) report.aiSummary = aiSummary;
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const FORBIDDEN_TOKENS = ['undefined', 'NaN', '[object Object]', '&amp;'];
// NOTE: the JSON literal `null` is a legitimate value for optional fields and
// must NOT be treated as a placeholder — scanning for it broke PDF export for
// every report containing a null field.

export function scanForForbiddenValues(report: ReportData): string[] {
  const found: string[] = [];
  const serialized = JSON.stringify(report);
  for (const token of FORBIDDEN_TOKENS) {
    if (serialized.includes(token)) found.push(token);
  }
  // Check literal "N/A" style placeholders are not emitted by builder
  // (builder never emits them; scan rendered strings only for object coercion)
  if (serialized.includes('[object Object]')) {
    if (!found.includes('[object Object]')) found.push('[object Object]');
  }
  return found;
}

export function validateReportScores(
  report: ReportData,
  analysis?: JobMatchAnalysis | null,
  resumeScore?: number | null,
): string[] {
  const errors: string[] = [];
  if (!analysis) return errors;
  if (report.scores.overall !== analysis.matchScore) {
    errors.push(`overall score mismatch: ${report.scores.overall} !== ${analysis.matchScore}`);
  }
  if (analysis.breakdown && report.scores.breakdown) {
    for (const key of ['skills', 'experience', 'responsibilities', 'keywords', 'education', 'projects'] as const) {
      if (report.scores.breakdown[key] !== analysis.breakdown[key]) {
        errors.push(`breakdown.${key} mismatch`);
      }
    }
  }
  if (report.content?.score !== undefined && report.content.score !== analysis.breakdown.keywords) {
    errors.push('content.score mismatch');
  }
  void resumeScore;
  return errors;
}
