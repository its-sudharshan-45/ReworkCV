/**
 * DUMMY_REPORT_PREVIEW — static visual preview for the upload page ONLY.
 *
 * This is intentionally hardcoded demo content so first-time users see what
 * a report looks like. It must NEVER be connected to real data:
 * - Do NOT pass it to buildReportData() or any scoring logic.
 * - Do NOT call the analysis API from here.
 * - Do NOT read analysis state, route params, or persisted results.
 * - Do NOT navigate with it or render it on the dedicated report route.
 * - All controls below are intentionally non-interactive (static mock).
 * - Typography uses only the project's existing fonts (Inter + Outfit).
 */

import { BarChart3, PenLine, Sparkles } from 'lucide-react';

// Static dummy values — never derived from user/resume/analysis data.
export const DUMMY_REPORT_PREVIEW = {
  jobRole: 'Backend Engineer',
  jobCompany: 'Google',
  overallScore: 92,
  issuesToFix: 10,
  categories: [
    { label: 'Content', issues: 3 },
    { label: 'Skills', issues: 2 },
    { label: 'Format', issues: 4 },
    { label: 'Sections', issues: 1 },
    { label: 'Style', issues: 0 },
  ],
  analysisEyebrow: 'Resume Analysis',
  analysisTitle: 'Your Application Signals',
  analysisSummary:
    'Your resume shows strong alignment with the Backend Engineer role at Google. You have solid technical experience and relevant skills, with a few areas to improve, especially around measurable impact and keyword coverage.',
  signals: [
    { label: 'Technical', status: 'Strong', color: '#14B8A6' },
    { label: 'Experience', status: 'Good', color: '#3B82F6' },
    { label: 'Impact', status: 'Needs Work', color: '#EF4444' },
    { label: 'Positioning', status: 'Needs Work', color: '#F59E0B' },
    { label: 'ATS Language', status: 'Good', color: '#8B5CF6' },
  ],
  keyInsights: [
    { tone: 'good' as const, text: 'Strong technical skills in backend technologies such as Node.js, AWS, and SQL/NoSQL databases.' },
    { tone: 'good' as const, text: 'Extensive experience working with AWS and building scalable microservices architecture.' },
    { tone: 'warn' as const, text: 'Limited measurable impact in experience section.' },
    { tone: 'warn' as const, text: 'Some role-specific keywords are missing from the resume.' },
  ],
  contentScore: 88,
  contentHeading: "Almost there! Let's refine your content to make it more impactful and error-free.",
  potentialNote: 'With a few targeted changes, your resume can boost your chances.',
  measurableResults: 3,
  spellingGrammar: 5,
  suggestedRewrite: 'Add specific, measurable achievements to highlight the impact of your work.',
} as const;

// Static hexagon signal-map geometry (purely decorative demo visualization).
const SIGNAL_CENTER = { x: 100, y: 105 };
const SIGNAL_RADIUS = 62;
const SIGNAL_ANGLES = [-90, -18, 54, 126, 198];
const SIGNAL_DATA = [0.8, 0.7, 0.45, 0.5, 0.75];

function polar(angleDeg: number, fraction: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: SIGNAL_CENTER.x + SIGNAL_RADIUS * fraction * Math.cos(rad),
    y: SIGNAL_CENTER.y + SIGNAL_RADIUS * fraction * Math.sin(rad),
  };
}

