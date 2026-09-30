import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { FormMessage } from '@/components/ui/form-message';
import {
  analyzeResumeForJob,
  deleteResume,
  getLatestJobAnalysis,
  getResume,
  listJobAnalyses,
  listResumes,
  processResume,
  uploadResume,
  downloadResumeReportPdf,
} from '@/features/resume/api/resume.api';
import { generateCoverLetter } from '@/features/cover-letter/api/cover-letter.api';
import { ResumeUpload } from '@/features/resume/components/ResumeUpload';
import { AnalysisPreviewPanel } from '@/features/resume/components/AnalysisPreviewPanel';
import type {
  JobMatchAnalysis,
  ResumeDetail,
  ResumeListItem,
} from '@/features/resume/types/resume';
import { ApiClientError } from '@/lib/api/client';
import { CheckCircle2 } from 'lucide-react';
import { StitchNavbar } from '@/features/resume/components/StitchNavbar';
import { ScanHistoryDrawer } from '@/features/resume/components/ScanHistoryDrawer';

export function ResumePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryResumeId = searchParams.get('resumeId');

  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [selectedResume, setSelectedResume] = useState<ResumeDetail | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [jobMatchAnalysis, setJobMatchAnalysis] = useState<JobMatchAnalysis | null>(null);
  const [jobAnalysisId, setJobAnalysisId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState<boolean>(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);

  const [lastJdText, setLastJdText] = useState<string>('');
  const [lastJobTitle, setLastJobTitle] = useState<string>('');

  const loadResumes = useCallback(
    async (autoSelect = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await listResumes();
        const enrichedResumes = await Promise.all(
          (data.resumes || []).map(async (res) => {
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
        setResumes(enrichedResumes);

        if (enrichedResumes.length > 0) {
          if (queryResumeId && enrichedResumes.some((r) => r.id === queryResumeId)) {
            void handleSelect(queryResumeId);
          } else if (autoSelect || !selectedResumeId) {
            void handleSelect(enrichedResumes[0].id);
          }
        }
      } catch (loadError) {
        setError(
          loadError instanceof ApiClientError
            ? loadError.message
            : 'Unable to load resumes. Please verify you are logged in and try again.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedResumeId, queryResumeId],
  );

  useEffect(() => {
    void loadResumes(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(resumeId: string) {
    setSelectedResumeId(resumeId);
    setError(null);
    setJobMatchAnalysis(null);
    setJobAnalysisId(null);

    try {
      const data = await getResume(resumeId);
      let matchScore = data.resume.score;

      try {
        const latestData = await getLatestJobAnalysis(resumeId);
        if (latestData?.analysis?.data) {
          setJobMatchAnalysis(latestData.analysis.data);
          setJobAnalysisId(latestData.analysis.analysisId);
          matchScore = latestData.analysis.data.matchScore;
          setResumes((current) =>
            current.map((r) => (r.id === resumeId ? { ...r, score: matchScore } : r)),
          );
        }
      } catch {
        setJobMatchAnalysis(null);
      }

      setSelectedResume({ ...data.resume, score: matchScore });
      setShowReport(true);
    } catch (selectError) {
      setSelectedResume(null);
      setShowReport(false);
      setJobMatchAnalysis(null);
      setError(
        selectError instanceof ApiClientError
          ? selectError.message
          : 'Unable to load resume details.',
      );
    }
  }

  async function handleUploadAndAnalyze(file: File, jobDescription: string, jobTitle?: string) {
    setIsUploading(true);
    setIsProcessing(false);
    setError(null);
    setSuccessMessage(null);
    setShowReport(false);
    setJobMatchAnalysis(null);
    setJobAnalysisId(null);
    setLastJdText(jobDescription);
    setLastJobTitle(jobTitle || '');

    try {
      const data = await uploadResume(file);
      setSelectedResumeId(data.resume.id);
      setSelectedResume(data.resume);

      setIsProcessing(true);
      const processed = await processResume(data.resume.id);
      setSelectedResume(processed.resume);

      const jobMatchRes = await analyzeResumeForJob(processed.resume.id, jobDescription, jobTitle);
      const matchedScore = jobMatchRes.data.matchScore;
      setJobMatchAnalysis(jobMatchRes.data);
      setJobAnalysisId(jobMatchRes.analysisId);

      const updatedResume = { ...processed.resume, score: matchedScore };
      setSelectedResume(updatedResume);

      setResumes((current) => [
        { ...data.resume, processingStatus: 'PROCESSED', score: matchedScore },
        ...current.filter((r) => r.id !== data.resume.id),
      ]);

      setShowReport(true);
      setSuccessMessage('Resume & Job Description successfully analyzed!');
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiClientError
          ? uploadError.message
          : 'Unable to analyze resume against job description. Please try again.',
      );
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  }

  async function handleAnalyzeSavedResume(
    resumeId: string,
    jobDescription: string,
    jobTitle?: string,
  ) {
    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);
    setShowReport(false);
    setJobMatchAnalysis(null);
    setJobAnalysisId(null);
    setLastJdText(jobDescription);
    setLastJobTitle(jobTitle || '');

    try {
      const jobMatchRes = await analyzeResumeForJob(resumeId, jobDescription, jobTitle);
      const matchedScore = jobMatchRes.data.matchScore;

      setJobMatchAnalysis(jobMatchRes.data);
      setJobAnalysisId(jobMatchRes.analysisId);
      setSelectedResumeId(resumeId);

      const detailRes = await getResume(resumeId);
      setSelectedResume({ ...detailRes.resume, score: matchedScore });
      setResumes((current) =>
        current.map((r) => (r.id === resumeId ? { ...r, score: matchedScore } : r)),
      );

      setShowReport(true);
      setSuccessMessage('Job description match analysis completed!');
    } catch (analysisError) {
      setError(
        analysisError instanceof ApiClientError
          ? analysisError.message
          : 'Unable to analyze resume against job description. Please try again.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleDelete(resumeId: string) {
    if (!confirm('Are you sure you want to delete this resume?')) return;
    setDeletingResumeId(resumeId);
    setError(null);

    try {
      await deleteResume(resumeId);
      const nextResumes = resumes.filter((r) => r.id !== resumeId);
      setResumes(nextResumes);

      if (selectedResumeId === resumeId) {
        if (nextResumes.length > 0) {
          void handleSelect(nextResumes[0].id);
        } else {
          setSelectedResumeId(null);
          setSelectedResume(null);
          setShowReport(false);
        }
      }
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

  // Suppress unused warning â€” deletingResumeId drives loading UI inside ResumeList
  void deletingResumeId;

  async function handleDownloadReportPdf() {
    if (!selectedResume) return;
    try {
      await downloadResumeReportPdf(selectedResume.id);
    } catch {
      setError('Failed to download report PDF. Please try again.');
    }
  }

  async function handleGenerateCoverLetter() {
    if (!selectedResume) return;
    setIsGeneratingCoverLetter(true);
    setError(null);
    try {
      const res = await generateCoverLetter({
        resumeId: selectedResume.id,
        jobAnalysisId: jobAnalysisId ?? undefined,
        jobTitle: lastJobTitle || undefined,
        jobDescription: lastJdText || 'Target Role Analysis',
        tone: 'professional',
      });
      navigate(`/cover-letters?id=${res.coverLetter.id}`);
    } catch {
      setError('Failed to generate cover letter. Please try again.');
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }

  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  function handleNewScan() {
    setShowReport(false);
    setJobMatchAnalysis(null);
    setSelectedResume(null);
    setSelectedResumeId(null);
    setSuccessMessage(null);
    setError(null);
  }

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
        selectedResumeId={selectedResumeId}
        onSelectResume={(id) => void handleSelect(id)}
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
            {error && <FormMessage message={error} />}
            {successMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
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
              onSelectSavedResume={(id) => void handleSelect(id)}
              onDelete={(id) => void handleDelete(id)}
              compact
            />
          </section>

          {/* RIGHT: Analysis Preview Panel Column */}
          <section className="lg:col-span-7 flex flex-col">
            <AnalysisPreviewPanel
              analysis={showReport ? jobMatchAnalysis : null}
              resume={showReport ? selectedResume : null}
              analysisId={jobAnalysisId}
              isGeneratingCoverLetter={isGeneratingCoverLetter}
              onDownloadReportPdf={handleDownloadReportPdf}
              onGenerateCoverLetter={handleGenerateCoverLetter}
              onNewScan={handleNewScan}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
