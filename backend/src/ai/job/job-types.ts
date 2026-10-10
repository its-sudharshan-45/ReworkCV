/**
 * UpSkilr Job-Specific ATS Analysis — Types & Configurable Constants
 *
 * All weights and thresholds are defined here so they can be tuned
 * without touching the matching logic.
 */

import type { AiInsights } from '../../modules/rag/rag.types.js';

// ---------------------------------------------------------------------------
// Configurable ATS weighting (must sum to 1.0)
// ---------------------------------------------------------------------------
export const ATS_MATCH_WEIGHTS = {
  skills: 0.4,
  experience: 0.2,
  responsibilities: 0.15,
  keywords: 0.1,
  education: 0.05,
  projects: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Configurable match-category thresholds
// ---------------------------------------------------------------------------
export const MATCH_CATEGORY_THRESHOLDS = {
  excellent: 90,
  strong: 80,
  good: 70,
  moderate: 60,
} as const;

export type MatchCategory = 'Excellent Match' | 'Strong Match' | 'Good Match' | 'Moderate Match' | 'Low Match';

export function getMatchCategory(score: number): MatchCategory {
  if (score >= MATCH_CATEGORY_THRESHOLDS.excellent) return 'Excellent Match';
  if (score >= MATCH_CATEGORY_THRESHOLDS.strong) return 'Strong Match';
  if (score >= MATCH_CATEGORY_THRESHOLDS.good) return 'Good Match';
  if (score >= MATCH_CATEGORY_THRESHOLDS.moderate) return 'Moderate Match';
  return 'Low Match';
}

// ---------------------------------------------------------------------------
// Maximum job-description length (characters)
// ---------------------------------------------------------------------------
export const JD_MAX_LENGTH_CHARS = 20_000;
export const JD_MIN_LENGTH_CHARS = 10;

// ---------------------------------------------------------------------------
// Job requirement schema
// ---------------------------------------------------------------------------
export interface JobRequirements {
  title?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  /** Soft skills requested in the JD (communication, teamwork, …). Scoring-neutral. */
  softSkills: string[];
  experienceRequirements: string[];
  educationRequirements: string[];
  responsibilities: string[];
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Per-category scoring detail
// ---------------------------------------------------------------------------
export interface SkillMatchDetail {
  matchedRequired: string[];
  missingRequired: string[];
  matchedPreferred: string[];
  missingPreferred: string[];
  /** JD soft skills evidenced in the resume / missing. Scoring-neutral. */
  matchedSoft: string[];
  missingSoft: string[];
  scorePercent: number;
}

export interface ExperienceMatchDetail {
  requiredYears: number | null;
  detectedProfessionalYears: number;
  detectedInternshipMonths: number;
  detectedProjectCount: number;
  matchLevel: 'strong' | 'partial' | 'insufficient' | 'unspecified';
  scorePercent: number;
  note: string;
}

export interface EducationMatchDetail {
  required: string[];
  detected: string[];
  matchLevel: 'strong' | 'partial' | 'none';
  scorePercent: number;
}

export interface ResponsibilityMatchDetail {
  matched: string[];
  unmatched: string[];
  scorePercent: number;
}

export interface KeywordMatchDetail {
  found: string[];
  missing: string[];
  scorePercent: number;
}

export interface ProjectRelevance {
  name: string;
  technologies: string[];
  relevantTech: string[];
  relevancePercent: number;
}

export interface ProjectMatchDetail {
  relevantProjects: ProjectRelevance[];
  scorePercent: number;
}

// ---------------------------------------------------------------------------
// Final analysis output
// ---------------------------------------------------------------------------
export interface JobMatchBreakdown {
  skills: number;
  experience: number;
  responsibilities: number;
  keywords: number;
  education: number;
  projects: number;
}

export interface JobMatchAnalysis {
  matchScore: number;
  category: MatchCategory;
  overview: string;
  breakdown: JobMatchBreakdown;
  // Skills
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingPreferredSkills: string[];
  // Detail objects for rich UI
  skillDetail: SkillMatchDetail;
  experienceDetail: ExperienceMatchDetail;
  educationDetail: EducationMatchDetail;
  responsibilityDetail: ResponsibilityMatchDetail;
  keywordDetail: KeywordMatchDetail;
  projectDetail: ProjectMatchDetail;
  // Strengths & recommendations
  strengths: string[];
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    text: string;
    impact: string;
  }>;
  // RAG/AI insights (optional; deterministic fields above stay authoritative)
  aiInsights?: AiInsights;
}
