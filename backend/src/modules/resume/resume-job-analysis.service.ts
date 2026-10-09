import { parseJobDescription } from '../../ai/job/job-jd-parser.js';
import { matchResumeToJob } from '../../ai/job/resume-job-matcher.js';
import type { JobMatchAnalysis, JobRequirements } from '../../ai/job/job-types.js';
import type { StructuredResume } from '../../ai/resume/resume-types.js';
import { buildStructuredResume } from '../../ai/resume/resume-normalizer.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/errors.js';
import { aiInsightsService } from '../rag/ai-insights.service.js';
import { getRagConfig } from '../rag/rag.config.js';
import { ResumeRepository, resumeRepository } from './resume.repository.js';
import {
  ResumeJobAnalysisRepository,
  resumeJobAnalysisRepository,
} from './resume-job-analysis.repository.js';
import {
  analyzeJobSchema,
  type AnalyzeJobRequest,
  type AnalyzeJobResponse,
  type JobAnalysisDetailResponse,
  type JobAnalysisListItem,
} from './resume-job-analysis.types.js';
import { ZodError } from 'zod';

/**
 * Merges skills re-derived from the stored raw resume text (using the
 * current extractor) into an older stored structured resume. Fixes reports
 * for resumes processed before extraction improvements, without requiring
 * a re-upload. Only ever adds skills evidenced in the resume text.
 */
export function refreshSkillsFromExtractedText(
  structuredResume: StructuredResume,
  extractedText: string,
): StructuredResume {
  if (!structuredResume || !Array.isArray(structuredResume.skills)) {
    return structuredResume;
  }
  let refreshed: string[] = [];
  try {
    if (typeof extractedText !== 'string' || extractedText.trim().length === 0) {
      return structuredResume;
    }
    const rebuilt = buildStructuredResume(extractedText, []).skills;
    if (!Array.isArray(rebuilt)) return structuredResume;
    refreshed = rebuilt;
  } catch {
    return structuredResume;
  }
  if (refreshed.length === 0) return structuredResume;

  const merged = new Map<string, string>();
  for (const skill of [...structuredResume.skills, ...refreshed]) {
    const key = skill.trim().toLowerCase();
    if (key && !merged.has(key)) {
      merged.set(key, skill.trim());
    }
  }
  if (merged.size === structuredResume.skills.length) return structuredResume;
  return { ...structuredResume, skills: Array.from(merged.values()) };
}

export class ResumeJobAnalysisService {
  constructor(
    private readonly resumeRepo: ResumeRepository = resumeRepository,
    private readonly jobAnalysisRepo: ResumeJobAnalysisRepository = resumeJobAnalysisRepository,
  ) {}

