import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listScanHistory } from '@/features/resume/api/scan-history';
import type { ResumeListItem } from '@/features/resume/types/resume';

const listResumes = vi.fn();
const listJobAnalyses = vi.fn();

vi.mock('@/features/resume/api/resume.api', () => ({
  listResumes: (...args: unknown[]) => listResumes(...args),
  listJobAnalyses: (...args: unknown[]) => listJobAnalyses(...args),
}));

function makeResume(overrides: Partial<ResumeListItem> = {}): ResumeListItem {
  return {
    id: 'resume-1',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    processingStatus: 'PROCESSED',
    score: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('listScanHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the persisted resume score when present', async () => {
    listResumes.mockResolvedValue({ resumes: [makeResume({ id: 'r1', score: 82 })] });

    const history = await listScanHistory();

    expect(history).toHaveLength(1);
    expect(history[0].score).toBe(82);
    // No fallback lookup needed when the score is already stored.
    expect(listJobAnalyses).not.toHaveBeenCalled();
  });

  it('falls back to the latest analysis score for analyzed resumes missing a stored score', async () => {
    listResumes.mockResolvedValue({ resumes: [makeResume({ id: 'r1', score: null })] });
    listJobAnalyses.mockResolvedValue({
      analyses: [{ id: 'a1', resumeId: 'r1', jobTitle: 'Backend Engineer', matchScore: 77, category: 'Good Match', createdAt: '2026-01-02T00:00:00.000Z' }],
    });

    const history = await listScanHistory();

    expect(history).toHaveLength(1);
    expect(history[0].originalFilename).toBe('resume.pdf');
    expect(history[0].score).toBe(77);
  });

  it('keeps resumes with no analyses and survives a single failing lookup', async () => {
    listResumes.mockResolvedValue({
      resumes: [makeResume({ id: 'r1', score: null }), makeResume({ id: 'r2', originalFilename: 'other.pdf', score: null })],
    });
    listJobAnalyses
      .mockRejectedValueOnce(new Error('lookup down'))
      .mockResolvedValueOnce({ analyses: [] });

    const history = await listScanHistory();

    expect(history).toHaveLength(2);
    expect(history.map((r) => r.id)).toEqual(['r1', 'r2']);
  });
});
