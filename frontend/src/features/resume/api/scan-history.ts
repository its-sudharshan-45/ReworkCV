import { listJobAnalyses, listResumes } from '@/features/resume/api/resume.api';
import type { ResumeListItem } from '@/features/resume/types/resume';

/**
 * Scan History loader — every resume the user analyzed, together with its
 * latest match score.
 *
 * The backend persists the latest match score on the resume row at analysis
 * time, but older rows (or rows whose sync was skipped) may still carry a
 * null score. For those we fall back to the latest job-analysis record so
 * the Scan History drawer always shows the resume and its score.
 * A single failing analysis lookup never fails the whole history.
 */
export async function listScanHistory(): Promise<ResumeListItem[]> {
  const data = await listResumes();
  const items = data.resumes || [];

  const settled = await Promise.allSettled(
    items.map(async (res) => {
      if (typeof res.score === 'number' && res.score > 0) return res;
      try {
        const analysesData = await listJobAnalyses(res.id);
        if (analysesData.analyses && analysesData.analyses.length > 0) {
          return { ...res, score: analysesData.analyses[0].matchScore };
        }
      } catch {
        // Keep the resume row as-is; history must survive partial failures.
      }
      return res;
    }),
  );

  return settled
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((r): r is ResumeListItem => r !== null);
}
