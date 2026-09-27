import { randomUUID } from 'node:crypto';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { analyzeResume } from './resume.analysis.service.js';
import { extractResumeText } from './resume.extraction.service.js';
import { mapResumeToDetail, mapResumeToListItem } from './resume.mapper.js';
import { parseResumeSections } from './resume.section-parser.js';
import { ResumeRepository, resumeRepository } from './resume.repository.js';
import { ResumeStorageService, resumeStorageService } from './resume.storage.service.js';
import type { ResumeDetailResponse, ResumeListItemResponse } from './resume.types.js';
import { extractRawEntities } from '../../ai/resume/resume-ner.js';
import { buildStructuredResume } from '../../ai/resume/resume-normalizer.js';
import { analyzeStructuredResume } from '../../ai/resume/resume-analyzer.js';
import {
  buildResumeStoragePath,
  validateResumeUpload,
} from './resume.validation.js';

export class ResumeService {
  constructor(
    private readonly repository: ResumeRepository = resumeRepository,
    private readonly storage: ResumeStorageService = resumeStorageService,
  ) {}

  async uploadResume(userId: string, file: Express.Multer.File | undefined): Promise<ResumeDetailResponse> {
    const validated = validateResumeUpload(file, env.RESUME_MAX_FILE_SIZE_BYTES);
    const resumeId = randomUUID();
    const storagePath = buildResumeStoragePath(userId, resumeId, validated.safeFilename);

    await this.storage.uploadObject(storagePath, validated.buffer, validated.mimeType);

    try {
      const record = await this.repository.create({
        id: resumeId,
        userId,
        originalFilename: validated.originalFilename,
        storagePath,
        mimeType: validated.mimeType,
        fileSize: validated.fileSize,
      });
      return mapResumeToDetail(record);
    } catch (error) {
      await this.storage.deleteObject(storagePath).catch((cleanupError) => {
        logger.error({ storagePath, cleanupError }, 'Failed to clean up resume storage after DB error');
      });
      throw error;
    }
  }

  async listResumes(userId: string): Promise<ResumeListItemResponse[]> {
    const records = await this.repository.listByUserId(userId);
    return records.map(mapResumeToListItem);
  }

  async getResume(userId: string, resumeId: string): Promise<ResumeDetailResponse> {
    const record = await this.repository.findByIdForUser(resumeId, userId);
    if (!record) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }
    return mapResumeToDetail(record);
  }

  async deleteResume(userId: string, resumeId: string): Promise<void> {
    const deleted = await this.repository.deleteByIdForUser(resumeId, userId);
    if (!deleted) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    await this.storage.deleteObject(deleted.storage_path).catch((error) => {
      logger.error(
        { resumeId, storagePath: deleted.storage_path, error },
        'Resume deleted from database but storage cleanup failed',
      );
      throw new AppError('Resume record deleted but file cleanup failed', 500, 'EXTERNAL_SERVICE_ERROR');
    });
  }

  async processResume(userId: string, resumeId: string): Promise<ResumeDetailResponse> {
    const record = await this.repository.findByIdForUser(resumeId, userId);
    if (!record) {
      throw new AppError('Resume not found', 404, 'NOT_FOUND');
    }

    if (record.processing_status === 'PROCESSING') {
      throw new AppError('Resume is already being processed', 409, 'CONFLICT');
    }

    await this.repository.updateProcessing(resumeId, userId, {
      processingStatus: 'PROCESSING',
      failureReason: null,
    });

    try {
      const startTime = Date.now();
      const fileBuffer = await this.storage.downloadObject(record.storage_path);
      const extractedText = await extractResumeText(fileBuffer, record.mime_type);

      if (!extractedText || extractedText.trim().length < 10) {
        throw new AppError('Could not extract meaningful text from resume', 400, 'VALIDATION_ERROR');
      }

      // Step 1: Run Hugging Face Resume NER token classification
      const rawEntities = await extractRawEntities(extractedText);

      // Step 2: Normalize entities & construct canonical StructuredResume JSON
      const canonicalResume = buildStructuredResume(extractedText, rawEntities);

      // Step 3: Run UpSkilr Resume Analysis Engine (ATS score, Skill gap, Recommendations)
      const detailedAnalysis = analyzeStructuredResume(canonicalResume);

      // Step 4: Construct backward-compatible structuredData & analysisResult
      const sectionData = parseResumeSections(extractedText);
      const structuredData: import('./resume.types.js').StructuredResumeData = {
        ...sectionData,
        skills: canonicalResume.skills.length > 0 ? canonicalResume.skills : sectionData.skills,
        structuredResume: canonicalResume,
      };

      const legacyAnalysis = analyzeResume(structuredData);
      const analysisResult: import('./resume.types.js').ResumeAnalysis = {
        ...legacyAnalysis,
        overallScore: detailedAnalysis.overallScore,
        atsScore: detailedAnalysis.atsScore,
        targetRole: detailedAnalysis.targetRole,
        detailedAnalysis,
      };

      const score = detailedAnalysis.atsScore;
      const durationMs = Date.now() - startTime;

      logger.info(
        { resumeId, userId, entityCount: rawEntities.length, durationMs, atsScore: score },
        'Resume NER extraction and analysis completed successfully',
      );

      const updated = await this.repository.updateProcessing(resumeId, userId, {
        processingStatus: 'PROCESSED',
        extractedText,
        structuredData,
        analysisResult,
        score,
        failureReason: null,
      });

      return mapResumeToDetail(updated);
    } catch (error) {
      const failureReason =
        error instanceof AppError ? error.message : 'Resume processing failed';

      logger.warn({ resumeId, userId, failureReason }, 'Resume processing failed');

      const updated = await this.repository.updateProcessing(resumeId, userId, {
        processingStatus: 'FAILED',
        failureReason,
      });

      if (error instanceof AppError && error.statusCode < 500) {
        return mapResumeToDetail(updated);
      }

      return mapResumeToDetail(updated);
    }
  }
}

export const resumeService = new ResumeService();

