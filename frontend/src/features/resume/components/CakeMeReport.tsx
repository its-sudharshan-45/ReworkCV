// cspell:ignore skillDetail experienceDetail responsibilityDetail keywordDetail projectDetail
import React, { useState } from 'react';

import {
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lightbulb,
  FileText,
  Code2,
  LayoutTemplate,
  FolderCheck,
  Palette,
  Sparkles,
  Download,
  Layers,
  Info,
  FileDown,
  Mail,
  Loader2,
} from 'lucide-react';
import type {
  JobMatchAnalysis,
  ResumeDetail,
} from '@/features/resume/types/resume';
import { Button } from '@/components/ui/button';

interface CakeMeReportProps {
  analysis?: JobMatchAnalysis;
  resume?: ResumeDetail;
  /** The persisted job analysis ID */
  analysisId?: string;
  onDownloadReportPdf?: () => void;
  onGenerateCoverLetter?: () => void;
  isGeneratingCoverLetter?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a display value or a dash placeholder when the value is empty/null. */
function val(v: string | null | undefined): string {
  return v && v.trim() ? v : '—';
}

/** Renders an honest empty-state banner when a report section has no real data. */
function NoDataAvailable({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
      <Info className="h-4 w-4 flex-shrink-0 text-slate-400" />
      <span>{label ?? 'No data available for this section.'}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CakeMeReport({
  analysis,
  resume,
  analysisId,
  onDownloadReportPdf,
  onGenerateCoverLetter,
  isGeneratingCoverLetter,
}: CakeMeReportProps) {
  // ── Structured resume data (may be null if resume was not yet processed) ───
  // The backend stores extractedText and structuredData only after AI processing.
  // We do NOT fall back to any hardcoded candidate information here.
  const structured = resume?.structuredData;

  // StructuredResumeData shape: { sections: ResumeSection[], skills: string[], structuredResume?: StructuredResume }
  // Personal contact info is nested inside structuredResume or raw structuredData JSON.
  // We read it defensively without any fallbacks.
  const rawPersonal = structured as {
    personal?: { name?: string; phone?: string; email?: string; links?: string[] };
    structuredResume?: {
      personal?: { name?: string; phone?: string; email?: string; location?: string };
    };
  } | null;

  const candidateName =
    rawPersonal?.personal?.name ?? rawPersonal?.structuredResume?.personal?.name ?? null;
  const candidatePhone =
    rawPersonal?.personal?.phone ?? rawPersonal?.structuredResume?.personal?.phone ?? null;
  const candidateEmail =
    rawPersonal?.personal?.email ?? rawPersonal?.structuredResume?.personal?.email ?? null;
  const candidateLinks = rawPersonal?.personal?.links ?? [];

  // Match score — real value from job match analysis or resume completeness score
  const score = analysis?.matchScore ?? resume?.score ?? 0;

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const [activeTab, setActiveTab] = useState<
    'all' | 'overview' | 'content' | 'skills' | 'format' | 'sections' | 'style'
  >('all');

  // ── Skills derived from real analysis ─────────────────────────────────────
  const matchedSkills = analysis?.skillDetail?.matchedRequired ?? [];
  const missingSkills = analysis?.skillDetail?.missingRequired ?? [];
  const preferredSkills = analysis?.skillDetail?.matchedPreferred ?? [];
  const missingPreferred = analysis?.skillDetail?.missingPreferred ?? [];

  // ── Sections derived from real structured resume data ─────────────────────
  const resumeSections = structured?.sections ?? [];
  const resumeSkills = structured?.skills ?? [];

  // Helper: find a section by key (ResumeSectionKey)
  function getSection(key: string) {
    return resumeSections.find((s) => s.key === key) ?? null;
  }

  const summarySection = getSection('summary');
  const expSection = getSection('experience');
  const eduSection = getSection('education');
  const skillsSection = getSection('skills');
  const projectsSection = getSection('projects');

  return (
    <div id="resume-analysis-report" className="animate-in fade-in space-y-8 duration-300">
      {/* Top Controls: Tabs, Download Report, and Cover Letter */}
      <div className="no-print flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto py-1">
          {[
            { id: 'all', label: 'All Report', icon: Layers },
            { id: 'overview', label: 'Overview', icon: Sparkles },
            { id: 'content', label: 'Content', icon: FileText },
            { id: 'skills', label: 'Skills', icon: Code2 },
            { id: 'format', label: 'Format', icon: LayoutTemplate },
            { id: 'sections', label: 'Sections', icon: FolderCheck },
            { id: 'style', label: 'Style', icon: Palette },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#16A36A] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onDownloadReportPdf && (
            <Button
              type="button"
              variant="outline"
              onClick={onDownloadReportPdf}
              className="flex cursor-pointer items-center gap-2 rounded-xl border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              <span>Download Report (PDF)</span>
            </Button>
          )}

          {onGenerateCoverLetter && (
            <Button
              type="button"
              onClick={onGenerateCoverLetter}
              disabled={isGeneratingCoverLetter}
              className="shadow-xs flex cursor-pointer items-center gap-2 rounded-xl bg-[#16A36A] px-4 py-2 text-xs font-bold text-white hover:bg-[#138A5A]"
            >
              {isGeneratingCoverLetter ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              <span>Generate Cover Letter</span>
            </Button>
          )}
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="mb-6 hidden border-b border-slate-300 pb-4 print:block">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#114B3E]">
              Rework CV • Resume Intelligence Report
            </h1>
            {candidateName && (
              <p className="mt-1 text-xs text-slate-500">Candidate: {candidateName}</p>
            )}
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-[#16A36A]">Match Score: {score}/100</span>
            <p className="text-[10px] text-slate-400">
              Generated on {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* ================= 1. OVERVIEW ================= */}
      {(activeTab === 'all' || activeTab === 'overview') && (
        <section className="shadow-xs print-avoid-break space-y-6 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              <Sparkles className="h-5 w-5 text-[#007A5A]" />
              Overview
            </h2>
            {score > 0 && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                Match Score: {score}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
            {/* Score Ring */}
            <div className="flex flex-col items-center justify-center border-b border-slate-100 p-4 lg:col-span-4 lg:border-b-0 lg:border-r dark:border-slate-800">
              <div className="relative flex h-36 w-36 items-center justify-center">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    className="stroke-[#007A5A] transition-all duration-1000 ease-out"
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100">
                    {score > 0 ? score : '—'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {analysis ? 'Match Score' : 'ATS Score'}
                  </span>
                </div>
              </div>
              {analysis?.category && (
                <span className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {analysis.category}
                </span>
              )}
            </div>

            {/* Overview Text */}
            <div className="space-y-4 lg:col-span-8">
              {analysis?.overview ? (
                <p className="text-xs font-medium leading-relaxed text-slate-700 sm:text-sm dark:text-slate-300">
                  {analysis.overview}
                </p>
              ) : (
                <NoDataAvailable label="Run an ATS job match analysis to see a detailed overview of your resume." />
              )}

              {(analysis?.strengths && analysis.strengths.length > 0) ||
              (analysis?.recommendations && analysis.recommendations.length > 0) ? (
                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-2 sm:grid-cols-2 dark:border-slate-800">
                  {/* Highlights */}
                  {analysis?.strengths && analysis.strengths.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Highlights
                      </h3>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {analysis.strengths.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-50/60 p-2 dark:bg-emerald-950/20"
                          >
                            <span className="font-bold text-emerald-600">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improvements */}
                  {analysis?.recommendations && analysis.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        Improvements
                      </h3>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {analysis.recommendations.map((r, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-50/60 p-2 dark:bg-amber-950/20"
                          >
                            <span className="font-bold text-amber-600">→</span>
                            <span>{r.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Component Score Breakdown (Single Source of Truth: Backend Weights) */}
          {analysis?.breakdown && (
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  ATS Component Breakdown
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Single source of truth formula
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { name: 'Skills', weight: '40%', score: analysis.breakdown.skills },
                  { name: 'Experience', weight: '20%', score: analysis.breakdown.experience },
                  {
                    name: 'Responsibilities',
                    weight: '15%',
                    score: analysis.breakdown.responsibilities,
                  },
                  { name: 'Projects', weight: '10%', score: analysis.breakdown.projects },
                  { name: 'Keywords', weight: '10%', score: analysis.breakdown.keywords },
                  { name: 'Education', weight: '5%', score: analysis.breakdown.education },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="space-y-1 rounded-2xl border border-slate-200/70 bg-slate-50 p-3 text-center dark:border-slate-700/60 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{item.name}</span>
                      <span>{item.weight}</span>
                    </div>
                    <p
                      className={`text-lg font-black ${
                        item.score >= 80
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : item.score >= 60
                            ? 'text-[#007A5A] dark:text-emerald-300'
                            : item.score >= 40
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {item.score}%
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-[#007A5A] transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ================= 2. CONTENT ================= */}
      {(activeTab === 'all' || activeTab === 'content') && (
        <section className="shadow-xs print-avoid-break space-y-6 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              <FileText className="h-5 w-5 text-[#007A5A]" />
              Content
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Content details derived from your resume text after AI processing.
            </p>
          </div>

          {/* Summary */}
          {summarySection ? (
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Summary
              </h3>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                {summarySection.content}
              </div>
            </div>
          ) : (
            <NoDataAvailable label="Summary section not detected in your resume. Process your resume to extract content." />
          )}

          {/* Experience */}
          {expSection ? (
            <div className="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Experience
              </h3>
              <div className="whitespace-pre-line rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                {expSection.content}
              </div>
            </div>
          ) : null}

          {/* Recommendations from analysis */}
          {analysis?.recommendations && analysis.recommendations.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                AI Recommendations
              </h3>
              <div className="space-y-2 text-xs">
                {analysis.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className={`space-y-1 rounded-2xl border p-3.5 ${
                      rec.priority === 'high'
                        ? 'border-rose-500/20 bg-rose-50/40 dark:bg-rose-950/20'
                        : rec.priority === 'medium'
                          ? 'border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20'
                          : 'border-slate-200/80 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
                    }`}
                  >
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{rec.text}</p>
                    {rec.impact && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{rec.impact}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ================= 3. SKILLS ================= */}
      {(activeTab === 'all' || activeTab === 'skills') && (
        <section className="shadow-xs print-avoid-break space-y-6 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              <Code2 className="h-5 w-5 text-[#007A5A]" />
              Skills
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Skills matched and missing based on the job description analysis.
            </p>
          </div>

          {analysis ? (
            <>
              {/* Summary counts */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/30">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Matched Required
                  </span>
                  <p className="mt-0.5 text-xl font-black text-emerald-700 dark:text-emerald-300">
                    {matchedSkills.length}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200/60 bg-rose-50 p-3 dark:border-rose-800/40 dark:bg-rose-950/30">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">
                    Missing Required
                  </span>
                  <p className="mt-0.5 text-xl font-black text-rose-700 dark:text-rose-300">
                    {missingSkills.length}
                  </p>
                </div>
                <div className="rounded-xl border border-blue-200/60 bg-blue-50 p-3 dark:border-blue-800/40 dark:bg-blue-950/30">
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                    Matched Preferred
                  </span>
                  <p className="mt-0.5 text-xl font-black text-blue-700 dark:text-blue-300">
                    {preferredSkills.length}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200/60 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-950/30">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    Missing Preferred
                  </span>
                  <p className="mt-0.5 text-xl font-black text-amber-700 dark:text-amber-300">
                    {missingPreferred.length}
                  </p>
                </div>
              </div>

              {/* Required Skills Table */}
              {(matchedSkills.length > 0 || missingSkills.length > 0) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Required Skills
                  </h3>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                          <th className="px-4 py-3">Skill</th>
                          <th className="px-4 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800">
                        {matchedSkills.map((skill) => (
                          <tr
                            key={skill}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                          >
                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                              {skill}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> Matched
                              </span>
                            </td>
                          </tr>
                        ))}
                        {missingSkills.map((skill) => (
                          <tr
                            key={skill}
                            className="bg-rose-50/10 hover:bg-rose-50/20 dark:bg-rose-950/5 dark:hover:bg-rose-950/10"
                          >
                            <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                              {skill}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                                <XCircle className="h-3 w-3" /> Missing
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Keyword match detail */}
              {analysis.keywordDetail && (
                <div className="space-y-3 border-t border-slate-100 pt-2 dark:border-slate-800">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Keywords
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {analysis.keywordDetail.found.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          Found ({analysis.keywordDetail.found.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.keywordDetail.found.map((kw) => (
                            <span
                              key={kw}
                              className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {analysis.keywordDetail.missing.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                          Missing ({analysis.keywordDetail.missing.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.keywordDetail.missing.map((kw) => (
                            <span
                              key={kw}
                              className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pro Tip */}
              <div className="flex items-start gap-3 rounded-2xl border border-[#007A5A]/20 bg-[#F7FAF8] p-4 text-xs text-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#007A5A]" />
                <div>
                  <span className="font-bold text-[#007A5A] dark:text-emerald-400">Pro Tip: </span>
                  If a skill doesn't fit easily in your resume, mention it in your cover letter or
                  highlight it during your interview.
                </div>
              </div>
            </>
          ) : resumeSkills.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Skills Detected in Resume
              </h3>
              <div className="flex flex-wrap gap-2">
                {resumeSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
              <NoDataAvailable label="Run an ATS job match analysis to see skill match/gap breakdown against a specific job description." />
            </div>
          ) : (
            <NoDataAvailable label="No skills data available. Process your resume and run an ATS analysis to see skill breakdown." />
          )}
        </section>
      )}

      {/* ================= 4. FORMAT ================= */}
      {(activeTab === 'all' || activeTab === 'format') && (
        <section className="shadow-xs print-avoid-break space-y-6 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              <LayoutTemplate className="h-5 w-5 text-[#007A5A]" />
              Format
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Format analysis checks resume structure for ATS compatibility.
            </p>
          </div>

          {/* Experience match detail (years, level) */}
          {analysis?.experienceDetail ? (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Experience Assessment
              </h3>
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <span className="font-bold text-slate-600 dark:text-slate-400">
                    Required Years
                  </span>
                  <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                    {analysis.experienceDetail.requiredYears != null
                      ? `${analysis.experienceDetail.requiredYears} yrs`
                      : 'Not specified'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <span className="font-bold text-slate-600 dark:text-slate-400">
                    Detected Professional
                  </span>
                  <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                    {analysis.experienceDetail.detectedProfessionalYears} yrs
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <span className="font-bold text-slate-600 dark:text-slate-400">Match Level</span>
                  <p
                    className={`mt-0.5 font-bold capitalize ${
                      analysis.experienceDetail.matchLevel === 'strong'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : analysis.experienceDetail.matchLevel === 'partial'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {analysis.experienceDetail.matchLevel}
                  </p>
                </div>
              </div>
              {analysis.experienceDetail.note && (
                <div className="flex items-start gap-2 rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#007A5A]" />
                  <p>{analysis.experienceDetail.note}</p>
                </div>
              )}
            </div>
          ) : (
            <NoDataAvailable label="Format analysis requires an ATS job match to be run. Experience details will appear after analysis." />
          )}
        </section>
      )}

      {/* ================= 5. SECTIONS ================= */}
      {(activeTab === 'all' || activeTab === 'sections') && (
        <section className="shadow-xs print-avoid-break space-y-6 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              <FolderCheck className="h-5 w-5 text-[#007A5A]" />
              Sections
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Sections detected in your resume after AI processing.
            </p>
          </div>

          {resumeSections.length > 0 || candidateName ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Contact row — only if extracted by NER */}
                  {candidateName && (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="w-1/4 whitespace-nowrap px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        Name
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {val(candidateName)}
                      </td>
                    </tr>
                  )}
                  {candidatePhone && (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        Phone
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {val(candidatePhone)}
                      </td>
                    </tr>
                  )}
                  {candidateEmail && (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        Email
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {val(candidateEmail)}
                      </td>
                    </tr>
                  )}
                  {candidateLinks.length > 0 && (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        Links
                      </td>
                      <td className="break-all px-4 py-3 text-slate-600 dark:text-slate-300">
                        {candidateLinks.join(', ')}
                      </td>
                    </tr>
                  )}
                  {/* Detected sections */}
                  {resumeSections.map((section) => (
                    <tr
                      key={section.key}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-bold capitalize text-slate-800 dark:text-slate-200">
                        {section.title}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                          <Award className="h-3 w-3" /> Present
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Education match from analysis */}
                  {analysis?.educationDetail && (
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        Education Match
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                        {analysis.educationDetail.matchLevel}
                        {analysis.educationDetail.detected.length > 0 && (
                          <span className="ml-2 text-slate-400">
                            ({analysis.educationDetail.detected.join(', ')})
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <NoDataAvailable label="No section data available. Process your resume to extract section information." />
          )}
        </section>
      )}

      {/* ================= 6. STYLE ================= */}
      {(activeTab === 'all' || activeTab === 'style') && (
        <section className="shadow-xs print-avoid-break space-y-6 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-slate-100">
              <Palette className="h-5 w-5 text-[#007A5A]" />
              Style
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Responsibility and project alignment with the job description.
            </p>
          </div>

          {/* Responsibility match */}
          {analysis?.responsibilityDetail && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Responsibility Alignment
              </h3>
              {analysis.responsibilityDetail.matched.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Matched ({analysis.responsibilityDetail.matched.length})
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.responsibilityDetail.matched.map((resp, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-50/60 p-2.5 text-xs dark:bg-emerald-950/20"
                      >
                        <span className="flex-shrink-0 font-bold text-emerald-600">✓</span>
                        <span className="text-slate-700 dark:text-slate-300">{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.responsibilityDetail.unmatched.length > 0 && (
                <div className="pt-2">
                  <p className="mb-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    Not Matched ({analysis.responsibilityDetail.unmatched.length})
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.responsibilityDetail.unmatched.map((resp, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-50/40 p-2.5 text-xs dark:bg-amber-950/10"
                      >
                        <span className="flex-shrink-0 font-bold text-amber-600">→</span>
                        <span className="text-slate-700 dark:text-slate-300">{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Project relevance */}
          {analysis?.projectDetail && analysis.projectDetail.relevantProjects.length > 0 ? (
            <div className="space-y-3 border-t border-slate-100 pt-2 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Relevant Projects
              </h3>
              <div className="space-y-2">
                {analysis.projectDetail.relevantProjects.map((proj, idx) => (
                  <div
                    key={idx}
                    className="space-y-1.5 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <p className="font-bold text-slate-900 dark:text-slate-100">{proj.name}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {proj.relevantTech.map((tech) => (
                          <span
                            key={tech}
                            className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                      <span className="ml-2 flex-shrink-0 text-[11px] font-bold text-[#007A5A] dark:text-emerald-400">
                        {proj.relevancePercent}% match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !analysis?.responsibilityDetail && (
              <NoDataAvailable label="Style and project alignment data requires an ATS job match analysis." />
            )
          )}

          {/* Projects section from resume (if no analysis) */}
          {!analysis && projectsSection && (
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Projects (from Resume)
              </h3>
              <div className="whitespace-pre-line rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                {projectsSection.content}
              </div>
            </div>
          )}

          {!analysis && !projectsSection && (
            <NoDataAvailable label="Style analysis requires an ATS job match. Projects section not detected in resume." />
          )}
        </section>
      )}
    </div>
  );
}
