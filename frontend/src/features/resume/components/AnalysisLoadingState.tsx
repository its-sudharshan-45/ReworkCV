import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export const ANALYSIS_STAGES = [
  { id: 'reading', label: 'Reading your resume', detail: 'Parsing uploaded file' },
  { id: 'extracting', label: 'Extracting experience and skills', detail: 'NER entity detection' },
  { id: 'content', label: 'Analyzing your resume content', detail: 'Content quality checks' },
  { id: 'comparing', label: 'Comparing with the job description', detail: 'Skill and keyword matching' },
  { id: 'ats', label: 'Checking ATS compatibility', detail: 'Deterministic scoring' },
  { id: 'preparing', label: 'Preparing your personalized report', detail: 'Assembling results' },
] as const;

interface AnalysisLoadingStateProps {
  /** Current pipeline phase hint from the parent (upload/process/analyze). */
  phase?: 'uploading' | 'processing' | 'analyzing';
  jobTitle?: string;
  onCancel?: () => void;
}

export function AnalysisLoadingState({ phase = 'analyzing', jobTitle, onCancel }: AnalysisLoadingStateProps) {
  const baseIndex = phase === 'uploading' ? 0 : phase === 'processing' ? 1 : 2;
  const [activeIndex, setActiveIndex] = useState(baseIndex);

  useEffect(() => {
    setActiveIndex((current) => Math.max(current, baseIndex));
  }, [baseIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((current) => {
        if (current >= ANALYSIS_STAGES.length - 1) return current;
        return current + 1;
      });
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  const progress = Math.round(((activeIndex + 1) / ANALYSIS_STAGES.length) * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Resume analysis in progress"
      className="w-full rounded-2xl border border-[#EDE4FF] bg-white p-6 shadow-sm sm:p-8"
      style={{ boxShadow: '0 20px 40px -15px rgba(124,58,237,0.12)' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3E8FF]">
          <Loader2 className="h-5 w-5 animate-spin text-[#7C3AED]" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-slate-900">Analyzing your resume…</h2>
          <p className="truncate text-xs text-slate-500">
            {jobTitle ? `Target role: ${jobTitle}` : 'Matching against the job description'}
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-[#EDE9FE] px-2.5 py-1 text-[11px] font-bold text-[#7C3AED]">
          {progress}%
        </span>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
        />
      </div>

      <ol className="mt-6 space-y-3">
        {ANALYSIS_STAGES.map((stage, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={stage.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                active
                  ? 'border-[#7C3AED]/30 bg-[#FAF5FF]'
                  : done
                    ? 'border-emerald-200/60 bg-emerald-50/40'
                    : 'border-slate-100 bg-slate-50/60'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={`text-xs font-bold sm:text-sm ${active ? 'text-[#7C3AED]' : done ? 'text-emerald-800' : 'text-slate-500'}`}>
                  {stage.label}
                  {active && <span className="animate-pulse">…</span>}
                </p>
                <p className="truncate text-[11px] text-slate-400">{stage.detail}</p>
              </div>
              {active && (
                <span className="ml-auto hidden shrink-0 text-[11px] font-semibold text-[#7C3AED] sm:inline">
                  In progress
                </span>
              )}
              {done && (
                <span className="ml-auto hidden shrink-0 text-[11px] font-semibold text-emerald-600 sm:inline">
                  Done
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-center text-[11px] text-slate-400">
        Please keep this tab open. The report appears automatically when analysis finishes.
      </p>
      {onCancel && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer text-[11px] font-semibold text-slate-400 hover:text-slate-600 hover:underline"
          >
            Cancel analysis
          </button>
        </div>
      )}
    </div>
  );
}
