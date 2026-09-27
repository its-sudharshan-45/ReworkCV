import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CoverLetterEditor } from '@/features/cover-letter/components/CoverLetterEditor';
import { listCoverLetters, deleteCoverLetter, getCoverLetter } from '@/features/cover-letter/api/cover-letter.api';
import type { CoverLetter } from '@/features/cover-letter/types/cover-letter';
import {
  FileText,
  Trash2,
  Sparkles,
  ArrowRight,
  Calendar,
  AlertCircle,
  Loader2,
  PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CoverLettersPage() {
  const [searchParams] = useSearchParams();
  const targetId = searchParams.get('id');

  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [selectedLetter, setSelectedLetter] = useState<CoverLetter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await listCoverLetters();
        setCoverLetters(res.coverLetters);

        if (targetId) {
          const matched = res.coverLetters.find((c) => c.id === targetId);
          if (matched) {
            setSelectedLetter(matched);
          } else {
            const single = await getCoverLetter(targetId).catch(() => null);
            if (single?.coverLetter) {
              setSelectedLetter(single.coverLetter);
            }
          }
        } else if (res.coverLetters.length > 0) {
          setSelectedLetter(res.coverLetters[0]);
        }
      } catch {
        setError('Failed to load your cover letters.');
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [targetId]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this cover letter?')) return;
    setDeletingId(id);
    try {
      await deleteCoverLetter(id);
      const remaining = coverLetters.filter((c) => c.id !== id);
      setCoverLetters(remaining);
      if (selectedLetter?.id === id) {
        setSelectedLetter(remaining.length > 0 ? remaining[0] : null);
      }
    } catch {
      alert('Failed to delete cover letter.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#16A36A]">
              Application Documents
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
              AI Cover Letters
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Personalized, job-tailored cover letters generated from your analyzed resumes.
            </p>
          </div>

          <Button asChild className="rounded-xl bg-[#16A36A] hover:bg-[#138A5A] text-white font-bold text-xs gap-1.5 shadow-sm">
            <Link to="/analysis">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate from Resume</span>
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#16A36A]" />
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
            {error}
          </div>
        ) : coverLetters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-xs">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">No cover letters generated yet</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Upload your resume, add a job description, and run an analysis to generate an instant tailored cover letter.
            </p>
            <Button asChild className="mt-5 rounded-xl bg-[#16A36A] hover:bg-[#138A5A] text-white font-bold text-xs gap-1.5">
              <Link to="/analysis">
                <PlusCircle className="w-4 h-4" />
                <span>Go to Resume Analysis</span>
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Sidebar list of cover letters */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                Your Cover Letters ({coverLetters.length})
              </h2>
              <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
                {coverLetters.map((cl) => {
                  const isSelected = selectedLetter?.id === cl.id;
                  const dateStr = new Date(cl.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={cl.id}
                      onClick={() => setSelectedLetter(cl)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#16A36A] bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {cl.jobTitle || 'Application Letter'}
                          </h3>
                          {cl.companyName && (
                            <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                              {cl.companyName}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => void handleDelete(cl.id, e)}
                          disabled={deletingId === cl.id}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                          title="Delete cover letter"
                        >
                          {deletingId === cl.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {dateStr}
                        </span>
                        <span className="capitalize font-semibold text-emerald-700 dark:text-emerald-400">
                          {cl.tone}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main editor area */}
            <div className="lg:col-span-8">
              {selectedLetter ? (
                <CoverLetterEditor
                  coverLetter={selectedLetter}
                  onUpdate={(updated) => {
                    setSelectedLetter(updated);
                    setCoverLetters((list) => list.map((c) => (c.id === updated.id ? updated : c)));
                  }}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
