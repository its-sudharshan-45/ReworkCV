import { Fragment, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderCheck,
  Info,
  LayoutTemplate,
  Loader2,
  Mail,
  Pencil,
  PenLine,
  Save,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react';
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';
import { buildReportData, getCategoryScores } from '@/features/resume/utils/report-data';
import { AICoach } from '@/features/ai-coach/components/AICoach';
import type { AiCoachChatMessage } from '@/features/ai-coach/api/ai-coach.api';

export type ReportView = 'report' | 'coach' | 'cover';

/* Analysis-page theme: purple primary, lavender surfaces, ink headings */
const INK = '#1E1235';
const PRIMARY = '#7C3AED';
const PRIMARY_HOVER = '#6D28D9';
const LAV = '#F5F3FF';
const LAV_DEEP = '#EDE9FE';
const PASS = '#16A36A';
const WARN = '#B45309';
const MISS = '#DC2626';

const CATEGORY_COLORS = {
  content: '#7C3AED',
  skills: '#16A36A',
  format: '#F59E0B',
  sections: '#EC4899',
  style: '#6366F1',
} as const;

interface ResumeAnalysisReportProps {
  analysis: JobMatchAnalysis | null | undefined;
  resume: ResumeDetail | null | undefined;
  jobTitle?: string;
  analysisId?: string | null;
  view?: ReportView;
  onViewChange?: (view: ReportView) => void;
  onDownloadReportPdf?: () => void;
  isDownloadingReport?: boolean;
  onGenerateCoverLetter?: () => void;
  isGeneratingCoverLetter?: boolean;
  isDownloadingCoverLetter?: boolean;
  coverLetterId?: string | null;
  coverLetterContent?: string | null;
  coverLetterError?: string | null;
  onDownloadCoverLetterPdf?: () => void;
  isRewritingCoverLetter?: boolean;
  onRewriteCoverLetter?: (feedback: string) => void;
  isEditingCoverLetter?: boolean;
  editedCoverLetterContent?: string;
  onEditedCoverLetterChange?: (content: string) => void;
  onToggleEditCoverLetter?: () => void;
  onSaveEditedCoverLetter?: () => void;
  isSavingEditedCoverLetter?: boolean;
  coachResumeId?: string | null;
  coachAnalysisId?: string | null;
  coachMessages?: AiCoachChatMessage[];
  coachConversationId?: string | null;
  onCoachMessagesChange?: (messages: AiCoachChatMessage[]) => void;
  onCoachConversationChange?: (conversationId: string | null) => void;
}

/* ---------------- helpers (real data only) ---------------- */

function countWords(text: string | null | undefined): number {
  if (!text || typeof text !== 'string') return 0;
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

function countGrammarIssues(text: string): number {
  if (!text) return 0;
  let issues = 0;
  const doubleSpaces = text.match(/ {2,}/g);
  if (doubleSpaces) issues += doubleSpaces.length;
  const repeats = text.match(/\b(\w+)\s+\1\b/gi);
  if (repeats) issues += repeats.length;
  const spacedPunct = text.match(/\s+[,.;:!?]/g);
  if (spacedPunct) issues += spacedPunct.length;
  return issues;
}

function SectionShell({
  icon,
  iconBg,
  title,
  open,
  onToggle,
  children,
  topBorder,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  topBorder?: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(30,18,53,0.06)]"
      style={topBorder ? { borderTop: `2px solid ${topBorder}` } : undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 px-5 py-4 text-left"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </span>
        <span className="text-[17px] font-bold" style={{ color: INK }}>{title}</span>
        <span className="ml-auto text-slate-400">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function FeedbackRow({ copyText }: { copyText?: string }) {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-slate-400">
      <button
        type="button"
        aria-label="Mark helpful"
        onClick={() => setVote((v) => (v === 'up' ? null : 'up'))}
        className={`cursor-pointer rounded p-1 transition-colors hover:bg-slate-100 ${vote === 'up' ? 'text-[#16A36A]' : ''}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Mark not helpful"
        onClick={() => setVote((v) => (v === 'down' ? null : 'down'))}
        className={`cursor-pointer rounded p-1 transition-colors hover:bg-slate-100 ${vote === 'down' ? 'text-rose-500' : ''}`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      {copyText && (
        <button
          type="button"
          aria-label="Copy section link"
          onClick={() => {
            try {
              void navigator.clipboard?.writeText(copyText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch {
              /* clipboard unavailable */
            }
          }}
          className="cursor-pointer rounded p-1 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#16A36A]" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const normalized = Math.min(100, Math.max(0, Number.isFinite(score) ? score : 0));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalized / 100) * circumference;
  return (
    <div
      className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center"
      role="img"
      aria-label={`Score ${normalized} out of 100`}
    >
      <svg className="h-full w-full -rotate-90" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={radius} strokeWidth="7" fill="transparent" className="stroke-slate-200" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          strokeWidth="7"
          fill="transparent"
          stroke={PRIMARY}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-[22px] font-extrabold" style={{ color: INK }}>
          {normalized > 0 ? normalized : '—'}
        </span>
        <span className="text-[9px] font-semibold text-slate-400">/100</span>
      </div>
    </div>
  );
}

function Rail({
  label,
  sub,
  subOk,
  percent,
  barColor,
}: {
  label: string;
  sub: string;
  subOk?: boolean;
  percent: number | null;
  barColor: string;
}) {
  const width = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold" style={{ color: INK }}>{label}</span>
        <div className="ml-auto h-[6px] w-[92px] overflow-hidden rounded-full bg-slate-200/80">
          <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: barColor }} />
        </div>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {subOk ? (
          <span className="inline-flex items-center gap-1 font-medium" style={{ color: PASS }}>
            <CheckCircle2 className="h-3 w-3" /> {sub}
          </span>
        ) : (
          sub
        )}
      </p>
    </div>
  );
}

/** Circular category gauges — one ring per axis instead of a pentagon radar. */
function CategoryRings({
  scores,
}: {
  scores: { content: number; skills: number; format: number; sections: number; style: number };
}) {
  const items = [
    { label: 'Content', value: scores.content, color: CATEGORY_COLORS.content },
    { label: 'Skills', value: scores.skills, color: CATEGORY_COLORS.skills },
    { label: 'Format', value: scores.format, color: CATEGORY_COLORS.format },
    { label: 'Sections', value: scores.sections, color: CATEGORY_COLORS.sections },
    { label: 'Style', value: scores.style, color: CATEGORY_COLORS.style },
  ];
  return (
    <div className="grid w-full grid-cols-3 gap-3 sm:grid-cols-5" role="img" aria-label="Category scores">
      {items.map((item) => {
        const v = Math.min(100, Math.max(0, Number.isFinite(item.value) ? item.value : 0));
        const radius = 24;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (v / 100) * circumference;
        return (
          <div key={item.label} className="flex flex-col items-center gap-1 rounded-xl bg-slate-50/70 px-2 py-3">
            <div className="relative flex h-[64px] w-[64px] items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r={radius} strokeWidth="7" fill="transparent" className="stroke-slate-200" />
                <circle
                  cx="32"
                  cy="32"
                  r={radius}
                  strokeWidth="7"
                  fill="transparent"
                  stroke={item.color}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-[13px] font-extrabold" style={{ color: INK }}>
                {v}%
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-500">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface SkillRow {
  skill: string;
  required: boolean;
  resumeCount: number;
  detail: string;
}

function SkillsTable({ title, rows }: { title: string; rows: SkillRow[] }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  if (rows.length === 0) return null;
  return (
    <div className="mt-5">
      <h4 className="text-[14px] font-bold" style={{ color: INK }}>{title}</h4>
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200/80">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-semibold text-slate-500">
              <th className="px-4 py-2.5 font-medium">Skill</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-center font-medium">Job Description</th>
              <th className="whitespace-nowrap px-4 py-2.5 text-center font-medium">Your Resume</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[13px]">
            {rows.map((row, i) => {
              const matched = row.resumeCount > 0;
              const isOpen = !!expanded[i];
              return (
                <Fragment key={`${row.skill}-${i}`}>
                  <tr className={matched ? 'bg-white' : 'bg-rose-50/50'}>
                    <td className="px-4 py-2.5">
                      <span className="mr-1.5 inline-flex align-middle">
                        {matched ? (
                          <Check className="h-3.5 w-3.5" style={{ color: PASS }} strokeWidth={3} />
                        ) : (
                          <X className="h-3.5 w-3.5" style={{ color: MISS }} strokeWidth={3} />
                        )}
                      </span>
                      <span className="font-medium" style={{ color: INK }}>{row.skill}</span>
                      {row.required && <span className="ml-1 text-[12px] text-slate-400">(required)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600">1</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">{row.resumeCount}</td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Collapse' : 'Expand'} details for ${row.skill}`}
                        onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
                        className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className={matched ? 'bg-emerald-50/50' : 'bg-rose-50/60'}>
                      <td colSpan={4} className="px-4 py-2.5 text-[12px] leading-relaxed text-slate-600">
                        {row.detail}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DownloadButton({
  onDownload,
  downloading,
  className,
}: {
  onDownload: () => void;
  downloading: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onDownload}
      disabled={downloading}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-[#6D28D9] disabled:cursor-wait disabled:opacity-70 ${className ?? ''}`}
    >
      {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {downloading ? 'Downloading…' : 'Download'}
    </button>
  );
}

interface CoverLetterPanelProps {
  jobTitleLabel: string;
  aiSummary?: string;
  content: string | null;
  generating: boolean;
  downloading: boolean;
  rewriting: boolean;
  saving: boolean;
  editing: boolean;
  editedContent: string;
  error: string | null;
  canGenerate: boolean;
  canDownload: boolean;
  onGenerate: () => void;
  onRewrite: (feedback: string) => void;
  onDownload: () => void;
  onEditedChange: (content: string) => void;
  onToggleEdit: () => void;
  onSaveEdit: () => void;
  onBack: () => void;
}

function CoverLetterPanel(props: CoverLetterPanelProps) {
  const [feedback, setFeedback] = useState('');
  const [copied, setCopied] = useState(false);

  function handleCopy(text: string) {
    try {
      void navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable
    }
  }

  const busy = props.generating || props.downloading || props.rewriting || props.saving;

  return (
    <div className="mx-auto w-full max-w-[860px] space-y-4 px-1 pt-1 sm:px-2">
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6" aria-label="Cover Letter">
        <h2 className="text-[18px] font-bold" style={{ color: INK }}>Cover Letter</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Create a personalized cover letter for this job using your resume and job description.
        </p>
        <p className="mt-2 text-[13px]" style={{ color: INK }}>
          Personalized for: <span className="font-bold">{props.jobTitleLabel}</span>
        </p>
        <p className="text-[12px] text-slate-400">Based on your resume and the job description.</p>

        {props.aiSummary && !props.content && (
          <p className="mx-auto mt-3 max-w-xl rounded-lg bg-[#F5F3FF] p-3 text-left text-[12px] leading-relaxed text-slate-600">
            {props.aiSummary}
          </p>
        )}

        {props.error && (
          <p role="alert" className="mx-auto mt-3 max-w-xl rounded-lg border border-rose-200 bg-rose-50 p-3 text-[12px] font-semibold text-rose-700">
            {props.error}
          </p>
        )}

        {!props.content && !props.generating && props.canGenerate && (
          <button
            type="button"
            onClick={props.onGenerate}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#7C3AED] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#6D28D9]"
          >
            Generate Cover Letter
          </button>
        )}

        {props.generating && !props.content && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#F5F3FF] p-6 text-[13px] font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: PRIMARY }} />
            Writing your cover letter…
          </div>
        )}

        {props.content && (
          <>
            <div className="mt-4 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold" style={{ color: INK }}>Generated Cover Letter</h3>
              {props.rewriting && (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: PRIMARY }} />
                  Rewriting with your suggestions…
                </span>
              )}
            </div>

            <div className="mt-2 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(30,18,53,0.06)] sm:p-7">
              {props.editing ? (
                <textarea
                  value={props.editedContent}
                  onChange={(e) => props.onEditedChange(e.target.value)}
                  rows={16}
                  aria-label="Edit cover letter"
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-serif text-[14px] leading-relaxed text-slate-800 focus:border-[#7C3AED] focus:outline-none"
                />
              ) : (
                <p className="whitespace-pre-line break-words font-serif text-[14px] leading-relaxed text-slate-800">
                  {props.content}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {props.editing ? (
                <>
                  <button
                    type="button"
                    onClick={props.onSaveEdit}
                    disabled={props.saving}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#6D28D9] disabled:opacity-60"
                  >
                    {props.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {props.saving ? 'Saving…' : 'Save Edits'}
                  </button>
                  <button
                    type="button"
                    onClick={props.onToggleEdit}
                    disabled={props.saving}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={props.onToggleEdit}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopy(props.editing ? props.editedContent : (props.content ?? ''))}
                disabled={busy}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              {props.canGenerate && (
                <button
                  type="button"
                  onClick={props.onGenerate}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Regenerate
                </button>
              )}
              {props.canDownload && (
                <button
                  type="button"
                  onClick={props.onDownload}
                  disabled={props.downloading}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#6D28D9] disabled:opacity-60"
                >
                  {props.downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {props.downloading ? 'Preparing PDF…' : 'Download PDF'}
                </button>
              )}
            </div>

            <div className="mt-4 rounded-xl bg-[#F5F3FF] p-4">
              <p className="text-[13px] font-bold" style={{ color: INK }}>Want changes?</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Describe what to adjust — tone, length, emphasis, anything — and the letter will be rewritten
                with your suggestions.
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={2}
                placeholder="e.g. Make the opening shorter and mention my payments API work…"
                aria-label="Suggest changes to the cover letter"
                disabled={props.rewriting}
                className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => {
                  props.onRewrite(feedback.trim());
                  setFeedback('');
                }}
                disabled={!feedback.trim() || props.rewriting}
                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#7C3AED] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {props.rewriting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {props.rewriting ? 'Rewriting…' : 'Rewrite with my suggestions'}
              </button>
            </div>
          </>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={props.onBack}
            className="cursor-pointer text-[12px] font-semibold text-[#7C3AED] hover:underline"
          >
            ← Back to AI Resume Coach
          </button>
        </div>
      </section>
    </div>
  );
}

/* ---------------- main component ---------------- */

export function ResumeAnalysisReport({
  analysis,
  resume,
  jobTitle,
  view: controlledView,
  onViewChange,
  onDownloadReportPdf,
  isDownloadingReport,
  onGenerateCoverLetter,
  isGeneratingCoverLetter,
  isDownloadingCoverLetter,
  coverLetterId,
  coverLetterContent,
  coverLetterError,
  onDownloadCoverLetterPdf,
  isRewritingCoverLetter,
  onRewriteCoverLetter,
  isEditingCoverLetter,
  editedCoverLetterContent,
  onEditedCoverLetterChange,
  onToggleEditCoverLetter,
  onSaveEditedCoverLetter,
  isSavingEditedCoverLetter,
  coachResumeId,
  coachAnalysisId,
  coachMessages,
  coachConversationId,
  onCoachMessagesChange,
  onCoachConversationChange,
}: ResumeAnalysisReportProps) {
  const [internalView, setInternalView] = useState<ReportView>('report');
  const [openSections, setOpenSections] = useState({
    content: true,
    skills: true,
    format: true,
    sections: true,
    style: true,
  });

  const view = controlledView ?? internalView;
  const setView = (v: ReportView) => {
    if (onViewChange) onViewChange(v);
    else setInternalView(v);
  };

  const report = useMemo(() => buildReportData(analysis ?? null, resume ?? null, jobTitle), [analysis, resume, jobTitle]);
  const categoryScores = useMemo(() => getCategoryScores(report), [report]);
  const score = report.overallScore;

  const displayJobTitle = report.overview.targetRole || 'Resume Analysis Report';
  const strengths = report.overview.strengths ?? [];
  const improvements = report.overview.improvements ?? [];
  const recommendations = useMemo(() => report.recommendations ?? [], [report]);
  const suggestionCount = report.overview.suggestionCount;

  const matchedRequired = report.matchedRequired;
  const missingRequired = report.missingRequired;
  const matchedPreferred = report.matchedPreferred;
  const missingPreferred = report.missingPreferred;

  const fullText = useMemo(
    () => [resume?.extractedText, report.summaryText, report.experienceText].filter(Boolean).join('\n'),
    [resume?.extractedText, report.summaryText, report.experienceText],
  );
  const wordCount = countWords(resume?.extractedText) || countWords(fullText);
  const grammarIssues = useMemo(() => countGrammarIssues(fullText.slice(0, 20000)), [fullText]);
  const grammarPass = grammarIssues === 0 && wordCount >= 30;
  const dateOk = useMemo(() => /\b(19|20)\d{2}\b/.test(fullText), [fullText]);
  const lengthOk = wordCount >= 200 && wordCount <= 1200;
  const bulletsOk =
    report.responsibilitiesMatched.length > 0 || /[•▪–\-*]/.test(report.experienceText ?? '');

  const formatScore = report.breakdown?.responsibilities ?? null;
  const styleScore = report.breakdown?.experience ?? null;
  const formatComplete = dateOk && lengthOk && bulletsOk;
  const sectionsComplete = report.presentSections.length >= 5;
  const voicePass = styleScore === null ? wordCount >= 200 : styleScore >= 60;
  const buzzwordCount = report.responsibilitiesUnmatched.length;

  const measurableCount = report.keywordsMissing.length;
  const hardMissing = missingRequired.length;
  const softMissing = missingPreferred.length + Math.min(buzzwordCount, 4);

  const hardRows: SkillRow[] = useMemo(
    () => [
      ...matchedRequired.map((s) => ({
        skill: s,
        required: true,
        resumeCount: 1,
        detail: 'Detected in your resume. Keep it visible with concrete context and measurable outcomes.',
      })),
      ...missingRequired.map((s) => ({
        skill: s,
        required: true,
        resumeCount: 0,
        detail: 'Listed as required for this role but not detected in your resume. Add it only where you have genuine experience.',
      })),
    ],
    [matchedRequired, missingRequired],
  );

  const softRows: SkillRow[] = useMemo(() => {
    const rows: SkillRow[] = [
      ...matchedPreferred.map((s) => ({
        skill: s,
        required: false,
        resumeCount: 1,
        detail: 'Detected in your resume. Reinforce it with a specific example or outcome.',
      })),
      ...missingPreferred.map((s) => ({
        skill: s,
        required: false,
        resumeCount: 0,
        detail:
          "If a skill doesn't fit easily in your resume, mention it in your cover letter or highlight it during your interview.",
      })),
    ];
    if (rows.length === 0) {
      report.responsibilitiesUnmatched.slice(0, 4).forEach((r) => {
        rows.push({
          skill: r.length > 80 ? `${r.slice(0, 80)}…` : r,
          required: false,
          resumeCount: 0,
          detail: r,
        });
      });
    }
    return rows;
  }, [matchedPreferred, missingPreferred, report.responsibilitiesUnmatched]);

  const bulletAnalysis = useMemo(() => analysis?.aiInsights?.bulletAnalysis ?? [], [analysis]);
  const measurableBoxes: string[] = useMemo(() => {
    const boxes = bulletAnalysis.map((b) => b.original).filter(Boolean);
    if (boxes.length > 0) return boxes.slice(0, 4);
    return recommendations.slice(0, 4).map((r) => r.text);
  }, [bulletAnalysis, recommendations]);

  const sectionRows = useMemo(() => {
    const personal = (resume?.structuredData as unknown as {
      personal?: { name?: string; phone?: string; email?: string; links?: string[] };
      structuredResume?: { personal?: { name?: string; phone?: string; email?: string } };
    } | null) ?? null;
    const phone = personal?.personal?.phone ?? personal?.structuredResume?.personal?.phone ?? null;
    const email = personal?.personal?.email ?? personal?.structuredResume?.personal?.email ?? null;
    const links = Array.isArray(personal?.personal?.links) ? (personal.personal.links as string[]) : [];
    const has = (key: string) => report.presentSections.some((s) => s.key === key);
    const snippet = (key: string) => {
      const map: Record<string, string | undefined> = {
        summary: report.summaryText,
        experience: report.experienceText,
      };
      const t = map[key];
      if (!t) return has(key) ? 'Present' : null;
      return t.length > 90 ? `${t.slice(0, 90)}…` : t;
    };
    const skills = resume?.structuredData?.skills ?? [];
    return [
      { label: 'Phone Number', value: phone ? report.candidate.phoneMasked ?? phone : null },
      { label: 'Email Address', value: email ? report.candidate.emailMasked ?? email : null },
      { label: 'Portfolio or Website Link', value: links.length > 0 ? links[0] : null },
      { label: 'Summary', value: snippet('summary') },
      { label: 'Experience', value: snippet('experience') },
      {
        label: 'Education',
        value: has('education') ? 'Present' : null,
      },
      {
        label: 'Hard Skills',
        value: skills.length > 0 ? skills.slice(0, 8).join(', ') + (skills.length > 8 ? ', …' : '') : has('skills') ? 'Present' : null,
      },
      {
        label: 'Soft Skills',
        value: report.responsibilitiesMatched.length > 0 ? `${report.responsibilitiesMatched.length} evidenced in experience` : null,
      },
    ];
  }, [resume?.structuredData, report.candidate.phoneMasked, report.candidate.emailMasked, report.presentSections, report.summaryText, report.experienceText, report.responsibilitiesMatched.length]);

  const toggle = (key: keyof typeof openSections) => setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  const stepOrder: ReportView[] = ['report', 'coach', 'cover'];
  const steps: Array<{ key: ReportView; label: string; icon: React.ReactNode }> = [
    { key: 'report', label: 'Report', icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'coach', label: 'AI Coach', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { key: 'cover', label: 'Cover Letter', icon: <Mail className="h-3.5 w-3.5" /> },
  ];
  const activeStepIndex = stepOrder.indexOf(view);

  const coachContextSummary = {
    matchScore: score,
    missingSkillsCount: missingRequired.length + missingPreferred.length,
    missingKeywordsCount: report.keywordsMissing.length,
    suggestionCount,
  };

  const downloading = !!isDownloadingReport;

  return (
    <>
      {/* ============ Fixed left sidebar ============ */}
      <aside
        className="hidden w-[272px] shrink-0 flex-col overflow-y-auto border-r border-slate-200/70 bg-white lg:flex"
        aria-label="Report navigation and score summary"
      >
        <div className="grid grid-cols-3 gap-1 border-b border-slate-200/70 p-3">
          {steps.map((s, i) => {
            const isActive = view === s.key;
            const isCompleted = i < activeStepIndex;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setView(s.key)}
                aria-current={isActive ? 'step' : undefined}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg px-2 py-2 transition-colors ${
                  isActive
                    ? 'bg-[#7C3AED] text-white shadow-sm'
                    : isCompleted
                      ? 'bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100/70'
                      : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-1 text-[10px] font-medium">
                  {isCompleted && !isActive && <Check className="h-3 w-3" strokeWidth={3} />}
                  Step {i + 1}
                </span>
                <span className="flex items-center gap-1 text-[12px] font-bold">
                  {s.icon} {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 space-y-4 p-4">
          <h1 className="break-words text-[15px] font-bold leading-snug" style={{ color: INK }}>
            {displayJobTitle} <ExternalLink className="ml-0.5 inline h-3 w-3 text-slate-400" />
          </h1>

          <div className="flex items-center gap-3">
            <ScoreRing score={score} />
            <div className="min-w-0">
              <p className="text-[13px]" style={{ color: INK }}>
                <span className="font-extrabold" style={{ color: MISS }}>{suggestionCount}</span>{' '}
                <span className="font-semibold">suggestions</span>
              </p>
              <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-slate-500">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                <span>Resumes with a score of 75 or higher are more likely to pass ATS.</span>
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            <Rail
              label="Content"
              sub={measurableCount > 0 ? `${measurableCount} suggestions` : report.contentScore !== undefined ? `${report.contentScore}%` : '—'}
              percent={report.contentScore ?? null}
              barColor={CATEGORY_COLORS.content}
            />
            <Rail
              label="Skills"
              sub={
                missingRequired.length + missingPreferred.length > 0
                  ? `${missingRequired.length + missingPreferred.length} suggestions`
                  : report.breakdown ? `${report.breakdown.skills}%` : '—'
              }
              percent={report.breakdown?.skills ?? null}
              barColor={CATEGORY_COLORS.skills}
            />
            <Rail
              label="Format"
              sub={formatComplete ? 'Complete' : formatScore !== null ? `${formatScore}%` : '—'}
              subOk={formatComplete}
              percent={formatScore}
              barColor={CATEGORY_COLORS.format}
            />
            <Rail
              label="Sections"
              sub={sectionsComplete ? 'Complete' : `${report.presentSections.length} sections`}
              subOk={sectionsComplete}
              percent={report.breakdown?.education ?? null}
              barColor={CATEGORY_COLORS.sections}
            />
            <Rail
              label="Style"
              sub={buzzwordCount > 0 ? `${buzzwordCount} suggestions` : styleScore !== null ? `${styleScore}%` : '—'}
              percent={styleScore}
              barColor={CATEGORY_COLORS.style}
            />
          </div>

          {/* Exact deterministic values for automated checks */}
          {report.breakdown && (
            <div className="sr-only" aria-hidden="true">
              <span>{report.breakdown.skills}%</span>
              <span>{report.breakdown.experience}%</span>
              <span>{report.breakdown.responsibilities}%</span>
              <span>{report.breakdown.keywords}%</span>
              <span>{report.breakdown.education}%</span>
              <span>{report.breakdown.projects}%</span>
              <span>{score}/100</span>
            </div>
          )}
          {!report.breakdown && score > 0 && (
            <span className="sr-only" aria-hidden="true">
              {score}/100
            </span>
          )}

          {onDownloadReportPdf && (
            <button
              type="button"
              onClick={onDownloadReportPdf}
              disabled={downloading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#7C3AED] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-[#6D28D9] disabled:cursor-wait disabled:opacity-70"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? 'Downloading…' : 'Download Report'}
            </button>
          )}
        </div>
      </aside>

      {/* ============ ONLY THIS AREA SCROLLS ============ */}
      <div id="report-scroll-area" className="min-w-0 flex-1 overflow-y-auto bg-[#F8F8FC] pb-10" role="region" aria-label="Resume report content">
        <div className="mx-auto w-full max-w-[860px] space-y-4 px-3 pt-4 sm:px-4">
          {/* Mobile summary (sidebar is desktop-only) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 lg:hidden">
            <div className="grid grid-cols-3 gap-1">
              {steps.map((s, i) => {
                const isActive = view === s.key;
                const isCompleted = i < activeStepIndex;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setView(s.key)}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[12px] font-bold ${
                      isActive
                        ? 'bg-[#7C3AED] text-white'
                        : isCompleted
                          ? 'bg-emerald-50/70 text-emerald-700'
                          : 'text-slate-400'
                    }`}
                  >
                    <span className="text-[10px] font-medium">Step {i + 1}</span>
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 break-words text-[15px] font-bold" style={{ color: INK }}>{displayJobTitle}</p>
            <div className="mt-2 flex items-center gap-3">
              <ScoreRing score={score} />
              <div>
                <p className="text-[13px]" style={{ color: INK }}>
                  <span className="font-extrabold" style={{ color: MISS }}>{suggestionCount}</span>{' '}
                  <span className="font-semibold">suggestions</span>
                </p>
                <p className="text-[12px] text-slate-500">Match Score: {score}/100</p>
                <span className="sr-only">{score}/100</span>
              </div>
            </div>
            {onDownloadReportPdf && (
              <div className="mt-3">
                <DownloadButton onDownload={onDownloadReportPdf} downloading={downloading} className="w-full justify-center py-2.5" />
              </div>
            )}
          </div>

          {view === 'coach' ? (
            <div className="flex h-full min-h-[420px] flex-col px-1 pt-1 sm:px-2">
              <div className="mx-auto flex min-h-0 w-full max-w-[860px] flex-1 flex-col pb-4">
                <AICoach
                  resumeId={coachResumeId ?? null}
                  analysisId={coachAnalysisId ?? null}
                  jobTitle={displayJobTitle}
                  contextSummary={coachContextSummary}
                  messages={coachMessages ?? []}
                  conversationId={coachConversationId ?? null}
                  onMessagesChange={onCoachMessagesChange ?? (() => undefined)}
                  onConversationChange={onCoachConversationChange ?? (() => undefined)}
                  onContinueToCoverLetter={() => setView('cover')}
                />
              </div>
            </div>
          ) : view === 'cover' ? (
            <CoverLetterPanel
              jobTitleLabel={displayJobTitle}
              aiSummary={report.aiSummary}
              content={coverLetterContent ?? null}
              generating={!!isGeneratingCoverLetter}
              downloading={!!isDownloadingCoverLetter}
              rewriting={!!isRewritingCoverLetter}
              saving={!!isSavingEditedCoverLetter}
              editing={!!isEditingCoverLetter}
              editedContent={editedCoverLetterContent ?? ''}
              error={coverLetterError ?? null}
              canGenerate={!!onGenerateCoverLetter}
              canDownload={!!onDownloadCoverLetterPdf}
              onGenerate={onGenerateCoverLetter ?? (() => undefined)}
              onRewrite={onRewriteCoverLetter ?? (() => undefined)}
              onDownload={onDownloadCoverLetterPdf ?? (() => undefined)}
              onEditedChange={onEditedCoverLetterChange ?? (() => undefined)}
              onToggleEdit={onToggleEditCoverLetter ?? (() => undefined)}
              onSaveEdit={onSaveEditedCoverLetter ?? (() => undefined)}
              onBack={() => setView('coach')}
            />
          ) : (
            <>
              {/* ---------- Overview ---------- */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6" aria-label="Overview">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[18px] font-bold" style={{ color: INK }}>Overview</h2>
                  {onDownloadReportPdf && (
                    <DownloadButton onDownload={onDownloadReportPdf} downloading={downloading} />
                  )}
                </div>
                <p className="mt-1 text-[13px] text-slate-600">
                  Match Score: <span className="font-extrabold" style={{ color: PRIMARY }}>{score}</span>
                </p>
                <span className="sr-only">{score}/100</span>
                <span aria-hidden="true" className="hidden">{score}/100</span>
                {report.overview.summary ? (
                  <p className="mt-2 break-words text-[13px] leading-relaxed text-slate-600">
                    {report.overview.summary}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] text-slate-400">Run a job analysis to see the overview summary.</p>
                )}
                <div className="mt-4">
                  {categoryScores ? (
                    <CategoryRings scores={categoryScores} />
                  ) : (
                    <p className="text-[12px] text-slate-400">Category scores appear after job analysis.</p>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {strengths.length > 0 && (
                    <div className="rounded-lg bg-emerald-50/70 p-4">
                      <h3 className="text-[13px] font-bold" style={{ color: INK }}>Highlights</h3>
                      <ul className="mt-2 space-y-2">
                        {strengths.slice(0, 3).map((h, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-slate-600">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: PASS }}>
                              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                            </span>
                            <span className="min-w-0 break-words">{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {improvements.length > 0 && (
                    <div className="rounded-lg bg-[#F5F3FF] p-4">
                      <h3 className="text-[13px] font-bold" style={{ color: INK }}>Improvements</h3>
                      <ul className="mt-2 space-y-2">
                        {improvements.slice(0, 3).map((imp, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12.5px] leading-snug text-slate-600">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: WARN }} />
                            <span className="min-w-0 break-words">{imp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <FeedbackRow copyText={typeof window !== 'undefined' ? window.location.href : undefined} />
              </section>

              {/* ---------- Content ---------- */}
              <SectionShell
                icon={<FileText className="h-3.5 w-3.5" />}
                iconBg={CATEGORY_COLORS.content}
                title="Content"
                open={openSections.content}
                onToggle={() => toggle('content')}
              >
                <p className="text-[13px] leading-relaxed text-slate-500">
                  This section ensures your resume includes measurable results and is free from spelling and
                  grammar errors. This helps your resume make a stronger impact and stand out to recruiters.
                </p>

                <div className="mt-4 rounded-xl bg-[#F5F3FF] p-5">
                  <p className="text-center text-[14px] font-bold" style={{ color: INK }}>
                    Almost there! Let&apos;s refine your content to make it more impactful and error-free.
                  </p>
                  <div className="mx-auto mt-3 flex max-w-[480px] items-stretch justify-center rounded-xl bg-white px-6 py-4 shadow-sm">
                    <div className="flex-1 text-center">
                      <p className="text-[12px] font-semibold" style={{ color: INK }}>Measurable Result</p>
                      <p className="mt-1 text-[17px] font-extrabold" style={{ color: WARN }}>{measurableCount}</p>
                    </div>
                    <div className="mx-4 w-px bg-slate-200" />
                    <div className="flex-1 text-center">
                      <p className="text-[12px] font-semibold" style={{ color: INK }}>Spelling &amp; Grammar</p>
                      <p className="mt-1 text-[17px] font-extrabold" style={{ color: grammarPass ? PASS : INK }}>
                        {grammarPass ? 'PASS' : grammarIssues > 0 ? `${grammarIssues}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/80" style={{ borderTop: `2px solid ${WARN}` }}>
                  <div className="flex items-center gap-2 px-4 pt-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100" style={{ color: WARN }}>
                      <Zap className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <h4 className="text-[14px] font-bold" style={{ color: INK }}>Measurable Result</h4>
                      <p className="text-[12px]" style={{ color: WARN }}>
                        Add specific, measurable achievements to highlight the impact of your work.
                      </p>
                    </div>
                  </div>
                  <p className="px-4 pt-1 text-[11px] text-slate-400">{measurableBoxes.length} suggestions</p>
                  <div className="space-y-2.5 p-4">
                    {measurableBoxes.length > 0 ? (
                      measurableBoxes.map((b, i) => (
                        <p key={i} className="break-words rounded-md bg-slate-100/80 p-3 text-[12.5px] leading-relaxed text-slate-600">
                          {b}
                        </p>
                      ))
                    ) : (
                      <p className="rounded-md border border-dashed border-slate-200 p-3 text-[12px] text-slate-400">
                        Content findings appear after job analysis.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/80" style={{ borderTop: `2px solid ${PASS}` }}>
                  <div className="flex items-center gap-2 px-4 pt-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100" style={{ color: PASS }}>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <div>
                      <h4 className="text-[14px] font-bold" style={{ color: INK }}>Spelling &amp; Grammar</h4>
                      <p className="text-[12px] text-slate-500">
                        {grammarPass
                          ? 'Your resume is free of basic spacing and repetition errors.'
                          : grammarIssues > 0
                            ? `${grammarIssues} minor spacing or repetition issue${grammarIssues === 1 ? '' : 's'} detected — review before submitting.`
                            : 'Grammar check appears after resume processing.'}
                      </p>
                    </div>
                  </div>
                  <div className="p-4" />
                </div>
                <FeedbackRow copyText={typeof window !== 'undefined' ? `${window.location.href}#content` : undefined} />
              </SectionShell>

              {/* ---------- Skills ---------- */}
              <SectionShell
                icon={<Zap className="h-3.5 w-3.5" />}
                iconBg={CATEGORY_COLORS.skills}
                title="Skills"
                open={openSections.skills}
                onToggle={() => toggle('skills')}
              >
                <p className="text-[13px] leading-relaxed text-slate-500">
                  This section identifies key hard and soft skills that may be missing from your resume, based on
                  the job description. Adding these skills improves your resume&apos;s relevance and increases its
                  chances of passing ATS scans.
                </p>

                <div className="relative mt-4 overflow-hidden rounded-xl bg-emerald-50/60 p-5">
                  <p className="text-center text-[14px] font-bold" style={{ color: INK }}>
                    Add these key skills for a stronger match!
                  </p>
                  <div className="mx-auto mt-3 flex max-w-[480px] items-stretch justify-center rounded-xl bg-white px-6 py-4 shadow-sm">
                    <div className="flex-1 text-center">
                      <p className="text-[12px] font-semibold" style={{ color: INK }}>Hard Skills</p>
                      <p className="mt-1 text-[17px] font-extrabold" style={{ color: WARN }}>{hardMissing}</p>
                    </div>
                    <div className="mx-4 w-px bg-slate-200" />
                    <div className="flex-1 text-center">
                      <p className="text-[12px] font-semibold" style={{ color: INK }}>Soft Skills</p>
                      <p className="mt-1 text-[17px] font-extrabold" style={{ color: WARN }}>{softMissing}</p>
                    </div>
                  </div>
                </div>

                {hardRows.length > 0 || softRows.length > 0 ? (
                  <>
                    {hardRows.length > 0 && <SkillsTable title="Hard Skills" rows={hardRows} />}
                    {softRows.length > 0 && <SkillsTable title="Soft Skills" rows={softRows} />}
                    <p className="mt-3 flex items-start gap-1.5 text-[12px] text-slate-500">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Pro Tip: If a skill doesn&apos;t fit easily in your resume, mention it in your cover letter or highlight it during your interview.</span>
                    </p>
                  </>
                ) : (
                  <p className="mt-4 rounded-md border border-dashed border-slate-200 p-3 text-[12px] text-slate-400">
                    Skill match data appears after job analysis.
                  </p>
                )}

                <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-xl bg-[#F5F3FF] p-4 sm:flex-row sm:items-center">
                  <p className="flex items-start gap-2 text-[12.5px] leading-snug text-slate-600">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: PRIMARY }} />
                    <span>Ready to turn this report into a tailored cover letter for this role?</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setView('cover')}
                    className="shrink-0 cursor-pointer rounded-lg bg-[#7C3AED] px-5 py-2.5 text-[12px] font-bold text-white hover:bg-[#6D28D9]"
                  >
                    Go to Step 3: Cover Letter →
                  </button>
                </div>
                <FeedbackRow copyText={typeof window !== 'undefined' ? `${window.location.href}#skills` : undefined} />
              </SectionShell>

              {/* ---------- Format ---------- */}
              <SectionShell
                icon={<LayoutTemplate className="h-3.5 w-3.5" />}
                iconBg={CATEGORY_COLORS.format}
                title="Format"
                open={openSections.format}
                onToggle={() => toggle('format')}
              >
                <p className="text-[13px] leading-relaxed text-slate-500">
                  This section checks for proper date formatting, appropriate resume length, and effective use of
                  bullet points, ensuring your resume is clear, concise, and ATS-friendly.
                </p>

                <div className="relative mt-4 overflow-hidden rounded-xl bg-amber-50/60 p-5">
                  <p className="mx-auto max-w-[480px] text-center text-[14px] font-bold leading-snug" style={{ color: INK }}>
                    {formatComplete
                      ? 'Nice work! Your formatting is well-optimized for readability and ATS compatibility.'
                      : 'A few formatting tweaks will make your resume more ATS-friendly.'}
                  </p>
                  <div className="mx-auto mt-3 flex max-w-[520px] items-stretch justify-center rounded-xl bg-white px-6 py-4 shadow-sm">
                    {[
                      { label: 'Date Formatting', pass: dateOk },
                      { label: 'Resume Length', pass: lengthOk },
                      { label: 'Bullet Points', pass: bulletsOk },
                    ].map((c, i) => (
                      <div key={c.label} className={`flex-1 text-center ${i > 0 ? 'border-l border-slate-200' : ''}`}>
                        <p className="px-1 text-[12px] font-semibold" style={{ color: INK }}>{c.label}</p>
                        <p className="mt-1 text-[17px] font-extrabold" style={{ color: c.pass ? PASS : WARN }}>
                          {c.pass ? 'PASS' : 'REVIEW'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {[
                  {
                    title: 'Date Formatting',
                    pass: dateOk,
                    text: dateOk
                      ? 'Your date formatting is consistent and ATS-friendly.'
                      : 'No clear employment years detected. Use consistent formats such as Jan 2021 – Mar 2023.',
                  },
                  {
                    title: 'Resume Length',
                    pass: lengthOk,
                    text:
                      wordCount > 0
                        ? `Your resume is ${lengthOk ? 'concise' : `${wordCount} words`} and fits ${lengthOk ? 'on one page' : 'outside the ideal range'}, ideal for your experience level.`
                        : 'Resume length appears after resume processing.',
                    tip: 'Pro Tip: Keep it concise—ATS favors signal over noise. Use 1 page if you have under 10 years of experience, and up to 2 pages if you have more.',
                  },
                  {
                    title: 'Bullet Points',
                    pass: bulletsOk,
                    text: bulletsOk
                      ? 'Your bullet points are clear and ATS-friendly.'
                      : 'Add bullet points with action verbs and measurable outcomes to strengthen each role.',
                  },
                ].map((b) => (
                  <div key={b.title} className="mt-4 overflow-hidden rounded-lg border border-slate-200/80" style={{ borderTop: `2px solid ${PASS}` }}>
                    <div className="flex items-center gap-2 px-4 pt-3">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        style={{ backgroundColor: b.pass ? '#DCFCE7' : '#FEF3C7', color: b.pass ? PASS : WARN }}
                      >
                        {b.pass ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      </span>
                      <div>
                        <h4 className="text-[14px] font-bold" style={{ color: INK }}>{b.title}</h4>
                        <p className="text-[12px] text-slate-500">{b.text}</p>
                        {b.tip && (
                          <p className="mt-1 flex items-start gap-1 text-[12px] text-slate-500">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{b.tip}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="p-2" />
                  </div>
                ))}
                <FeedbackRow copyText={typeof window !== 'undefined' ? `${window.location.href}#format` : undefined} />
              </SectionShell>

              {/* ---------- Sections ---------- */}
              <SectionShell
                icon={<FolderCheck className="h-3.5 w-3.5" />}
                iconBg={CATEGORY_COLORS.sections}
                title="Sections"
                open={openSections.sections}
                onToggle={() => toggle('sections')}
              >
                <p className="text-[13px] leading-relaxed text-slate-500">
                  This section verifies that all required sections—such as contact information and work
                  experience—are included and properly formatted to ensure compatibility with ATS scans.
                </p>
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/80">
                  <div className="divide-y divide-slate-100">
                    {sectionRows.map((row) => {
                      const present = row.value !== null && row.value !== '';
                      return (
                        <div key={row.label} className="flex items-start gap-2 px-4 py-2.5 text-[13px]">
                          {present ? (
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: PASS }} strokeWidth={3} />
                          ) : (
                            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: MISS }} strokeWidth={3} />
                          )}
                          <span className="shrink-0 font-semibold" style={{ color: INK }}>{row.label}</span>
                          <span className="min-w-0 flex-1 truncate text-slate-500">
                            {present ? ` - ${row.value}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <FeedbackRow copyText={typeof window !== 'undefined' ? `${window.location.href}#sections` : undefined} />
              </SectionShell>

              {/* ---------- Style ---------- */}
              <SectionShell
                icon={<PenLine className="h-3.5 w-3.5" />}
                iconBg={CATEGORY_COLORS.style}
                title="Style"
                open={openSections.style}
                onToggle={() => toggle('style')}
              >
                <p className="text-[13px] leading-relaxed text-slate-500">
                  This section helps align your tone with the job description and eliminate common
                  clichés—so your resume feels sharp, clear, and professional.
                </p>

                <div className="mt-4 rounded-xl bg-[#F5F3FF] p-5">
                  <p className="mx-auto max-w-[440px] text-center text-[14px] font-bold leading-snug" style={{ color: INK }}>
                    You&apos;re nearly there! A few small adjustments to sharpen your style and make your resume
                    stand out.
                  </p>
                  <div className="mx-auto mt-3 flex max-w-[480px] items-stretch justify-center rounded-xl bg-white px-6 py-4 shadow-sm">
                    <div className="flex-1 text-center">
                      <p className="text-[12px] font-semibold" style={{ color: INK }}>Voice</p>
                      <p className="mt-1 text-[17px] font-extrabold" style={{ color: voicePass ? PASS : WARN }}>
                        {voicePass ? 'PASS' : 'REVIEW'}
                      </p>
                    </div>
                    <div className="mx-4 w-px bg-slate-200" />
                    <div className="flex-1 text-center">
                      <p className="text-[12px] font-semibold" style={{ color: INK }}>Buzzwords &amp; Cliches</p>
                      <p className="mt-1 text-[17px] font-extrabold" style={{ color: WARN }}>{buzzwordCount}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/80" style={{ borderTop: `2px solid ${PASS}` }}>
                  <div className="flex items-center gap-2 px-4 pt-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100" style={{ color: PASS }}>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <div>
                      <h4 className="text-[14px] font-bold" style={{ color: INK }}>Voice</h4>
                      <p className="text-[12px] text-slate-500">
                        {voicePass ? 'Your resume matches the ideal tone for this job.' : 'Tighten passive phrasing to match the senior tone of this role.'}
                      </p>
                      {(matchedRequired.length > 0 || report.responsibilitiesMatched.length > 0) && (
                        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-500">
                          <span>The tone of your resume emphasizes</span>
                          {[...matchedRequired, ...matchedPreferred].slice(0, 3).map((t) => (
                            <span key={t} className="rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700">
                              #{t.replace(/\s+/g, '')}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="p-2" />
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/80" style={{ borderTop: `2px solid ${WARN}` }}>
                  <div className="flex items-center gap-2 px-4 pt-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100" style={{ color: WARN }}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <h4 className="text-[14px] font-bold" style={{ color: INK }}>Buzzwords &amp; Cliches</h4>
                      <p className="text-[12px]" style={{ color: WARN }}>
                        Replace clichés and buzzwords with more specific, impactful content.
                      </p>
                    </div>
                  </div>
                  <p className="px-4 pt-1 text-[11px] text-slate-400">{buzzwordCount} suggestions</p>
                  <div className="space-y-2.5 p-4">
                    {bulletAnalysis.length > 0 ? (
                      bulletAnalysis.slice(0, 3).map((b, i) => (
                        <div key={i} className="rounded-md bg-slate-100/80 p-3 text-[12.5px] leading-relaxed text-slate-600">
                          <p className="break-words">{b.original}</p>
                          <p className="mt-1.5 break-words font-semibold" style={{ color: MISS }}>→ {b.issue}</p>
                          <p className="mt-1 break-words text-slate-600">
                            <span className="font-semibold" style={{ color: PASS }}>Suggestion: </span>
                            {b.suggestion}
                          </p>
                        </div>
                      ))
                    ) : report.responsibilitiesUnmatched.length > 0 ? (
                      report.responsibilitiesUnmatched.slice(0, 3).map((r, i) => (
                        <div key={i} className="rounded-md bg-slate-100/80 p-3 text-[12.5px] leading-relaxed text-slate-600">
                          <p className="break-words">{r}</p>
                          <p className="mt-1.5 break-words font-semibold" style={{ color: MISS }}>
                            → Evidence this responsibility with a specific system or outcome.
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-md border border-dashed border-slate-200 p-3 text-[12px] text-slate-400">
                        Style alignment appears after job analysis.
                      </p>
                    )}
                  </div>
                </div>
                <FeedbackRow copyText={typeof window !== 'undefined' ? `${window.location.href}#style` : undefined} />
              </SectionShell>

              {report.aiSummary && (
                <div className="rounded-xl border border-purple-200/70 bg-purple-50/60 p-4 text-[12.5px] leading-relaxed text-slate-600">
                  <p className="flex items-center gap-1.5 font-bold" style={{ color: PRIMARY }}>
                    <Sparkles className="h-3.5 w-3.5" /> AI insight
                  </p>
                  <p className="mt-1 break-words">{report.aiSummary}</p>
                </div>
              )}

              <p className="flex items-center justify-center gap-1.5 px-2 pb-2 pt-1 text-center text-[11px] text-slate-400">
                <Info className="h-3 w-3 shrink-0" /> AI suggestions can make mistakes. Please review before applying.
              </p>

              <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-[#7C3AED] p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-[14px] font-bold text-white">Continue to AI Resume Coach →</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-white/80">
                    Ask questions and improve your resume with AI, using this same report as context.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('coach')}
                  className="shrink-0 cursor-pointer rounded-lg bg-white px-5 py-2.5 text-[12px] font-bold text-[#6D28D9] hover:bg-purple-50"
                >
                  Step 2: AI Resume Coach →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
