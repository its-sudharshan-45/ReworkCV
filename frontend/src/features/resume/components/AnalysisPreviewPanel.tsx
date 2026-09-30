import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Mail, Download, Loader2, RefreshCw } from 'lucide-react';
import type { JobMatchAnalysis, ResumeDetail } from '@/features/resume/types/resume';

interface AnalysisPreviewPanelProps {
  analysis?: JobMatchAnalysis | null;
  resume?: ResumeDetail | null;
  analysisId?: string | null;
  isGeneratingCoverLetter?: boolean;
  onDownloadReportPdf?: () => void;
  onGenerateCoverLetter?: () => void;
  onNewScan?: () => void;
}


// ── Radar SVG ─────────────────────────────────────────────────────────────────
function RadarChart({
  scores,
}: {
  scores: { content: number; skills: number; format: number; sections: number; style: number };
}) {
  const cx = 80;
  const cy = 80;
  const r = 58;

  const axes = [
    { angle: -90, label: 'Content', key: 'content' as const },
    { angle: -18, label: 'Format', key: 'format' as const },
    { angle: 54, label: 'Style', key: 'style' as const },
    { angle: 126, label: 'Sections', key: 'sections' as const },
    { angle: 198, label: 'Skills', key: 'skills' as const },
  ];

  function toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }

  function point(angle: number, value: number) {
    const v = Math.max(0, Math.min(100, value)) / 100;
    return { x: cx + r * v * Math.cos(toRad(angle)), y: cy + r * v * Math.sin(toRad(angle)) };
  }

  const dataPoints = axes.map((a) => point(a.angle, scores[a.key]));
  const polygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const dotColors = ['#6D28D9', '#F59E0B', '#6366F1', '#EF4444', '#10B981'];

  return (
    <svg viewBox="0 0 160 160" className="w-full h-full" aria-label="Resume metrics radar chart">
      {gridLevels.map((level, li) => {
        const pts = axes.map((a) => point(a.angle, level * 100));
        return (
          <polygon
            key={li}
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="0.8"
            strokeDasharray={li === 1 ? '2,2' : undefined}
          />
        );
      })}
      {axes.map((a, i) => {
        const end = point(a.angle, 100);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#E2E8F0" strokeWidth="0.8" />;
      })}
      <polygon
        points={polygon}
        fill="rgba(124,58,237,0.18)"
        stroke="#7C3AED"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={dotColors[i]} stroke="white" strokeWidth="1" />
      ))}
      {axes.map((a, i) => {
        const lp = point(a.angle, 125);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="7.5" fontWeight="600" fill="#64748B">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#7C3AED' : score >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 70 70" className="w-16 h-16 -rotate-90">
        <circle cx="35" cy="35" r={radius} fill="none" stroke="#EDE9FE" strokeWidth="5" />
        <circle
          cx="35" cy="35" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <span className="absolute text-base font-extrabold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── MetricBar ──────────────────────────────────────────────────────────────────
function MetricBar({ label, color, issues, complete, score }: {
  label: string; color: string; issues?: number; complete?: boolean; score?: number;
}) {
  const width = score !== undefined ? `${score}%` : issues !== undefined ? `${Math.max(10, 100 - issues * 15)}%` : '80%';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-800">{label}</span>
        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width, backgroundColor: color }} />
        </div>
      </div>
      {complete ? (
        <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} />
          </svg>
          Complete
        </p>
      ) : (
        <p className="text-[11px] text-slate-400">{issues} {issues === 1 ? 'issue' : 'issues'}</p>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyPreview() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[380px] text-center px-8 py-10 space-y-4">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#F3E8FF,#EDE4FF)' }}>
        <svg className="w-10 h-10 text-[#7C3AED]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
        </svg>
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-800">Your Report Will Appear Here</h3>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed max-w-xs mx-auto">
          Upload your resume and add a job description, then click{' '}
          <span className="font-semibold text-[#7C3AED]">Analyze My Resume</span> to see your ATS score, skill gaps, and improvements.
        </p>
      </div>
      <div className="w-full max-w-xs mt-2 space-y-3 opacity-25 pointer-events-none">
        {['Content', 'Skills', 'Format', 'Sections', 'Style'].map((l) => (
          <div key={l} className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">{l}</span>
            <div className="w-24 h-1.5 bg-slate-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function AnalysisPreviewPanel({
  analysis,
  resume,
  isGeneratingCoverLetter,
  onDownloadReportPdf,
  onGenerateCoverLetter,
  onNewScan,
}: AnalysisPreviewPanelProps) {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  const score = analysis?.matchScore ?? resume?.score ?? 0;
  const hasData = !!(analysis || (resume && (resume.score ?? 0) > 0));

  // Real breakdown scores from JobMatchBreakdown (each 0-100)
  const bd = analysis?.breakdown;
  const skillsScore: number = bd?.skills ?? (analysis ? 70 : 0);
  const experienceScore: number = bd?.experience ?? (analysis ? 75 : 0);
  const keywordsScore: number = bd?.keywords ?? (analysis ? 65 : 0);
  const responsibilityScore: number = bd?.responsibilities ?? (analysis ? 72 : 0);
  const educationScore: number = bd?.education ?? (analysis ? 80 : 0);

  // Compute "issues" proxy (lower score = more issues, max ~5)
  const contentIssues = analysis ? Math.round((1 - keywordsScore / 100) * 5) : 0;
  const skillsIssues = analysis ? analysis.missingRequiredSkills.length : 0;
  const formatIssues = analysis ? Math.round((1 - responsibilityScore / 100) * 4) : 0;
  const sectionsIssues = analysis ? Math.round((1 - educationScore / 100) * 2) : 0;
  const styleComplete = experienceScore >= 70;
  const totalIssues = contentIssues + skillsIssues + formatIssues + sectionsIssues;

  const strengths: string[] =
    analysis?.strengths && analysis.strengths.length > 0
      ? analysis.strengths
      : [
          'Demonstrates proficiency in backend technologies such as Node.js, AWS, and SQL/NoSQL databases.',
          'Extensive experience working with AWS and building scalable microservices architecture.',
        ];
  const improvements: string[] =
    analysis?.recommendations && analysis.recommendations.length > 0
      ? analysis.recommendations.map((r) => r.text)
      : [
          'Add measurable results such as system uptime improvements or performance metrics to demonstrate the impact of your work.',
        ];
  const jobTitle = resume?.originalFilename || 'Backend Engineer / Google';

  const radarScores = {
    content: keywordsScore,
    skills: skillsScore,
    format: responsibilityScore,
    sections: educationScore,
    style: experienceScore,
  };

  const steps = [
    { id: 1 as const, label: 'Report', mail: false },
    { id: 2 as const, label: 'Resume', mail: false },
    { id: 3 as const, label: 'Cover Letter', mail: true },
  ];


  return (
    <div className="w-full bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #EDE4FF', boxShadow: '0 20px 40px -15px rgba(124,58,237,0.12)' }}>
      {/* Nav header */}
      <div className="border-b border-slate-100 bg-[#FCFDFD] px-4 sm:px-5 py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <img src="/logo.png" alt="ReworkCV Logo" className="w-5 h-5 object-contain" />
          <span className="font-bold text-sm tracking-tight text-slate-900">Rework<span className="text-[#7C3AED]">CV</span></span>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold shrink-0">
          {steps.map((step) => (
            <button key={step.id} type="button" onClick={() => setActiveStep(step.id)}
              className={`flex items-center gap-1 pb-1.5 pt-1 border-b-2 transition-colors ${activeStep === step.id ? 'text-[#7C3AED] border-[#7C3AED]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
            >
              <span className="text-[11px] text-slate-500">Step {step.id}</span>
              {step.mail ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onNewScan && (
            <button
              type="button"
              onClick={onNewScan}
              className="px-3 py-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-full shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              New Scan
            </button>
          )}
          {onDownloadReportPdf && hasData && (
            <button
              type="button"
              onClick={onDownloadReportPdf}
              className="p-1.5 text-slate-400 hover:text-[#7C3AED] rounded-lg hover:bg-[#F3E8FF] transition"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-center gap-1.5 pl-1 select-none">
            <div className="w-5 h-5 rounded-full bg-[#EA580C] text-white flex items-center justify-center text-[10px] font-bold">
              E
            </div>
            <span className="text-xs font-semibold text-slate-700 hidden sm:inline">Emily</span>
            <span className="text-[10px] text-slate-400">▾</span>
          </div>
        </div>
      </div>

      {/* Body */}
      {!hasData ? (
        <EmptyPreview />
      ) : (
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left panel */}
          <div className="md:col-span-4 md:border-r border-slate-100 md:pr-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 truncate pr-2">{jobTitle}</h3>
                <button type="button" onClick={() => navigate('/history')} className="text-slate-400 hover:text-[#7C3AED] transition shrink-0" title="View history">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <ScoreRing score={score} />
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    <span className="text-[#F97316] font-bold">{totalIssues}</span> issues to fix
                  </p>
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-[#F97316] h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (totalIssues / 12) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                <MetricBar label="Content" color="#3B82F6" issues={contentIssues} score={radarScores.content} />
                <MetricBar label="Skills" color="#10B981" issues={skillsIssues} score={radarScores.skills} />
                <MetricBar label="Format" color="#F59E0B" issues={formatIssues} score={radarScores.format} />
                <MetricBar label="Sections" color="#EF4444" issues={sectionsIssues} score={radarScores.sections} />
                <MetricBar label="Style" color="#6366F1" complete={styleComplete} score={radarScores.style} />
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button type="button" onClick={() => setActiveStep(2)} className="w-full py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm">
                <Pencil className="w-3.5 h-3.5" /> Edit Resume
              </button>
              {onGenerateCoverLetter && (
                <button type="button" onClick={onGenerateCoverLetter} disabled={isGeneratingCoverLetter} className="w-full py-2 bg-white border border-[#7C3AED]/30 text-[#7C3AED] font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#F3E8FF] transition disabled:opacity-60">
                  {isGeneratingCoverLetter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {isGeneratingCoverLetter ? 'Generating…' : 'Cover Letter'}
                </button>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="md:col-span-8 flex flex-col gap-4">
            {/* STEP 1: REPORT VIEW */}
            {activeStep === 1 && (
              <>
                <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Overview</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Match Score: <span className="font-bold text-[#7C3AED]">{score}</span></p>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: score >= 80 ? '#EDE9FE' : score >= 60 ? '#FEF3C7' : '#FEE2E2', color: score >= 80 ? '#7C3AED' : score >= 60 ? '#92400E' : '#B91C1C' }}>
                    {score >= 80 ? 'Strong Match' : score >= 60 ? 'Good Match' : 'Needs Work'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-5 flex items-center justify-center p-1">
                    <div className="w-40 h-40">
                      <RadarChart scores={radarScores} />
                    </div>
                  </div>

                  <div className="sm:col-span-7 space-y-4">
                    {strengths.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-slate-800">Highlights</span>
                        <ul className="mt-1.5 space-y-1.5 text-[11px] text-slate-600 leading-snug">
                          {strengths.slice(0, 3).map((h, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-emerald-500 shrink-0">✓</span> <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {improvements.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-amber-700">Improvements</span>
                        <ul className="mt-1 space-y-1 text-[11px] text-slate-600 leading-snug">
                          {improvements.slice(0, 2).map((imp, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-amber-500 shrink-0">●</span> <span>{imp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {strengths.length === 0 && improvements.length === 0 && (
                      <p className="text-[11px] text-slate-400 italic">Highlights and improvements will appear after analysis.</p>
                    )}
                  </div>
                </div>

                {contentIssues > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
                      <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">≡</div>
                      <span>Content</span>
                    </div>
                    <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/40 rounded-xl p-3 border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h5 className="text-xs font-bold text-slate-800">Almost there! Let's refine your content to make it more impactful and error-free.</h5>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <div className="bg-white px-2.5 py-1 rounded shadow-xs text-[10px] text-slate-600 font-medium">
                            Measurable Results: <span className="font-bold text-amber-600">{contentIssues || 3}</span>
                          </div>
                          <div className="bg-white px-2.5 py-1 rounded shadow-xs text-[10px] text-slate-600 font-medium">
                            Spelling &amp; Grammar: <span className="font-bold text-amber-600">5</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 w-12 h-8 border border-emerald-400 bg-white rounded-md flex items-center justify-center shadow-xs">
                        <span className="text-emerald-600 font-bold text-xs">✓ {score || 92}</span>
                      </div>
                    </div>
                    <div className="mt-2.5 bg-[#FFFBEB] rounded-lg p-2.5 border border-[#FDE68A] flex items-start gap-2">
                      <span className="text-amber-500 text-xs font-bold shrink-0 mt-0.5">!</span>
                      <p className="text-[11px] text-slate-700">
                        <span className="font-bold text-slate-800">Measurable Results: </span>
                        {improvements[0] || 'Add specific, measurable achievements to highlight the impact of your work.'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* STEP 2: RESUME BREAKDOWN VIEW */}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Resume &amp; Skill Breakdown</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Skills and requirements matched against the job description</p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#7C3AED] bg-[#EDE9FE] px-2.5 py-1 rounded-full">
                    {analysis?.matchedSkills.length ?? 0} Matched
                  </span>
                </div>

                {/* Matched Skills */}
                <div>
                  <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <span className="text-emerald-600 font-extrabold">✓</span> Matched Skills &amp; Keywords
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis?.matchedSkills ?? []).length > 0 ? (
                      analysis?.matchedSkills.map((sk, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {sk}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">No direct keyword matches found.</span>
                    )}
                  </div>
                </div>

                {/* Missing Skills */}
                {(analysis?.missingRequiredSkills ?? []).length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                      <span className="text-amber-600 font-extrabold">!</span> Missing Required Skills
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis?.missingRequiredSkills.map((sk, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          + {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Resume Snippet */}
                {resume?.extractedText && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-800">Parsed Text Preview</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (resume.extractedText) {
                            navigator.clipboard.writeText(resume.extractedText);
                          }
                        }}
                        className="text-[11px] text-[#7C3AED] hover:underline font-semibold"
                      >
                        Copy Text
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-600 font-mono leading-relaxed">
                      {resume.extractedText.slice(0, 1000)}
                      {resume.extractedText.length > 1000 ? '…' : ''}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: COVER LETTER VIEW */}
            {activeStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Tailored Cover Letter</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Personalized to the job description and your verified strengths</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-[#F5F3FF] to-white rounded-xl p-4 border border-[#DDD6FE] text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#EDE9FE] flex items-center justify-center text-[#7C3AED]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">Generate an ATS-Optimized Cover Letter</h5>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1 leading-relaxed">
                      Uses your resume fit analysis and the target job description to create a persuasive, custom letter tailored for hiring managers.
                    </p>
                  </div>
                  {onGenerateCoverLetter && (
                    <button
                      type="button"
                      onClick={onGenerateCoverLetter}
                      disabled={isGeneratingCoverLetter}
                      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100 cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)' }}
                    >
                      {isGeneratingCoverLetter ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Generating Cover Letter…</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          <span>Generate Cover Letter Now</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>View all your saved cover letters anytime</span>
                  <button
                    type="button"
                    onClick={() => navigate('/cover-letters')}
                    className="font-semibold text-[#7C3AED] hover:underline"
                  >
                    Go to Cover Letters →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