  async analyzeResumeForJob(
    userId: string,
    input: AnalyzeJobRequest,
  ): Promise<AnalyzeJobResponse> {
    // 1. Validate input via Zod -> specific error codes (never raw ZodError).
    let validated: AnalyzeJobRequest;
    try {
      validated = analyzeJobSchema.parse(input);
    } catch (err) {
      const resumeIdForLog =
        typeof (input as { resumeId?: unknown } | null)?.resumeId === 'string'
          ? (input as { resumeId: string }).resumeId
          : undefined;
      if (err instanceof ZodError) {
        const paths = err.issues.map((i) => i.path.join('.'));
        const isResumeIdIssue = paths.some((p) => p.startsWith('resumeId'));
        logger.warn(
          {
            errorCode: isResumeIdIssue ? 'RESUME_NOT_FOUND' : 'INVALID_JOB_DESCRIPTION',
            stage: 'validate-input',
            resumeId: resumeIdForLog,
            userId,
            issues: err.flatten(),
          },
          'Job analysis input validation failed',
        );
        if (isResumeIdIssue) {
          throw new AppError('Invalid resume identifier', 400, 'RESUME_NOT_FOUND', {
            issues: err.flatten(),
          });
        }
        const tooLarge = err.issues.some((i) => i.code === 'too_big');
        throw new AppError(
          'Job description is invalid: must be 10-20000 characters',
          tooLarge ? 413 : 400,
          'INVALID_JOB_DESCRIPTION',
          { issues: err.flatten() },
        );
      }
      throw err;
    }

    // 2. Fetch resume and verify ownership
    let resumeRecord: Awaited<ReturnType<ResumeRepository['findByIdForUser']>>;
    try {
      resumeRecord = await this.resumeRepo.findByIdForUser(validated.resumeId, userId);
    } catch (err) {
      logger.error(
        {
          errorCode: 'DATABASE_ERROR',
          stage: 'resume-retrieval',
          resumeId: validated.resumeId,
          userId,
          err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
        },
        'Resume retrieval failed during job analysis',
      );
      throw new AppError('Unable to retrieve resume for analysis', 500, 'DATABASE_ERROR');
    }

    if (!resumeRecord) {
      logger.warn(
        { errorCode: 'RESUME_NOT_FOUND', stage: 'resume-retrieval', resumeId: validated.resumeId, userId },
        'Resume not found for job analysis',
      );
      throw new AppError('Resume not found', 404, 'RESUME_NOT_FOUND');
    }

    // 3. Ensure resume has been processed
    if (resumeRecord.processing_status !== 'PROCESSED') {
      logger.warn(
        {
          errorCode: 'RESUME_NOT_PROCESSED',
          stage: 'resume-status-check',
          resumeId: validated.resumeId,
          userId,
          processingStatus: resumeRecord.processing_status,
          failureReason: resumeRecord.failure_reason,
        },
        'Job analysis requested for unprocessed resume',
      );
      throw new AppError(
        `Resume must be fully processed before running job analysis (current status: ${resumeRecord.processing_status ?? 'unknown'})`,
        400,
        'RESUME_NOT_PROCESSED',
        { failureReason: resumeRecord.failure_reason ?? undefined },
      );
    }

    // 4. Retrieve structured resume data (created during NER phase)
    const structuredResume = resumeRecord.structured_data
      ?.structuredResume as StructuredResume | undefined;
    const extractedText = resumeRecord.extracted_text ?? '';

    if (!structuredResume || extractedText.trim().length === 0) {
      logger.warn(
        {
          errorCode: 'RESUME_TEXT_EMPTY',
          stage: 'resume-text-check',
          resumeId: validated.resumeId,
          userId,
          hasStructuredResume: Boolean(structuredResume),
          extractedTextLength: extractedText.length,
        },
        'Resume text unavailable for job analysis',
      );
      throw new AppError(
        'No readable resume text is available. Please re-upload or reprocess the resume.',
        400,
        'RESUME_TEXT_EMPTY',
      );
    }

    // 5-6. Parse the JD + execute deterministic match engine.
    // Any crash here is a server bug, never a RAG/AI issue: report it as such.
    let jobRequirements: JobRequirements;
    let matchAnalysis: JobMatchAnalysis;
    let effectiveResume: StructuredResume = structuredResume;
    try {
      jobRequirements = parseJobDescription(validated.jobDescription, validated.jobTitle);
      // Self-heal resumes processed by older extraction: re-derive skills
      // from the stored raw text with the current extractor and merge them
      // in, so previously dropped skills (e.g. "HTML", "Node.js") are not
      // reported missing. Stored data itself is left untouched.
      effectiveResume = refreshSkillsFromExtractedText(structuredResume, extractedText);
      matchAnalysis = matchResumeToJob(effectiveResume, jobRequirements);
    } catch (err) {
      logger.error(
        {
          errorCode: 'DETERMINISTIC_ANALYSIS_FAILED',
          stage: 'deterministic-analysis',
          resumeId: validated.resumeId,
          userId,
          err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
        },
        'Deterministic resume-job analysis failed',
      );
      throw new AppError(
        'Resume analysis failed while scoring the resume',
        500,
        'DETERMINISTIC_ANALYSIS_FAILED',
      );
    }

    // 7. RAG enhancement (non-blocking for scores): retrieval + AI reasoning
    // merged alongside deterministic results. Any failure degrades gracefully
    // to deterministic-only without breaking the scan.
    const warnings: string[] = [];
    let finalAnalysis = matchAnalysis;
    try {
      if (getRagConfig().enabled) {
        const timeoutMs = getRagConfig().timeoutMs;
        const insightsPromise = aiInsightsService
          .generateInsights({
            resume: effectiveResume,
            resumeText: resumeRecord.extracted_text ?? undefined,
            jobTitle: validated.jobTitle,
            jobDescription: validated.jobDescription,
            jobRequirements,
            deterministic: matchAnalysis,
          })
          .catch((innerErr: unknown) => {
            logger.warn(
              {
                errorCode: 'RAG_FAILED',
                stage: 'rag-insights',
                resumeId: validated.resumeId,
                userId,
                err: innerErr instanceof Error ? innerErr.message : String(innerErr),
              },
              'RAG insights promise rejected; continuing deterministic-only',
            );
            return null;
          });
        const insights = await Promise.race([
          insightsPromise,
          new Promise<null>((resolve) =>
            setTimeout(() => {
              logger.warn(
                {
                  errorCode: 'RAG_FAILED',
                  stage: 'rag-timeout',
                  resumeId: validated.resumeId,
                  userId,
                  timeoutMs,
                },
                'RAG insights timed out; continuing with deterministic analysis',
              );
              resolve(null);
            }, timeoutMs),
          ),
        ]);
        if (insights) {
          finalAnalysis = aiInsightsService.mergeWithDeterministic(matchAnalysis, insights);
        } else {
          warnings.push('AI insights unavailable; deterministic analysis was used.');
        }
      } else {
        warnings.push('AI insights disabled; deterministic analysis was used.');
      }
    } catch (err) {
      logger.warn(
        {
          errorCode: 'RAG_FAILED',
          stage: 'rag-merge',
          resumeId: validated.resumeId,
          userId,
          err: err instanceof Error ? err.message : String(err),
        },
        'RAG enhancement skipped',
      );
      finalAnalysis = matchAnalysis;
      warnings.push('AI insights unavailable; deterministic analysis was used.');
    }

    // 8. Persist analysis in database
    let savedRecord: Awaited<ReturnType<ResumeJobAnalysisRepository['create']>>;
    try {
      savedRecord = await this.jobAnalysisRepo.create({
        userId,
        resumeId: validated.resumeId,
        jobTitle: validated.jobTitle,
        jobDescription: validated.jobDescription,
        jobRequirements,
        matchScore: matchAnalysis.matchScore,
        analysisResult: finalAnalysis,
      });
    } catch (err) {
      logger.error(
        {
          errorCode: 'REPORT_BUILD_FAILED',
          stage: 'persist-analysis',
          resumeId: validated.resumeId,
          userId,
          err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
        },
        'Failed to persist job analysis',
      );
      throw new AppError('Failed to save job analysis', 500, 'REPORT_BUILD_FAILED');
    }

    // 9. Synchronize resume table score (non-critical: never fail the scan).
    try {
      await this.resumeRepo.updateProcessing(validated.resumeId, userId, {
        processingStatus: resumeRecord.processing_status,
        extractedText: resumeRecord.extracted_text,
        structuredData: resumeRecord.structured_data,
        analysisResult: resumeRecord.analysis_result,
        score: matchAnalysis.matchScore,
        failureReason: resumeRecord.failure_reason,
      });
    } catch (err) {
      logger.warn(
        {
          errorCode: 'REPORT_BUILD_FAILED',
          stage: 'sync-resume-score',
          resumeId: validated.resumeId,
          userId,
          err: err instanceof Error ? err.message : String(err),
        },
        'Resume score sync failed; analysis itself succeeded',
      );
      warnings.push('Analysis saved but resume score sync failed.');
    }

    return {
      success: true,
      data: finalAnalysis,
      analysisId: savedRecord.id,
      warnings,
    };

  }

