import React from 'react';
import { X, Trash2, FileText } from 'lucide-react';
import type { ResumeListItem } from '@/features/resume/types/resume';

interface ScanHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  resumes: ResumeListItem[];
  selectedResumeId?: string | null;
  onSelectResume: (resumeId: string) => void;
  onDeleteResume?: (resumeId: string) => void;
  deletingId?: string | null;
}

export function ScanHistoryDrawer({
  isOpen,
  onClose,
  resumes,
  selectedResumeId,
  onSelectResume,
  onDeleteResume,
  deletingId,
}: ScanHistoryDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Scan History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {resumes.length} {resumes.length === 1 ? 'resume scan' : 'resume scans'} recorded
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {resumes.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No scans yet</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Upload your resume and paste a job description on the left to run your first AI match scan.
              </p>
            </div>
          ) : (
            resumes.map((res) => {
              const isSelected = selectedResumeId === res.id;
              const score = res.score ?? 0;
              const formattedDate = new Date(res.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={res.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-[#7C3AED] bg-[#F5F3FF] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-[#C084FC]/50 hover:bg-slate-50/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectResume(res.id);
                      onClose();
                    }}
                    className="flex-1 text-left flex items-start gap-3 min-w-0"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                      {score > 0 ? score : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {res.originalFilename}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">{formattedDate}</span>
                        {score > 0 && (
                          <span
                            className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: score >= 80 ? '#EDE9FE' : score >= 60 ? '#FEF3C7' : '#FEE2E2',
                              color: score >= 80 ? '#7C3AED' : score >= 60 ? '#92400E' : '#B91C1C',
                            }}
                          >
                            Score: {score}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1">
                    {onDeleteResume && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteResume(res.id);
                        }}
                        disabled={deletingId === res.id}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                        title="Delete resume"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
