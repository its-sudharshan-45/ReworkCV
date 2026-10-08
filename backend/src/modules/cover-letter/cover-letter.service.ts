import { AppError } from '../../utils/errors.js';
import { resumeRepository } from '../resume/resume.repository.js';
import { resumeJobAnalysisRepository } from '../resume/resume-job-analysis.repository.js';
import { coverLetterRepository, CoverLetterRepository } from './cover-letter.repository.js';
import { generateCoverLetterText } from '../../ai/cover-letter/cover-letter-generator.js';
import { coverLetterExportService, CoverLetterExportService } from './cover-letter-export.service.js';
import { sanitizeDownloadFilename } from '../../utils/download.js';
import type {
  CoverLetterRecord,
  CoverLetterResponse,
  GenerateCoverLetterInput,
  RewriteCoverLetterInput,
  UpdateCoverLetterInput,
} from './cover-letter.types.js';
import type { StructuredResume } from '../../ai/resume/resume-types.js';

export function mapCoverLetterToResponse(record: CoverLetterRecord): CoverLetterResponse {
  return {
    id: record.id,
    userId: record.user_id,
    resumeId: record.resume_id,
    jobAnalysisId: record.job_analysis_id,
    jobTitle: record.job_title,
    companyName: record.company_name,
    jobDescription: record.job_description,
    content: record.content,
    tone: record.tone,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export class CoverLetterService {
  constructor(
    private readonly repository: CoverLetterRepository = coverLetterRepository,
    private readonly exportService: CoverLetterExportService = coverLetterExportService,
  ) {}

  async generateCoverLetter(userId: string, input: GenerateCoverLetterInput): Promise<CoverLetterResponse> {
    const companyName = (input.companyName || '').slice(0, 200) || null;
    const tone = input.tone === 'confident' || input.tone === 'enthusiastic' ? input.tone : 'professional';
    const resume = await resumeRepository.findByIdForUser(input.resumeId, userId);
    if (!resume) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    let jobDescription = input.jobDescription || '';
    let jobTitle = (input.jobTitle || '').slice(0, 200);
    let analysisContext = null;

    if (input.jobAnalysisId) {
      const analysisRecord = await resumeJobAnalysisRepository.findByIdForUser(input.jobAnalysisId, userId);
      if (analysisRecord) {
        if (!jobDescription) jobDescription = analysisRecord.job_description;
        if (!jobTitle) jobTitle = analysisRecord.job_title || '';
        analysisContext = analysisRecord.analysis_result as unknown as import('../../ai/job/job-types.js').JobMatchAnalysis;
      }
    } else {
      const latestAnalysis = await resumeJobAnalysisRepository.findLatestByResumeForUser(input.resumeId, userId);
      if (latestAnalysis) {
        if (!jobDescription) jobDescription = latestAnalysis.job_description;
        if (!jobTitle) jobTitle = latestAnalysis.job_title || '';
        analysisContext = latestAnalysis.analysis_result as unknown as import('../../ai/job/job-types.js').JobMatchAnalysis;
      }
    }

    if (!jobDescription || jobDescription.trim().length < 10) {
      throw new AppError('A valid job description is required to generate a cover letter', 400, 'VALIDATION_ERROR');
    }
    if (jobDescription.length > 20_000) {
      throw new AppError('Job description must be 20000 characters or fewer', 413, 'VALIDATION_ERROR');
    }

    const structuredData = resume.structured_data;
    const structuredResume: StructuredResume | undefined =
      structuredData?.structuredResume ||
      (structuredData as unknown as { structuredResume?: StructuredResume })?.structuredResume;

    const rawPersonal = structuredData as {
      personal?: { name?: string; phone?: string; email?: string; location?: string };
    } | null;

    const candidateName =
      structuredResume?.personal?.name ||
      rawPersonal?.personal?.name ||
      resume.original_filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    const candidateEmail = structuredResume?.personal?.email || rawPersonal?.personal?.email;
    const candidatePhone = structuredResume?.personal?.phone || rawPersonal?.personal?.phone;
    const candidateLocation = structuredResume?.personal?.location || rawPersonal?.personal?.location;

    const content = await generateCoverLetterText({
      candidateName,
      candidateEmail,
      candidatePhone,
      candidateLocation,
      structuredResume,
      extractedResumeText: resume.extracted_text || undefined,
      jobTitle,
      companyName: companyName || undefined,
      jobDescription,
      analysisContext,
      tone,
    });

    const record = await this.repository.create({
      userId,
      resumeId: input.resumeId,
      jobAnalysisId: input.jobAnalysisId ?? null,
      jobTitle: jobTitle || null,
      companyName,
      jobDescription,
      content,
      tone,
    });

    return mapCoverLetterToResponse(record);
  }

  async listCoverLetters(userId: string): Promise<CoverLetterResponse[]> {
    const records = await this.repository.listByUserId(userId);
    return records.map(mapCoverLetterToResponse);
  }

  async getCoverLetter(id: string, userId: string): Promise<CoverLetterResponse> {
    const record = await this.repository.findByIdForUser(id, userId);
    if (!record) {
      throw new AppError('Cover letter not found', 404, 'NOT_FOUND');
    }
    return mapCoverLetterToResponse(record);
  }

  async updateCoverLetter(id: string, userId: string, input: UpdateCoverLetterInput): Promise<CoverLetterResponse> {
    if (typeof input.content !== 'string' || input.content.trim().length === 0) {
      throw new AppError('Cover letter content is required', 400, 'VALIDATION_ERROR');
    }
    if (input.content.length > 20_000) {
      throw new AppError('Cover letter content must be 20000 characters or fewer', 413, 'VALIDATION_ERROR');
    }
    const updated = await this.repository.updateContent(id, userId, input.content);
    if (!updated) {
      throw new AppError('Cover letter not found', 404, 'NOT_FOUND');
    }
    return mapCoverLetterToResponse(updated);
  }

  /**
   * Revise an owned cover letter using the candidate's own suggestions.
   * The rewrite is grounded in the same resume + job context as the original
   * draft; only the requested changes are applied.
   */
  async rewriteCoverLetter(
    id: string,
    userId: string,
    input: RewriteCoverLetterInput,
  ): Promise<CoverLetterResponse> {
    const feedback = (input.feedback ?? '').trim();
    if (feedback.length < 3) {
      throw new AppError('Please describe the changes you would like (at least 3 characters)', 400, 'VALIDATION_ERROR');
    }
    if (feedback.length > 2000) {
      throw new AppError('Feedback must be 2000 characters or fewer', 400, 'VALIDATION_ERROR');
    }

    const record = await this.repository.findByIdForUser(id, userId);
    if (!record) {
      throw new AppError('Cover letter not found', 404, 'NOT_FOUND');
    }

    const resume = await resumeRepository.findByIdForUser(record.resume_id, userId);
    if (!resume) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    let analysisContext = null;
    if (record.job_analysis_id) {
      const analysisRecord = await resumeJobAnalysisRepository.findByIdForUser(record.job_analysis_id, userId);
      if (analysisRecord) {
        analysisContext = analysisRecord.analysis_result as unknown as import('../../ai/job/job-types.js').JobMatchAnalysis;
      }
    }

    const structuredData = resume.structured_data;
    const structuredResume: StructuredResume | undefined =
      structuredData?.structuredResume ||
      (structuredData as unknown as { structuredResume?: StructuredResume })?.structuredResume;

    const content = await generateCoverLetterText({
      structuredResume,
      extractedResumeText: resume.extracted_text || undefined,
      jobTitle: record.job_title || undefined,
      companyName: record.company_name || undefined,
      jobDescription: record.job_description,
      analysisContext,
      tone: (record.tone as 'professional' | 'confident' | 'enthusiastic') || 'professional',
      previousLetter: record.content,
      userFeedback: feedback,
    });

    const updated = await this.repository.updateContent(id, userId, content);
    if (!updated) {
      throw new AppError('Cover letter not found', 404, 'NOT_FOUND');
    }
    return mapCoverLetterToResponse(updated);
  }

  async deleteCoverLetter(id: string, userId: string): Promise<void> {
    const deleted = await this.repository.deleteByIdForUser(id, userId);
    if (!deleted) {
      throw new AppError('Cover letter not found', 404, 'NOT_FOUND');
    }
  }

  async exportCoverLetter(id: string, userId: string, format: 'pdf' | 'docx'): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const record = await this.repository.findByIdForUser(id, userId);
    if (!record) {
      throw new AppError('Cover letter not found', 404, 'NOT_FOUND');
    }

    const resume = await resumeRepository.findByIdForUser(record.resume_id, userId);
    const candidateName =
      resume?.structured_data?.structuredResume?.personal?.name ||
      'Candidate';

    const safeTitle = (record.job_title || 'Application')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');

    const filename = sanitizeDownloadFilename(
      `${candidateName.replace(/\s+/g, '_')}_Cover_Letter_${safeTitle}.${format}`,
      `Cover_Letter.${format}`,
    );

    if (format === 'docx') {
      const buffer = await this.exportService.generateDocx(record.content, {
        candidateName,
        jobTitle: record.job_title || undefined,
        companyName: record.company_name || undefined,
      });
      return {
        buffer,
        filename,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
    }

    const buffer = await this.exportService.generatePdf(record.content, {
      candidateName,
      jobTitle: record.job_title || undefined,
      companyName: record.company_name || undefined,
    });

    return {
      buffer,
      filename,
      mimeType: 'application/pdf',
    };
  }
}

export const coverLetterService = new CoverLetterService();
