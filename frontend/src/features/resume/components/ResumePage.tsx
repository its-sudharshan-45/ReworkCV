import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FormMessage } from '@/components/ui/form-message';
import {
  analyzeResumeForJob,
  deleteResume,
  listJobAnalyses,
  listResumes,
  processResume,
  uploadResume,
} from '@/features/resume/api/resume.api';
import { ResumeUpload } from '@/features/resume/components/ResumeUpload';
import { AnalysisLoadingState } from '@/features/resume/components/AnalysisLoadingState';
import { DummyReportPreview } from '@/features/resume/components/DummyReportPreview';
import type { ResumeListItem } from '@/features/resume/types/resume';
import { ApiClientError } from '@/lib/api/client';
import { StitchNavbar } from '@/features/resume/components/StitchNavbar';
import { ScanHistoryDrawer } from '@/features/resume/components/ScanHistoryDrawer';
import { confirmResumeDelete } from '@/features/resume/utils/confirm-delete';

export function ResumePage() {
  const navigate = useNavigate();

  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lastJobTitle, setLastJobTitle] = useState<string>('');
  const [analysisPhase, setAnalysisPhase] = useState<'uploading' | 'processing' | 'analyzing' | null>(null);
  const analysisInFlight = useRef(false);
  const mountedRef = useRef(true);
  // Render-safe mirror of `lastRequest` (refs must not be read during render).
  const [hasLastRequest, setHasLastRequest] = useState(false);
  const lastRequest = useRef<
    | { kind: 'upload'; file: File; jobDescription: string; jobTitle?: string }
    | { kind: 'saved'; resumeId: string; jobDescription: string; jobTitle?: string }
    | null
  >(null);

  const loadResumes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listResumes();
      const items = data.resumes || [];
      // N+1 safeguard: resolve per-resume scores without failing the whole
      // list when a single analysis lookup fails.
      const settled = await Promise.allSettled(
        items.map(async (res) => {
          try {
            const analysesData = await listJobAnalyses(res.id);
            if (analysesData.analyses && analysesData.analyses.length > 0) {
              return { ...res, score: analysesData.analyses[0].matchScore };
            }
          } catch {
            // keep existing score
          }
          return res;
        }),
      );
      if (!mountedRef.current) return;
      setResumes(
        settled.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter((r) => r !== null),
      );
    } catch (loadError) {
      if (!mountedRef.current) return;
      setError(
        loadError instanceof ApiClientError
          ? loadError.message
          : 'Unable to load resumes. Please verify you are logged in and try again.',
      );
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadResumes();
    return () => {
      mountedRef.current = false;
    };
  }, [loadResumes]);

  function handleSelect(resumeId: string) {
    navigate(`/resume/report/${resumeId}/latest`);
  }

  /** Dev-only structured diagnostic log (never rendered; no PII beyond ids). */
  function logAnalyzeDiagnostic(
    stage: 'upload-analyze' | 'saved-analyze',
    err: unknown,
    context: { resumeId?: string; jobDescriptionLength: number; jobTitle?: string },
  ) {
    if (import.meta.env.DEV) {
      console.error('[resume-analysis]', {
        stage,
        ...context,
        status: err instanceof ApiClientError ? err.status : undefined,
        code: err instanceof ApiClientError ? err.code : undefined,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleUploadAndAnalyze(file: File, jobDescription: string, jobTitle?: string) {
    // Prevent duplicate Analyze requests while analysis is running.
    if (analysisInFlight.current) return;
    analysisInFlight.current = true;
    lastRequest.current = { kind: 'upload', file, jobDescription, jobTitle };
    setHasLastRequest(true);
    setIsUploading(true);
    setIsProcessing(false);
    setAnalysisPhase('uploading');
    setError(null);
    setLastJobTitle(jobTitle || '');

    try {
      const data = await uploadResume(file);

      setIsUploading(false);
      setIsProcessing(true);
      setAnalysisPhase('processing');
      const processed = await processResume(data.resume.id);

      setAnalysisPhase('analyzing');
      const jobMatchRes = await analyzeResumeForJob(processed.resume.id, jobDescription, jobTitle);
      if (!jobMatchRes?.data || typeof jobMatchRes.data.matchScore !== 'number') {
        throw new ApiClientError(500, {
          error: { code: 'UNEXPECTED_RESPONSE', message: 'Analysis completed but returned an invalid report payload.' },
        });
      }
      const matchedScore = jobMatchRes.data.matchScore;

      setResumes((current) => [
        { ...data.resume, processingStatus: 'PROCESSED', score: matchedScore },
        ...current.filter((r) => r.id !== data.resume.id),
      ]);

      // Analysis complete — navigate to the dedicated report page.
      navigate(`/resume/report/${processed.resume.id}/${jobMatchRes.analysisId}`);
    } catch (uploadError) {
      logAnalyzeDiagnostic('upload-analyze', uploadError, {
        jobDescriptionLength: jobDescription.length,
        jobTitle,
      });
      setError(
        uploadError instanceof ApiClientError
          ? uploadError.message
          : 'Unable to analyze resume against job description. Please try again.',
      );
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      setAnalysisPhase(null);
      analysisInFlight.current = false;
    }
  }

  async function handleAnalyzeSavedResume(
    resumeId: string,
    jobDescription: string,
    jobTitle?: string,
  ) {
    if (analysisInFlight.current) return;
    analysisInFlight.current = true;
    lastRequest.current = { kind: 'saved', resumeId, jobDescription, jobTitle };
    setHasLastRequest(true);
    setIsProcessing(true);
    setAnalysisPhase('analyzing');
    setError(null);
    setLastJobTitle(jobTitle || '');

    try {
      const jobMatchRes = await analyzeResumeForJob(resumeId, jobDescription, jobTitle);
      if (!jobMatchRes?.data || typeof jobMatchRes.data.matchScore !== 'number') {
        throw new ApiClientError(500, {
          error: { code: 'UNEXPECTED_RESPONSE', message: 'Analysis completed but returned an invalid report payload.' },
        });
      }
      const matchedScore = jobMatchRes.data.matchScore;

      setResumes((current) =>
        current.map((r) => (r.id === resumeId ? { ...r, score: matchedScore } : r)),
      );

      // Analysis complete — navigate to the dedicated report page.
      navigate(`/resume/report/${resumeId}/${jobMatchRes.analysisId}`);
    } catch (analysisError) {
      logAnalyzeDiagnostic('saved-analyze', analysisError, {
        resumeId,
        jobDescriptionLength: jobDescription.length,
        jobTitle,
      });
      setError(
        analysisError instanceof ApiClientError
          ? analysisError.message
          : 'Unable to analyze resume against job description. Please try again.',
      );
    } finally {
      setIsProcessing(false);
      setAnalysisPhase(null);
      analysisInFlight.current = false;
    }
  }

  async function handleRetryAnalysis() {
    const req = lastRequest.current;
    if (!req || analysisInFlight.current) return;
    if (req.kind === 'upload') {
      await handleUploadAndAnalyze(req.file, req.jobDescription, req.jobTitle);
    } else {
      await handleAnalyzeSavedResume(req.resumeId, req.jobDescription, req.jobTitle);
    }
  }

  async function handleDelete(resumeId: string) {
    if (!confirmResumeDelete()) return;
    setDeletingResumeId(resumeId);
    setError(null);

    try {
      await deleteResume(resumeId);
      setResumes((current) => current.filter((r) => r.id !== resumeId));
    } catch (deleteError) {
      setError(
        deleteError instanceof ApiClientError
          ? deleteError.message
          : 'Unable to delete resume. Please try again.',
      );
    } finally {
      setDeletingResumeId(null);
    }
  }

  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const isBusy = isUploading || isProcessing;

  return (
    <div
      className="min-h-screen w-full relative flex flex-col font-sans"
      style={{
        background:
          'radial-gradient(circle at 85% 10%, rgba(124, 58, 237, 0.05) 0%, rgba(250, 252, 250, 0) 60%), #FAFCFA',
      }}
    >
      {/* Stitch Top Bar */}
      <StitchNavbar onOpenHistory={() => setIsHistoryDrawerOpen(true)} />

      {/* Scan History Slide-over Drawer */}
      <ScanHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        resumes={resumes}
        selectedResumeId={null}
        onSelectResume={(id) => {
          setIsHistoryDrawerOpen(false);
          handleSelect(id);
        }}
        onDeleteResume={(id) => void handleDelete(id)}
        deletingId={deletingResumeId}
      />

      {/* Main Two-Column Canvas */}
      <main className="flex-1 w-full max-w-[1580px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 xl:gap-14 items-start">
          {/* LEFT: Upload Form Column */}
          <section className="lg:col-span-5 flex flex-col">
            {/* Headline */}
            <h1
              className="text-3xl sm:text-4xl xl:text-[42px] font-extrabold text-[#1E1235] tracking-tight leading-[1.15] mb-3"
              style={{ fontFamily: 'Outfit, Inter, sans-serif' }}
            >
              Stand Out Before<br />You Even Walk In
            </h1>
            <p className="text-[14.5px] text-slate-500 leading-relaxed mb-6 max-w-md">
              ReworkCV tailors your resume to every role, scores it against ATS filters, and writes
              a cover letter that matches — so you apply with confidence.
            </p>

            {/* Alerts */}
            {error && (
              <div className="mb-4 space-y-2">
                <FormMessage message={error} />
                {hasLastRequest && !isBusy && (
                  <button
                    type="button"
                    onClick={() => void handleRetryAnalysis()}
                    className="cursor-pointer rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
                  >
                    Retry analysis
                  </button>
                )}
              </div>
            )}
            {isLoading && !resumes.length && (
              <div className="mb-4 text-xs text-slate-400 animate-pulse">Loading your resumes…</div>
            )}

            {/* Upload form */}
            <ResumeUpload
              onUploadAndAnalyze={handleUploadAndAnalyze}
              onAnalyzeSavedResume={handleAnalyzeSavedResume}
              isUploading={isUploading}
              isProcessing={isProcessing}
              savedResumes={resumes}
              onSelectSavedResume={(id) => handleSelect(id)}
              onDelete={(id) => void handleDelete(id)}
              compact
            />
          </section>

          {/* RIGHT: Real loading state while analysis runs, static dummy
              preview otherwise. The dummy preview is display-only and is
              never connected to real analysis data — the actual report lives
              on the dedicated /resume/report/:resumeId/:analysisId route. */}
          <section className="lg:col-span-7 flex flex-col">
            {isBusy ? (
              <AnalysisLoadingState
                phase={isUploading ? 'uploading' : analysisPhase === 'processing' ? 'processing' : 'analyzing'}
                jobTitle={lastJobTitle}
              />
            ) : (
              <DummyReportPreview />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