function hexPoints(fraction: number) {
  return SIGNAL_ANGLES.map((a) => {
    const p = polar(a, fraction);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ');
}

function DummySignalMap() {
  const d = DUMMY_REPORT_PREVIEW;
  const dataPoints = SIGNAL_ANGLES.map((a, i) => polar(a, SIGNAL_DATA[i]));
  const labelPos = [
    { x: 100, y: 24 },
    { x: 172, y: 84 },
    { x: 152, y: 176 },
    { x: 48, y: 176 },
    { x: 28, y: 84 },
  ];
  return (
    <svg viewBox="0 0 200 196" className="h-full w-full" aria-hidden="true">
      {[0.33, 0.66, 1].map((level) => (
        <polygon key={level} points={hexPoints(level)} fill="none" stroke="#E9E4F5" strokeWidth="1" />
      ))}
      {SIGNAL_ANGLES.map((a) => {
        const end = polar(a, 1);
        return (
          <line
            key={a}
            x1={SIGNAL_CENTER.x}
            y1={SIGNAL_CENTER.y}
            x2={end.x}
            y2={end.y}
            stroke="#EFEAFB"
            strokeWidth="1"
          />
        );
      })}
      <polygon
        points={dataPoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
        fill="rgba(124,58,237,0.16)"
        stroke="#7C3AED"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={d.signals[i].color} stroke="white" strokeWidth="1.5" />
      ))}
      {/* Center overall badge */}
      <polygon points={hexPoints(0.26)} fill="#7C3AED" />
      <text x={SIGNAL_CENTER.x} y={SIGNAL_CENTER.y - 1} textAnchor="middle" fontSize="7" fontWeight="600" fill="#DDD0FA">
        Overall
      </text>
      <text x={SIGNAL_CENTER.x} y={SIGNAL_CENTER.y + 10} textAnchor="middle" fontSize="11" fontWeight="800" fill="#FFFFFF">
        92
      </text>
      {d.signals.map((s, i) => (
        <g key={s.label}>
          <circle cx={labelPos[i].x} cy={labelPos[i].y - 8} r="3" fill={s.color} />
          <text x={labelPos[i].x} y={labelPos[i].y + 2} textAnchor="middle" fontSize="8" fontWeight="700" fill="#334155">
            {s.label}
          </text>
          <text x={labelPos[i].x} y={labelPos[i].y + 12} textAnchor="middle" fontSize="7" fontWeight="600" fill={s.color}>
            {s.status}
          </text>
        </g>
      ))}
    </svg>
  );
}

function DummyScoreRing({ score }: { score: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center" aria-hidden="true">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={radius} fill="none" stroke="#EDE9FE" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke="#7C3AED"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-2xl font-extrabold text-[#1E1235]">{score}</span>
        <span className="text-[10px] font-semibold text-slate-400">/100</span>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.1.1c2.1-2 3.9-4.9 3.9-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.4 7.5 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.8-2.5z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.4 6.7l3.8 3c1-2.9 3.7-5 6.8-5z"
      />
    </svg>
  );
}

const DISPLAY_FONT = { fontFamily: 'Outfit, Inter, sans-serif' };

