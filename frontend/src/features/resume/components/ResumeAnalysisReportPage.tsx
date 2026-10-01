import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  deleteResume,
  downloadResumeReportPdf,
  getJobAnalysis,
  getLatestJobAnalysis,
  getResume,
  listResumes,
} from '@/features/resume/api/resume.api';
import { generateCoverLetter } from '@/features/cover-letter/api/cover-letter.api';
import { ResumeAnalysisReport } from '@/features/resume/components/ResumeAnalysisReport';
import { StitchNavbar } from '@/features/resume/components/StitchNavbar';
import { ScanHistoryDrawer } from '@/features/resume/components/ScanHistoryDrawer';
import type {
  JobMatchAnalysis,
  ResumeDetail,
  ResumeListItem,
} from '@/features/resume/types/resume';
import { ApiClientError } from '@/lib/api/client';

/**
 * Dedicated report route: /resume/report/:resumeId/:analysisId
 * `analysisId` may be a persisted analysis UUID or `latest`.
 *
 * All data is loaded from the existing persistence/API layer, so refresh,
 * direct URL access, and back/forward navigation all work without
 * depending on in-memory React state.
 */
export function ResumeAnalysisReportPage() {
  const { resumeId, analysisId } = useParams<{ resumeId: string; analysisId: string }>();
  const navigate = useNavigate();

  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [analysis, setAnalysis] = useState<JobMatchAnalysis | null>(null);
  const [resolvedAnalysisId, setResolvedAnalysisId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  const loadAttempt = useRef(0);

  const loadReport = useCallback(async () => {
    if (!resumeId) {
      setError('Missing resume reference in the report URL.');
      setIsLoading(false);
      return;
    }
    const attempt = ++loadAttempt.current;
    setIsLoading(true);
    setError(null);

    try {
      const detailRes = await getResume(resumeId);
      if (loadAttempt.current !== attempt) return;

      let matchAnalysis: JobMatchAnalysis | null = null;
      let concreteAnalysisId: string | null = null;
      let title = '';
      let description = '';

      if (!analysisId || analysisId === 'latest') {
        const latestRes = await getLatestJobAnalysis(resumeId);
        if (loadAttempt.current !== attempt) return;
        if (latestRes.analysis) {
          // Resolve the full persisted record (includes job title/description).
          const full = await getJobAnalysis(resumeId, latestRes.analysis.analysisId);
          if (loadAttempt.current !== attempt) return;
          matchAnalysis = full.analysis.data;
          concreteAnalysisId = full.analysis.analysisId;
          title = full.analysis.jobTitle ?? '';
          description = full.analysis.jobDescription ?? '';
        }
      } else {
        const full = await getJobAnalysis(resumeId, analysisId);
        if (loadAttempt.current !== attempt) return;
        matchAnalysis = full.analysis.data;
        concreteAnalysisId = full.analysis.analysisId;
        title = full.analysis.jobTitle ?? '';
        description = full.analysis.jobDescription ?? '';
      }

      setResume(detailRes.resume);
      setAnalysis(matchAnalysis);
      setResolvedAnalysisId(concreteAnalysisId);
      setJobTitle(title);
      setJobDescription(description);
    } catch (loadError) {
      if (loadAttempt.current !== attempt) return;
      setResume(null);
      setAnalysis(null);
      setError(
        loadError instanceof ApiClientError
          ? loadError.message
          : 'Unable to load this report. It may have been deleted.',
      );
    } finally {
      if (loadAttempt.current === attempt) setIsLoading(false);
    }
  }, [resumeId, analysisId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    let cancelled = false;
    async function loadList() {
      try {
        const data = await listResumes();
        if (!cancelled) setResumes(data.resumes || []);
      } catch {
        // History drawer is auxiliary; report must render without it.
      }
    }
    void loadList();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDownloadReportPdf() {
    if (!resumeId) return;
    setPdfError(null);
    try {
      await downloadResumeReportPdf(resumeId);
    } catch {
      setPdfError('Failed to download report PDF. Please try again.');
    }
  }

  async function handleGenerateCoverLetter() {
    if (!resumeId || !jobDescription) return;
    setIsGeneratingCoverLetter(true);
    try {
      const res = await generateCoverLetter({
        resumeId,
        jobAnalysisId: resolvedAnalysisId ?? undefined,
        jobTitle: jobTitle || undefined,
        jobDescription,
        tone: 'professional',
      });
      navigate(`/cover-letters?id=${res.coverLetter.id}`);
    } catch {
      setPdfError('Failed to generate cover letter. Please try again.');
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }

  async function handleDelete(resumeIdToDelete: string) {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    setDeletingResumeId(resumeIdToDelete);
    try {
      await deleteResume(resumeIdToDelete);
      setResumes((current) => current.filter((r) => r.id !== resumeIdToDelete));
      if (resumeIdToDelete === resumeId) {
        navigate('/analysis', { replace: true });
      }
    } catch {
      setPdfError('Unable to delete resume. Please try again.');
    } finally {
      setDeletingResumeId(null);
    }
  }

  function handleNewScan() {
    navigate('/analysis');
  }

  return (
    <div
      className="min-h-screen w-full relative flex flex-col font-sans"
      style={{
        background:
          'radial-gradient(circle at 85% 10%, rgba(124, 58, 237, 0.05) 0%, rgba(250, 252, 250, 0) 60%), #FAFCFA',
      }}
    >
      <StitchNavbar onOpenHistory={() => setIsHistoryDrawerOpen(true)} />

      <ScanHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        resumes={resumes}
        selectedResumeId={resumeId ?? null}
        onSelectResume={(id) => {
          setIsHistoryDrawerOpen(false);
          navigate(`/resume/report/${id}/latest`);
        }}
        onDeleteResume={(id) => void handleDelete(id)}
        deletingId={deletingResumeId}
      />

      <main className="flex-1 w-full max-w-[1580px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading report"
            className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-2xl border border-[#EDE4FF] bg-white"
          >
            <Loader2 className="h-8 w-8 animate-spin text-[#7C3AED]" />
            <p className="text-sm font-semibold text-slate-500">Loading your report…</p>
          </div>
        ) : error ? (
          <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-white px-8 py-10 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <p className="text-base font-bold text-slate-800">Report unavailable</p>
            <p className="max-w-sm text-sm text-slate-500">{error}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void loadReport()}
                className="cursor-pointer rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white hover:bg-[#6D28D9]"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => navigate('/analysis')}
                className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Back to upload
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {pdfError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
                {pdfError}
              </div>
            )}
            {!analysis && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs font-semibold text-amber-800">
                No job analysis has been run for this resume yet. Run an analysis from the upload
                page to populate the full report.
              </div>
            )}
            <ResumeAnalysisReport
              analysis={analysis}
              resume={resume}
              jobTitle={jobTitle}
              analysisId={resolvedAnalysisId}
              isGeneratingCoverLetter={isGeneratingCoverLetter}
              onDownloadReportPdf={resume ? handleDownloadReportPdf : undefined}
              onGenerateCoverLetter={jobDescription ? handleGenerateCoverLetter : undefined}
              onNewScan={handleNewScan}
            />
          </div>
        )}
      </main>
    </div>
  );
}
