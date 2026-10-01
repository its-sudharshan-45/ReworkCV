import React, { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { History as HistoryIcon, FileText, ArrowRight, Zap, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listResumes, listJobAnalyses } from '@/features/resume/api/resume.api';
import type { ResumeListItem, JobAnalysisListItem } from '@/features/resume/types/resume';

interface SavedAnalysisCard {
  analysisId: string;
  resumeId: string;
  resumeName: string;
  jobTitle: string | null;
  matchScore: number;
  category: string;
  createdAt: string;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';
  if (score >= 60) return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300';
  return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300';
}

export function HistoryPage() {
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysisCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedAnalyses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { resumes } = await listResumes();

      const analysisGroups = await Promise.all(
        resumes.map(async (resume: ResumeListItem) => {
          try {
            const { analyses } = await listJobAnalyses(resume.id);
            return analyses.map((a: JobAnalysisListItem) => ({
              analysisId: a.id,
              resumeId: resume.id,
              resumeName: resume.originalFilename,
              jobTitle: a.jobTitle,
              matchScore: a.matchScore,
              category: a.category,
              createdAt: a.createdAt,
            }));
          } catch {
            return [];
          }
        }),
      );

      const all = analysisGroups
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setSavedAnalyses(all);
    } catch {
      setError('Unable to load analysis history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSavedAnalyses();
  }, [fetchSavedAnalyses]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#16A36A]">
            Audit History
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
            Analysis History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review past resume evaluations, ATS scores, and target job matches.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-24" />
                  <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-full w-20" />
                </div>
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{error}</p>
            <button
              onClick={() => void fetchSavedAnalyses()}
              type="button"
              className="mt-3 text-xs font-bold text-[#16A36A] hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : savedAnalyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8">
            <HistoryIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">No analyses recorded yet</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              Upload your resume and paste a job description on the Resume Analysis page to get started.
            </p>
            <Link
              to="/analysis"
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#16A36A] hover:bg-[#138A5A] text-white font-bold text-xs shadow-sm transition-colors"
            >
              <Zap className="w-4 h-4" />
              <span>Go to Resume Analysis</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedAnalyses.map((item) => (
              <div
                key={item.analysisId}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 hover:border-[#16A36A]/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[60%]">
                    {item.category}
                  </span>
                  <span
                    className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${getScoreColor(item.matchScore)}`}
                  >
                    {item.matchScore}% Match
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {item.jobTitle ?? 'Job Description Analysis'}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{item.resumeName}</span>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Analyzed {formatRelativeDate(item.createdAt)}
                  </span>
                  <Link
                    to={`/resume/report/${encodeURIComponent(item.resumeId)}/${encodeURIComponent(item.analysisId)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A36A] hover:bg-[#138A5A] text-white font-bold text-xs transition-colors"
                  >
                    <span>View Report</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
