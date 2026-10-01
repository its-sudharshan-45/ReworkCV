import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  Code2,
  Download,
  FileText,
  FolderCheck,
  LayoutTemplate,
  Lightbulb,
  Loader2,
  Mail,
  Palette,
  Pencil,
  Sparkles,
} from 'lucide-react';
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';
import { buildReportData, getCategoryScores } from '@/features/resume/utils/report-data';

interface ResumeAnalysisReportProps {
  analysis: JobMatchAnalysis | null | undefined;
  resume: ResumeDetail | null | undefined;
  jobTitle?: string;
  analysisId?: string | null;
  onDownloadReportPdf?: () => void;
  onGenerateCoverLetter?: () => void;
  isGeneratingCoverLetter?: boolean;
  onNewScan?: () => void;
  onEditResume?: () => void;
}

type SectionKey = 'content' | 'skills' | 'format' | 'sections' | 'style' | 'action';

function ScoreRing({ score }: { score: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} strokeWidth="10" fill="transparent" className="stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx="55"
          cy="55"
          r={radius}
          strokeWidth="10"
          fill="transparent"
          stroke="#16A36A"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{score > 0 ? score : '—'}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score</span>
      </div>
    </div>
  );
}

function Radar({ scores }: { scores: { content: number; skills: number; format: number; sections: number; style: number } }) {
  const cx = 80;
  const cy = 80;
  const r = 56;
  const axes = [
    { angle: -90, label: 'Content', key: 'content' as const },
    { angle: -18, label: 'Format', key: 'format' as const },
    { angle: 54, label: 'Style', key: 'style' as const },
    { angle: 126, label: 'Sections', key: 'sections' as const },
    { angle: 198, label: 'Skills', key: 'skills' as const },
  ];
  const toRad = (d: number) => (d * Math.PI) / 180;
  const point = (angle: number, value: number) => {
    const v = Math.min(100, Math.max(0, value)) / 100;
    return { x: cx + r * v * Math.cos(toRad(angle)), y: cy + r * v * Math.sin(toRad(angle)) };
  };
  const dataPoints = axes.map((a) => point(a.angle, scores[a.key]));
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-label="Category score radar chart">
      {[0.25, 0.5, 0.75, 1].map((level, li) => (
        <polygon
          key={li}
          points={axes.map((a) => point(a.angle, level * 100)).map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="0.8"
        />
      ))}
      {axes.map((a, i) => {
        const end = point(a.angle, 100);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#E2E8F0" strokeWidth="0.8" />;
      })}
      <polygon
        points={dataPoints.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="rgba(22,163,106,0.15)"
        stroke="#16A36A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#16A36A" stroke="white" strokeWidth="1" />
      ))}
      {axes.map((a, i) => {
        const lp = point(a.angle, 128);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="7.5" fontWeight="600" fill="#64748B">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

function CategoryBar({ label, score, color }: { label: string; score?: number; color: string }) {
  if (score === undefined || !Number.isFinite(score)) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-800 dark:text-slate-200">{label}</span>
        <span className="text-[11px] font-bold text-slate-500">{score}/100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SectionCard({
  id,
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="flex w-full cursor-pointer items-center gap-2 px-5 py-4 text-left"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#16A36A]/10 text-[#16A36A]">{icon}</span>
        <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">{title}</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={`${id}-body`} className="space-y-4 border-t border-slate-100 px-5 py-5 dark:border-slate-800">
          {children}
        </div>
      )}
    </section>
  );
}

export function ResumeAnalysisReport({
  analysis,
  resume,
  jobTitle,
  onDownloadReportPdf,
  onGenerateCoverLetter,
  isGeneratingCoverLetter,
  onNewScan,
  onEditResume,
}: ResumeAnalysisReportProps) {
  const [view, setView] = useState<'report' | 'resume' | 'cover'>('report');
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    content: true,
    skills: false,
    format: false,
    sections: false,
    style: false,
    action: false,
  });

  const report = useMemo(() => buildReportData(analysis ?? null, resume ?? null, jobTitle), [analysis, resume, jobTitle]);
  const categoryScores = useMemo(() => getCategoryScores(report), [report]);
  const score = report.overallScore;

  const toggle = (key: SectionKey) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const displayJobTitle = report.overview.targetRole || 'Resume Analysis Report';
  const strengths = report.overview.strengths ?? [];
  const improvements = report.overview.improvements ?? [];

  return (
    <div id="resume-analysis-report" className="w-full space-y-5">
      {/* Header: nav + title + score + download */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-1 text-xs font-bold">
            {(['report', 'resume', 'cover'] as const).map((v, i) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 capitalize transition-colors ${
                  view === v ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Step {i + 1} · {v === 'report' ? 'Report' : v === 'resume' ? 'Resume' : 'Cover Letter'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {onNewScan && (
              <button
                type="button"
                onClick={onNewScan}
                className="cursor-pointer rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                + New Scan
              </button>
            )}
            {onDownloadReportPdf && (
              <button
                type="button"
                onClick={onDownloadReportPdf}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 pt-4">
          <div className="min-w-0 max-w-full">
            <h1 className="break-words text-lg font-extrabold text-slate-900 sm:text-xl dark:text-slate-100">{displayJobTitle}</h1>
            <p className="mt-1 break-words text-xs text-slate-500">
              {report.candidate.name ? `${report.candidate.name} · ` : ''}{report.candidate.filename} · {report.overview.reportDate}
              {report.candidate.emailMasked ? ` · ${report.candidate.emailMasked}` : ''}
              {report.candidate.phoneMasked ? ` · ${report.candidate.phoneMasked}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-black text-emerald-700 dark:text-emerald-400">
              {score}/100
            </span>
            {report.overview.category && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {report.overview.category}
              </span>
            )}
          </div>
        </div>
      </div>

      {view === 'cover' ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Mail className="mx-auto h-8 w-8 text-emerald-600" />
          <h2 className="mt-3 text-base font-extrabold text-slate-900 dark:text-slate-100">Tailored Cover Letter</h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Generate a cover letter grounded in this report&apos;s verified strengths and the target job description.
          </p>
          {onGenerateCoverLetter && (
            <button
              type="button"
              onClick={onGenerateCoverLetter}
              disabled={isGeneratingCoverLetter}
              className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isGeneratingCoverLetter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isGeneratingCoverLetter ? 'Generating…' : 'Generate Cover Letter'}
            </button>
          )}
        </div>
      ) : view === 'resume' ? (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Resume Snapshot</h2>
          {report.summaryText ? (
            <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-slate-700 dark:text-slate-300">{report.summaryText}</p>
          ) : null}
          {report.experienceText ? (
            <div className="mt-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Experience</h3>
              <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-slate-700 dark:text-slate-300">{report.experienceText}</p>
            </div>
          ) : null}
          {!report.summaryText && !report.experienceText && (
            <p className="mt-2 text-xs text-slate-500">Resume text preview is unavailable for this scan.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex justify-center">
                <ScoreRing score={score} />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span className="font-black text-rose-500">{report.overview.suggestionCount}</span> suggestions
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Resumes with a score of 75 or higher are more likely to pass ATS.
              </p>
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <CategoryBar label="Content" score={categoryScores?.content} color="#3B82F6" />
              <CategoryBar label="Skills" score={categoryScores?.skills} color="#10B981" />
              <CategoryBar label="Format" score={categoryScores?.format} color="#F59E0B" />
              <CategoryBar label="Sections" score={categoryScores?.sections} color="#EF4444" />
              <CategoryBar label="Style" score={categoryScores?.style} color="#6366F1" />
              {!categoryScores && <p className="text-xs text-slate-400">Category scores appear after job analysis.</p>}
            </div>
            {onEditResume && (
              <button
                type="button"
                onClick={onEditResume}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Resume
              </button>
            )}
          </aside>

          {/* Main */}
          <div className="min-w-0 space-y-5 lg:col-span-8">
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-slate-100">
                <Sparkles className="h-5 w-5 text-emerald-600" /> Overview
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Match Score: <span className="font-black text-emerald-600">{score}</span>
              </p>
              {report.overview.summary ? (
                <p className="mt-3 break-words text-xs leading-relaxed text-slate-700 sm:text-sm dark:text-slate-300">{report.overview.summary}</p>
              ) : (
                <p className="mt-3 text-xs text-slate-400">Run a job analysis to see the overview summary.</p>
              )}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {categoryScores && (
                  <div className="flex items-center justify-center">
                    <div className="h-44 w-44"><Radar scores={categoryScores} /></div>
                  </div>
                )}
                <div className="space-y-3">
                  {strengths.length > 0 && (
                    <div className="rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-950/20">
                      <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Highlights</h3>
                      <ul className="mt-1.5 space-y-1.5">
                        {strengths.slice(0, 5).map((h, i) => (
                          <li key={i} className="flex items-start gap-1.5 break-words text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            <span className="min-w-0">{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {improvements.length > 0 && (
                    <div className="rounded-xl bg-amber-50/80 p-3 dark:bg-amber-950/20">
                      <h3 className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" /> Improvements
                      </h3>
                      <ul className="mt-1.5 space-y-1.5">
                        {improvements.slice(0, 5).map((imp, i) => (
                          <li key={i} className="flex items-start gap-1.5 break-words text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                            <span className="font-bold text-amber-600">→</span>
                            <span className="min-w-0">{imp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              {report.breakdown && (
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3 dark:border-slate-800">
                  {[
                    ['Skills', report.breakdown.skills],
                    ['Experience', report.breakdown.experience],
                    ['Responsibilities', report.breakdown.responsibilities],
                    ['Keywords', report.breakdown.keywords],
                    ['Education', report.breakdown.education],
                    ['Projects', report.breakdown.projects],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/50">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="text-base font-black text-slate-900 dark:text-slate-100">{value as number}%</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <SectionCard id="content" icon={<FileText className="h-4 w-4" />} title="Content" open={openSections.content} onToggle={() => toggle('content')}>
              {report.contentScore !== undefined && <p className="text-xs text-slate-500">Content score: <span className="font-black text-slate-800 dark:text-slate-100">{report.contentScore}/100</span></p>}
              {report.keywordsFound.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-emerald-700">Keywords found ({report.keywordsFound.length})</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {report.keywordsFound.map((kw) => (
                      <span key={kw} className="max-w-full break-words rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {report.keywordsMissing.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-rose-700">Keywords missing ({report.keywordsMissing.length})</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {report.keywordsMissing.map((kw) => (
                      <span key={kw} className="max-w-full break-words rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {report.recommendations.length > 0 && (
                <div className="space-y-2">
                  {report.recommendations.slice(0, 6).map((r, i) => (
                    <div key={i} className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="break-words font-semibold text-slate-900 dark:text-slate-100">[{r.priority.toUpperCase()}] {r.text}</p>
                      {r.impact && <p className="mt-1 break-words text-[11px] text-slate-500">{r.impact}</p>}
                    </div>
                  ))}
                </div>
              )}
              {report.contentScore === undefined && report.recommendations.length === 0 && (
                <p className="text-xs text-slate-400">Content findings appear after job analysis.</p>
              )}
            </SectionCard>

            <SectionCard id="skills" icon={<Code2 className="h-4 w-4" />} title="Skills" open={openSections.skills} onToggle={() => toggle('skills')}>
              {(report.matchedRequired.length > 0 || report.missingRequired.length > 0) ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">
                        <th className="px-4 py-2.5">Skill</th>
                        <th className="px-4 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.matchedRequired.map((s) => (
                        <tr key={`m-${s}`}>
                          <td className="max-w-[220px] break-words px-4 py-2 font-semibold">{s}</td>
                          <td className="px-4 py-2 text-right"><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Matched</span></td>
                        </tr>
                      ))}
                      {report.missingRequired.map((s) => (
                        <tr key={`x-${s}`} className="bg-rose-50/40">
                          <td className="max-w-[220px] break-words px-4 py-2 font-semibold">{s}</td>
                          <td className="px-4 py-2 text-right"><span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-700">Missing</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Skill match data appears after job analysis.</p>
              )}
              {(report.matchedPreferred.length > 0 || report.missingPreferred.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {report.matchedPreferred.map((s) => (
                    <span key={`mp-${s}`} className="max-w-full break-words rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{s}</span>
                  ))}
                  {report.missingPreferred.map((s) => (
                    <span key={`xp-${s}`} className="max-w-full break-words rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700">+ {s}</span>
                  ))}
                </div>
              )}
              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <p>Only claim skills you genuinely have. Missing skills can be addressed through learning or honest project work.</p>
              </div>
            </SectionCard>

            <SectionCard id="format" icon={<LayoutTemplate className="h-4 w-4" />} title="Format" open={openSections.format} onToggle={() => toggle('format')}>
              {report.experienceYears ? (
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="font-bold text-slate-500">Required</p>
                    <p className="font-black">{report.experienceYears.required !== null ? `${report.experienceYears.required} yrs` : 'Not specified'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="font-bold text-slate-500">Detected</p>
                    <p className="font-black">{report.experienceYears.detected} yrs</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="font-bold text-slate-500">Level</p>
                    <p className="font-black capitalize">{report.experienceYears.level}</p>
                  </div>
                </div>
              ) : null}
              {report.experienceNote ? <p className="break-words text-xs leading-relaxed text-slate-600 dark:text-slate-400">{report.experienceNote}</p> : null}
              {report.educationMatch && (
                <p className="break-words text-xs text-slate-600 dark:text-slate-400">
                  Education match: <span className="font-bold capitalize">{report.educationMatch.level}</span>
                  {report.educationMatch.detected.length > 0 ? ` (${report.educationMatch.detected.join(', ')})` : ''}
                </p>
              )}
              {!report.experienceYears && !report.educationMatch && (
                <p className="text-xs text-slate-400">Format checks appear after job analysis.</p>
              )}
            </SectionCard>

            <SectionCard id="sections" icon={<FolderCheck className="h-4 w-4" />} title="Sections" open={openSections.sections} onToggle={() => toggle('sections')}>
              {report.presentSections.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.presentSections.map((s) => (
                        <tr key={s.key}>
                          <td className="whitespace-nowrap px-4 py-2.5 font-bold capitalize">{s.title}</td>
                          <td className="px-4 py-2.5 text-emerald-700"><span className="inline-flex items-center gap-1 font-bold"><Award className="h-3 w-3" /> Present</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Section checks appear after resume processing.</p>
              )}
            </SectionCard>

            <SectionCard id="style" icon={<Palette className="h-4 w-4" />} title="Style" open={openSections.style} onToggle={() => toggle('style')}>
              {report.responsibilitiesMatched.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-emerald-700">Responsibilities aligned ({report.responsibilitiesMatched.length})</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {report.responsibilitiesMatched.slice(0, 6).map((r, i) => (
                      <li key={i} className="break-words rounded-xl bg-emerald-50/60 p-2.5 text-xs dark:bg-emerald-950/20">{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.responsibilitiesUnmatched.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-amber-700">To evidence ({report.responsibilitiesUnmatched.length})</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {report.responsibilitiesUnmatched.slice(0, 6).map((r, i) => (
                      <li key={i} className="break-words rounded-xl bg-amber-50/60 p-2.5 text-xs dark:bg-amber-950/20">{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.relevantProjects.length > 0 && (
                <div className="space-y-2">
                  {report.relevantProjects.slice(0, 4).map((p, i) => (
                    <div key={i} className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="break-words font-bold">{p.name}</p>
                      <p className="mt-1 text-[11px] text-emerald-700">{p.relevancePercent}% match{p.relevantTech.length > 0 ? ` · ${p.relevantTech.join(', ')}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
              {report.responsibilitiesMatched.length === 0 && report.responsibilitiesUnmatched.length === 0 && report.relevantProjects.length === 0 && (
                <p className="text-xs text-slate-400">Style alignment appears after job analysis.</p>
              )}
            </SectionCard>

            <SectionCard id="action" icon={<Sparkles className="h-4 w-4" />} title="Action Plan" open={openSections.action} onToggle={() => toggle('action')}>
              {report.recommendations.length > 0 ? (
                <ol className="space-y-2">
                  {report.recommendations.slice(0, 8).map((r, i) => (
                    <li key={i} className="rounded-xl border border-slate-200/70 p-3 text-xs dark:border-slate-700">
                      <p className="break-words font-semibold">Step {i + 1} · [{r.priority.toUpperCase()}] {r.text}</p>
                      {r.impact && <p className="mt-1 break-words text-[11px] text-slate-500">{r.impact}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-slate-400">Recommendations appear after job analysis.</p>
              )}
              {report.keywordsMissing.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-700">Keywords to consider (only where truthful)</p>
                  <p className="mt-1 break-words text-xs text-slate-600">{report.keywordsMissing.slice(0, 12).join(', ')}</p>
                </div>
              )}
              {report.aiSummary && (
                <div className="rounded-xl bg-violet-50/60 p-3 text-xs dark:bg-violet-950/20">
                  <p className="font-bold text-violet-800 dark:text-violet-300">AI insight</p>
                  <p className="mt-1 break-words text-slate-700 dark:text-slate-300">{report.aiSummary}</p>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