export function DummyReportPreview() {
  const d = DUMMY_REPORT_PREVIEW;
  return (
    <section
      aria-label="Sample report preview with demo data"
      className="w-full overflow-hidden rounded-2xl bg-white font-sans"
      style={{ border: '1px solid #EDE4FF', boxShadow: '0 20px 40px -15px rgba(124,58,237,0.12)' }}
    >
      {/* Sample banner (static mock) */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-[#FCFDFD] px-4 py-2.5 sm:px-5">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight text-slate-900">
            Rework<span className="text-[#7C3AED]">CV</span>
          </span>
          <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-500">
            Sample report
          </span>
        </div>
        <p className="shrink-0 text-[11px] font-medium text-slate-400">
          Your personalized report appears here after analysis
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 p-4 sm:p-5 md:grid-cols-12">
        {/* Report sidebar (static mock) */}
        <div className="flex flex-col gap-4 md:col-span-4 md:border-r md:border-slate-100 md:pr-4">
          <div>
            <p className="text-[13px] font-bold text-slate-900">{d.jobRole}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <GoogleMark />
              {d.jobCompany}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <DummyScoreRing score={d.overallScore} />
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#FEF2F2] px-2 py-1 text-[10px] font-bold leading-tight text-[#DC2626]">
                <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
                  <path d="M12 3 1.8 20.2h20.4L12 3zm1 13.5h-2v2h2v-2zm0-7h-2v5h2v-5z" />
                </svg>
                <span>
                  {d.issuesToFix} issues
                  <br />
                  to fix
                </span>
              </span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#F97316]" style={{ width: '45%' }} />
              </div>
            </div>
          </div>

          <ul className="space-y-1 text-xs">
            <li className="flex items-center gap-2 rounded-lg bg-[#F5F1FF] px-2.5 py-2 font-bold text-[#1E1235]">
              <span className="text-[#7C3AED]">◉</span> Overview
            </li>
            {d.categories.map((c) => (
              <li key={c.label} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-600">
                <span className="text-slate-400">▤</span>
                <span className="font-semibold">{c.label}</span>
                <span className="ml-auto text-[11px] text-slate-400">
                  {c.issues === 0 ? (
                    <span className="font-semibold text-emerald-600">✓ Complete</span>
                  ) : (
                    <span>
                      {c.issues} {c.issues === 1 ? 'issue' : 'issues'}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Main report preview (static mock) */}
        <div className="flex min-w-0 flex-col gap-4 md:col-span-8">
          <div className="relative">
            <p className="text-xs font-semibold text-slate-700">{d.analysisEyebrow}</p>
            <h4 className="mt-0.5 text-xl font-extrabold tracking-tight text-[#1E1235] sm:text-2xl" style={DISPLAY_FONT}>
              {d.analysisTitle}
            </h4>
            <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-slate-500">{d.analysisSummary}</p>
            <div className="pointer-events-none absolute right-0 top-0 hidden text-right sm:block" aria-hidden="true">
              <p className="rotate-3 text-[11px] font-bold italic leading-tight text-[#7C3AED]">
                Better signals
                <br />→ More opportunities
              </p>
              <svg viewBox="0 0 60 30" className="ml-auto h-6 w-14 text-[#7C3AED]">
                <path d="M5 5 C 25 5, 45 8, 52 24 M46 18 L52 25 L44 26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-slate-800">Signal Map</p>
              <p className="text-[10px] text-slate-400">How your resume performs across key areas</p>
              <div className="mx-auto mt-1 h-44 w-full max-w-[220px]">
                <DummySignalMap />
              </div>
            </div>
            <div className="rounded-xl bg-[#F6F2FF] p-3.5">
              <p className="text-xs font-bold text-slate-800">Key Insights</p>
              <ul className="mt-2 space-y-2 text-[10.5px] leading-snug text-slate-600">
                {d.keyInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    {insight.tone === 'good' ? (
                      <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                        ✓
                      </span>
                    ) : (
                      <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                        !
                      </span>
                    )}
                    <span>{insight.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#7C3AED] text-[9px] font-bold text-white">
                  C
                </span>
                Content Analysis
              </p>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                Content Score: {d.contentScore}/100
              </span>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-700">{d.contentHeading}</p>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr]">
              <div className="rounded-lg bg-[#F6F2FF] p-2.5 text-[10px] text-slate-500">
                <p className="flex items-center gap-1 font-bold text-[#7C3AED]">
                  <Sparkles className="h-3 w-3" /> Great potential!
                </p>
                <p className="mt-0.5 leading-snug">{d.potentialNote}</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white p-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <BarChart3 className="h-3.5 w-3.5" />
                </span>
                <p className="text-[10px] leading-tight text-slate-500">
                  Measurable Results
                  <br />
                  <span className="text-xs font-extrabold text-slate-800">{d.measurableResults}</span>{' '}
                  findings
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white p-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                  <PenLine className="h-3.5 w-3.5" />
                </span>
                <p className="text-[10px] leading-tight text-slate-500">
                  Spelling &amp; Grammar
                  <br />
                  <span className="text-xs font-extrabold text-slate-800">{d.spellingGrammar}</span>{' '}
                  issues
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#F6F2FF] p-2.5">
              <p className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-600">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#7C3AED]" />
                <span>
                  <span className="font-bold">Suggested Rewrite: </span>
                  {d.suggestedRewrite}
                </span>
              </p>
              <span className="shrink-0 text-sm font-bold text-[#7C3AED]">›</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