  async listJobAnalyses(
    userId: string,
    resumeId: string,
  ): Promise<JobAnalysisListItem[]> {
    // Verify resume exists & user owns it
    const resumeRecord = await this.resumeRepo.findByIdForUser(resumeId, userId);
    if (!resumeRecord) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    return this.jobAnalysisRepo.listByResumeForUser(resumeId, userId);
  }

  async getLatestJobAnalysis(
    userId: string,
    resumeId: string,
  ): Promise<AnalyzeJobResponse | null> {
    // Verify resume exists & user owns it
    const resumeRecord = await this.resumeRepo.findByIdForUser(resumeId, userId);
    if (!resumeRecord) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    const latest = await this.jobAnalysisRepo.findLatestByResumeForUser(resumeId, userId);
    if (!latest || !latest.analysis_result) {
      return null;
    }

    return {
      success: true,
      data: latest.analysis_result as unknown as import('../../ai/job/job-types.js').JobMatchAnalysis,
      analysisId: latest.id,
      warnings: [],
    };
  }

  async getJobAnalysis(
    userId: string,
    resumeId: string,
    analysisId: string,
  ): Promise<JobAnalysisDetailResponse> {
    // Verify resume exists & user owns it
    const resumeRecord = await this.resumeRepo.findByIdForUser(resumeId, userId);
    if (!resumeRecord) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    const record = await this.jobAnalysisRepo.findByIdForUser(analysisId, userId);
    if (!record || record.resume_id !== resumeId || !record.analysis_result) {
      throw new AppError('Job analysis not found', 404, 'NOT_FOUND');
    }

    return {
      success: true,
      data: record.analysis_result as unknown as import('../../ai/job/job-types.js').JobMatchAnalysis,
      analysisId: record.id,
      resumeId: record.resume_id,
      jobTitle: record.job_title,
      jobDescription: record.job_description,
      createdAt: record.created_at,
    };
  }
}

export const resumeJobAnalysisService = new ResumeJobAnalysisService();
