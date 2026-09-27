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
import { ResumeList } from '@/features/resume/components/ResumeList';
import { ResumeUpload } from '@/features/resume/components/ResumeUpload';
import { CakeMeReport } from '@/features/resume/components/CakeMeReport';
import type {
  JobMatchAnalysis,
  ResumeDetail,
  ResumeListItem,
} from '@/features/resume/types/resume';
import { ApiClientError } from '@/lib/api/client';
import { FileText, Sparkles, CheckCircle2, History } from 'lucide-react';

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

  // Job Match analysis result state
  const [jobMatchAnalysis, setJobMatchAnalysis] = useState<JobMatchAnalysis | null>(null);
  const [jobAnalysisId, setJobAnalysisId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState<boolean>(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);

  // Keep target JD across operations for seamless cover letter generation
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
                return {
                  ...res,
                  score: analysesData.analyses[0].matchScore,
                };
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

      setSelectedResume({
        ...data.resume,
        score: matchScore,
      });

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

  // Unified Resume Upload + Job Description Analysis flow
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
      // 1. Upload resume
      const data = await uploadResume(file);
      setSelectedResumeId(data.resume.id);
      setSelectedResume(data.resume);

      // 2. Process through NER extraction
      setIsProcessing(true);
      const processed = await processResume(data.resume.id);
      setSelectedResume(processed.resume);

      // 3. Run Job-Specific ATS match analysis
      const jobMatchRes = await analyzeResumeForJob(processed.resume.id, jobDescription, jobTitle);

      const matchedScore = jobMatchRes.data.matchScore;
      setJobMatchAnalysis(jobMatchRes.data);
      setJobAnalysisId(jobMatchRes.analysisId);

      const updatedResume = {
        ...processed.resume,
        score: matchedScore,
      };
      setSelectedResume(updatedResume);

      setResumes((current) => [
        {
          ...data.resume,
          processingStatus: 'PROCESSED',
          score: matchedScore,
        },
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

  // Analyze an existing uploaded resume against a new job description
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
      setSelectedResume({
        ...detailRes.resume,
        score: matchedScore,
      });

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
      setDeletingIdNull();
    }
  }

  function setDeletingIdNull() {
    setDeletingResumeId(null);
  }

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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center rounded-full bg-[#16A36A]/10 px-2.5 text-[11px] font-bold text-[#16A36A] dark:bg-[#16A36A]/20">
              AI Resume Intelligence
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
            Resume Analysis &amp; Job Match
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload your resume and paste a target job description to get an instant ATS score, deep skill gap analysis, and tailored AI cover letter.
          </p>
        </div>
      </div>

      {/* Global Alerts */}
      {error && <FormMessage message={error} />}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/80 p-4 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Unified Resume Upload & Job Description Form */}
      <div className="space-y-4">
        <ResumeUpload
          onUploadAndAnalyze={handleUploadAndAnalyze}
          onAnalyzeSavedResume={handleAnalyzeSavedResume}
          isUploading={isUploading}
          isProcessing={isProcessing}
          savedResumes={resumes}
          onSelectSavedResume={(id) => void handleSelect(id)}
        />
      </div>

      {/* Previously Analyzed Resumes */}
      {resumes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <History className="h-3.5 w-3.5" />
              Analyzed Resumes ({resumes.length})
            </h2>
          </div>
          <ResumeList
            resumes={resumes}
            selectedResumeId={selectedResumeId}
            onSelect={(id: string) => void handleSelect(id)}
            onDelete={(id: string) => void handleDelete(id)}
            deletingResumeId={deletingResumeId}
          />
        </div>
      )}

      {/* Professional Resume Analysis Report */}
      {selectedResume && showReport ? (
        <div
          id="analysis-report-section"
          className="animate-in fade-in space-y-6 border-t border-slate-200 pt-6 duration-300 dark:border-slate-800"
        >
          <div className="no-print flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
                <FileText className="h-5 w-5 text-[#16A36A]" />
                Analysis Report: {selectedResume.originalFilename}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Full ATS readiness audit, requirement coverage, and gap breakdown.
              </p>
            </div>
          </div>

          {selectedResume.failureReason ? (
            <FormMessage message={selectedResume.failureReason} />
          ) : null}

          <CakeMeReport
            analysis={jobMatchAnalysis ?? undefined}
            resume={selectedResume}
            analysisId={jobAnalysisId ?? undefined}
            onDownloadReportPdf={handleDownloadReportPdf}
            onGenerateCoverLetter={handleGenerateCoverLetter}
            isGeneratingCoverLetter={isGeneratingCoverLetter}
          />
        </div>
      ) : null}
    </div>
  );
}
