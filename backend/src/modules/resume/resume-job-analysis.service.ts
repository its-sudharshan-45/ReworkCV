import { parseJobDescription } from '../../ai/job/job-jd-parser.js';
import { matchResumeToJob } from '../../ai/job/resume-job-matcher.js';
import type { StructuredResume } from '../../ai/resume/resume-types.js';
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

export class ResumeJobAnalysisService {
  constructor(
    private readonly resumeRepo: ResumeRepository = resumeRepository,
    private readonly jobAnalysisRepo: ResumeJobAnalysisRepository = resumeJobAnalysisRepository,
  ) {}

  async analyzeResumeForJob(
    userId: string,
    input: AnalyzeJobRequest,
  ): Promise<AnalyzeJobResponse> {
    // 1. Validate input via Zod
    const validated = analyzeJobSchema.parse(input);

    // 2. Fetch resume and verify ownership
    const resumeRecord = await this.resumeRepo.findByIdForUser(
      validated.resumeId,
      userId,
    );

    if (!resumeRecord) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    // 3. Ensure resume has been processed
    if (resumeRecord.processing_status !== 'PROCESSED') {
      throw new AppError(
        'Resume must be fully processed before running job analysis',
        400,
        'VALIDATION_ERROR',
      );
    }

    // 4. Retrieve structured resume data (created during NER phase)
    const structuredResume = resumeRecord.structured_data
      ?.structuredResume as StructuredResume | undefined;

    if (!structuredResume) {
      throw new AppError(
        'Structured resume information is unavailable. Please reprocess the resume.',
        400,
        'VALIDATION_ERROR',
      );
    }

    // 5. Parse the job description into structured requirements
    const jobRequirements = parseJobDescription(
      validated.jobDescription,
      validated.jobTitle,
    );

    // 6. Execute deterministic match engine
    const matchAnalysis = matchResumeToJob(structuredResume, jobRequirements);

    // 7. RAG enhancement (non-blocking for scores): retrieval + AI reasoning
    // merged alongside deterministic results. Any failure degrades gracefully
    // to deterministic-only without breaking the scan.
    let finalAnalysis = matchAnalysis;
    try {
      if (getRagConfig().enabled) {
        const timeoutMs = getRagConfig().timeoutMs;
        const insights = await Promise.race([
          aiInsightsService.generateInsights({
            resume: structuredResume,
            resumeText: resumeRecord.extracted_text ?? undefined,
            jobTitle: validated.jobTitle,
            jobDescription: validated.jobDescription,
            jobRequirements,
            deterministic: matchAnalysis,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
        ]);
        finalAnalysis = aiInsightsService.mergeWithDeterministic(matchAnalysis, insights);
      }
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'RAG enhancement skipped');
      finalAnalysis = matchAnalysis;
    }

    // 8. Persist analysis in database
    const savedRecord = await this.jobAnalysisRepo.create({
      userId,
      resumeId: validated.resumeId,
      jobTitle: validated.jobTitle,
      jobDescription: validated.jobDescription,
      jobRequirements,
      matchScore: matchAnalysis.matchScore,
      analysisResult: finalAnalysis,
    });

    // 8. Synchronize resume table score with the latest match score
    await this.resumeRepo.updateProcessing(validated.resumeId, userId, {
      processingStatus: resumeRecord.processing_status,
      extractedText: resumeRecord.extracted_text,
      structuredData: resumeRecord.structured_data,
      analysisResult: resumeRecord.analysis_result,
      score: matchAnalysis.matchScore,
      failureReason: resumeRecord.failure_reason,
    });

    return {
      success: true,
      data: finalAnalysis,
      analysisId: savedRecord.id,
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
