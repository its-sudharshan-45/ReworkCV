import { z } from 'zod';
import { JD_MAX_LENGTH_CHARS, JD_MIN_LENGTH_CHARS } from '../../ai/job/job-types.js';

// ---------------------------------------------------------------------------
// Zod validation schema for incoming analyze-job request
// ---------------------------------------------------------------------------
export const analyzeJobSchema = z.object({
  resumeId: z.string().uuid('resumeId must be a valid UUID'),
  jobDescription: z
    .string()
    .min(JD_MIN_LENGTH_CHARS, 'Job description is too short to produce a reliable match')
    .max(JD_MAX_LENGTH_CHARS, `Job description must not exceed ${JD_MAX_LENGTH_CHARS} characters`),
  jobTitle: z.string().max(200).optional(),
});

export type AnalyzeJobRequest = z.infer<typeof analyzeJobSchema>;

// ---------------------------------------------------------------------------
// Database record
// ---------------------------------------------------------------------------
export interface ResumeJobAnalysisRecord {
  id: string;
  user_id: string;
  resume_id: string;
  job_title: string | null;
  job_description: string;
  job_requirements: Record<string, unknown> | null;
  match_score: number;
  analysis_result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------
export interface JobAnalysisListItem {
  id: string;
  resumeId: string;
  jobTitle: string | null;
  matchScore: number;
  category: string;
  createdAt: string;
}

export interface AnalyzeJobResponse {
  success: true;
  data: import('../../ai/job/job-types.js').JobMatchAnalysis;
  analysisId: string;
  /** Non-fatal degradation notes (RAG/AI fallback, score-sync skip). Empty on clean runs. */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Single-analysis detail response (powers the dedicated report page route)
// ---------------------------------------------------------------------------
export interface JobAnalysisDetailResponse {
  success: true;
  data: import('../../ai/job/job-types.js').JobMatchAnalysis;
  analysisId: string;
  resumeId: string;
  jobTitle: string | null;
  jobDescription: string;
  createdAt: string;
}
