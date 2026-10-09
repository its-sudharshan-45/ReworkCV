import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Loader2, Printer } from 'lucide-react';
import {
  deleteResume,
  downloadResumeReportPdf,
  getJobAnalysis,
  getLatestJobAnalysis,
  getResume,
} from '@/features/resume/api/resume.api';
import { listScanHistory } from '@/features/resume/api/scan-history';
import { generateCoverLetter, downloadCoverLetterFile, rewriteCoverLetter, updateCoverLetter } from '@/features/cover-letter/api/cover-letter.api';
import { ResumeAnalysisReport, type ReportView } from '@/features/resume/components/ResumeAnalysisReport';
import type { AiCoachChatMessage } from '@/features/ai-coach/api/ai-coach.api';
import { StitchNavbar } from '@/features/resume/components/StitchNavbar';
import { ScanHistoryDrawer } from '@/features/resume/components/ScanHistoryDrawer';
import { confirmResumeDelete } from '@/features/resume/utils/confirm-delete';
import type {
  JobMatchAnalysis,
  ResumeDetail,
  ResumeListItem,
} from '@/features/resume/types/resume';
import { ApiClientError } from '@/lib/api/client';

/**
 * Dedicated report route: /resume/report/:resumeId/:analysisId
 * Fixed viewport shell — only the report content area scrolls.
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
  const [isDownloadingCoverLetter, setIsDownloadingCoverLetter] = useState(false);
  const [isRewritingCoverLetter, setIsRewritingCoverLetter] = useState(false);
  const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);
  const [isSavingEditedCoverLetter, setIsSavingEditedCoverLetter] = useState(false);
  const [coverLetterId, setCoverLetterId] = useState<string | null>(null);
  const [coverLetterContent, setCoverLetterContent] = useState<string | null>(null);
  const [editedCoverLetterContent, setEditedCoverLetterContent] = useState('');
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [reportView, setReportView] = useState<ReportView>('report');
  const [coachMessages, setCoachMessages] = useState<AiCoachChatMessage[]>([]);
  const [coachConversationId, setCoachConversationId] = useState<string | null>(null);

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
      // New resume/analysis context — reset coach conversation for the old one.
      setCoachMessages([]);
      setCoachConversationId(null);
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
        // Scan History drawer: analyzed resumes with their match scores.
        const items = await listScanHistory();
        if (!cancelled) setResumes(items);
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
    if (!resumeId || isDownloadingReport) return;
    setPdfError(null);
    setIsDownloadingReport(true);
    try {
      await downloadResumeReportPdf(resumeId, undefined, resolvedAnalysisId);
    } catch (downloadError) {
      setPdfError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Failed to download report PDF. Please try again.',
      );
    } finally {
      setIsDownloadingReport(false);
    }
  }

  async function handleGenerateCoverLetter() {
    if (!resumeId || !jobDescription || isGeneratingCoverLetter) return;
    setCoverLetterError(null);
    setIsGeneratingCoverLetter(true);
    try {
      const res = await generateCoverLetter({
        resumeId,
        jobAnalysisId: resolvedAnalysisId ?? undefined,
        jobTitle: jobTitle || undefined,
        jobDescription,
        tone: 'professional',
      });
      setCoverLetterId(res.coverLetter.id);
      setCoverLetterContent(res.coverLetter.content);
      setEditedCoverLetterContent(res.coverLetter.content);
      setIsEditingCoverLetter(false);
    } catch (coverError) {
      setCoverLetterError(
        coverError instanceof Error
          ? coverError.message
          : 'Failed to generate cover letter. Please try again.',
      );
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }

  async function handleRewriteCoverLetter(feedback: string): Promise<boolean> {
    if (!coverLetterId) {
      setCoverLetterError('Generate the cover letter first, then request changes.');
      return false;
    }
    if (isRewritingCoverLetter) return false;
    if (feedback.trim().length < 3) {
      setCoverLetterError('Please describe the changes you would like (at least 3 characters).');
      return false;
    }
    setCoverLetterError(null);
    setIsRewritingCoverLetter(true);
    try {
      const res = await rewriteCoverLetter(coverLetterId, feedback);
      setCoverLetterContent(res.coverLetter.content);
      setEditedCoverLetterContent(res.coverLetter.content);
      setIsEditingCoverLetter(false);
      return true;
    } catch (rewriteError) {
      setCoverLetterError(
        rewriteError instanceof Error
          ? rewriteError.message
          : 'Failed to rewrite cover letter. Please try again.',
      );
      return false;
    } finally {
      setIsRewritingCoverLetter(false);
    }
  }

  function handleToggleEditCoverLetter() {
    setEditedCoverLetterContent(coverLetterContent ?? '');
    setIsEditingCoverLetter((v) => !v);
  }

  async function handleSaveEditedCoverLetter() {
    if (!coverLetterId || isSavingEditedCoverLetter) return;
    const next = editedCoverLetterContent.trim();
    if (next.length < 10) {
      setCoverLetterError('Your edited letter looks too short — please review it before saving.');
      return;
    }
    setCoverLetterError(null);
    setIsSavingEditedCoverLetter(true);
    try {
      const res = await updateCoverLetter(coverLetterId, editedCoverLetterContent);
      setCoverLetterContent(res.coverLetter.content);
      setIsEditingCoverLetter(false);
    } catch (saveError) {
      setCoverLetterError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save your edits. Please try again.',
      );
    } finally {
      setIsSavingEditedCoverLetter(false);
    }
  }

  async function handleDownloadCoverLetterPdf() {
    if (!coverLetterId || isDownloadingCoverLetter) return;
    setCoverLetterError(null);
    setIsDownloadingCoverLetter(true);
    try {
      await downloadCoverLetterFile(coverLetterId, 'pdf');
    } catch (downloadError) {
      setCoverLetterError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Failed to download cover letter PDF. Please try again.',
      );
    } finally {
      setIsDownloadingCoverLetter(false);
    }
  }

  async function handleDelete(resumeIdToDelete: string) {
    if (!confirmResumeDelete()) return;
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

  function handlePrintFallback() {
    window.print();
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F8F8FC] font-sans">
      {/* Fixed Global Header */}
      <div className="shrink-0">
        <StitchNavbar
          onOpenHistory={() => setIsHistoryDrawerOpen(true)}
          onNewScan={handleNewScan}
        />
      </div>

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

      {/* Body: fixed sidebar + single scrolling content area */}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading report"
            className="flex min-h-[380px] w-full flex-col items-center justify-center gap-3 bg-white"
          >
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#7C3AED' }} />
            <p className="text-sm font-semibold text-slate-500">Loading your report…</p>
          </div>
        ) : error ? (
          <div className="flex min-h-[380px] w-full flex-col items-center justify-center gap-3 overflow-y-auto bg-white px-8 py-10 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <p className="text-base font-bold text-slate-800">Report unavailable</p>
            <p className="max-w-sm text-sm text-slate-500">{error}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void loadReport()}
                className="cursor-pointer rounded-lg bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white hover:bg-[#6D28D9]"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => navigate('/analysis')}
                className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Back to upload
              </button>
            </div>
          </div>
        ) : (
          <>
            {pdfError && (
              <div className="sr-only" role="alert">
                {pdfError}
              </div>
            )}
            <div className="flex min-h-0 w-full flex-1 overflow-hidden">
              <ResumeAnalysisReport
                analysis={analysis}
                resume={resume}
                jobTitle={jobTitle}
                analysisId={resolvedAnalysisId}
                view={reportView}
                onViewChange={setReportView}
                isGeneratingCoverLetter={isGeneratingCoverLetter}
                isDownloadingCoverLetter={isDownloadingCoverLetter}
                coverLetterId={coverLetterId}
                coverLetterContent={coverLetterContent}
                coverLetterError={coverLetterError}
                onDownloadCoverLetterPdf={coverLetterId ? handleDownloadCoverLetterPdf : undefined}
                isRewritingCoverLetter={isRewritingCoverLetter}
                onRewriteCoverLetter={coverLetterId ? handleRewriteCoverLetter : undefined}
                isEditingCoverLetter={isEditingCoverLetter}
                editedCoverLetterContent={editedCoverLetterContent}
                onEditedCoverLetterChange={setEditedCoverLetterContent}
                onToggleEditCoverLetter={handleToggleEditCoverLetter}
                onSaveEditedCoverLetter={handleSaveEditedCoverLetter}
                isSavingEditedCoverLetter={isSavingEditedCoverLetter}
                coachResumeId={resumeId ?? null}
                coachAnalysisId={resolvedAnalysisId}
                coachMessages={coachMessages}
                coachConversationId={coachConversationId}
                onCoachMessagesChange={setCoachMessages}
                onCoachConversationChange={setCoachConversationId}
                onDownloadReportPdf={resume ? handleDownloadReportPdf : undefined}
                isDownloadingReport={isDownloadingReport}
                onGenerateCoverLetter={jobDescription ? handleGenerateCoverLetter : undefined}
              />
            </div>
            {pdfError && (
              <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 shadow-lg">
                <p className="text-xs font-semibold text-rose-800">{pdfError}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownloadReportPdf()}
                    disabled={isDownloadingReport}
                    className="cursor-pointer rounded-lg bg-[#7C3AED] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6D28D9] disabled:opacity-60"
                  >
                    {isDownloadingReport ? 'Retrying…' : 'Try again'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintFallback}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
