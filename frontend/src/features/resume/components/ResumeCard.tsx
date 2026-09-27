import { FileText, Trash2, Eye, Sparkles, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResumeStatus } from '@/features/resume/components/ResumeStatus';
import type { ResumeListItem } from '@/features/resume/types/resume';
import { formatFileSize } from '@/features/resume/utils/status';

interface ResumeCardProps {
  resume: ResumeListItem;
  selected: boolean;
  onSelect: (resumeId: string) => void;
  onDelete: (resumeId: string) => void;
  isDeleting: boolean;
}

export function ResumeCard({ resume, selected, onSelect, onDelete, isDeleting }: ResumeCardProps) {
  const formattedDate = new Date(resume.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={`rounded-3xl border p-4 transition-all duration-200 sm:p-5 ${
        selected
          ? 'border-[#007A5A] bg-[#007A5A]/5 shadow-sm ring-2 ring-[#007A5A]/20 dark:bg-[#007A5A]/15'
          : 'shadow-2xs border-slate-200/90 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5 overflow-hidden">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#007A5A]/10 text-[#007A5A] dark:text-emerald-400">
            <FileText className="w-5.5 h-5.5" />
          </div>
          <div className="truncate">
            <h4 className="flex items-center gap-2 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
              <span>{resume.originalFilename}</span>
              {selected && (
                <span className="rounded-full bg-[#007A5A] px-2 py-0.5 text-[10px] font-extrabold text-white">
                  Active
                </span>
              )}
            </h4>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatFileSize(resume.fileSize)}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                {formattedDate}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-2 sm:gap-3">
            <ResumeStatus status={resume.processingStatus} />
            {typeof resume.score === 'number' && (
              <div className="shadow-2xs flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Sparkles className="h-3.5 w-3.5 text-[#007A5A]" />
                <span>Match Score: {resume.score}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={selected ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelect(resume.id)}
              className={
                selected
                  ? 'shadow-xs rounded-xl bg-[#007A5A] text-xs font-bold text-white hover:bg-[#006349]'
                  : 'rounded-xl border-slate-300 text-xs font-bold hover:border-[#007A5A] hover:text-[#007A5A] dark:border-slate-700'
              }
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              View Analysis
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(resume.id)}
              disabled={isDeleting}
              className="cursor-pointer rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
              title="Delete resume"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
