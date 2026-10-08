import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Rocket, Sparkles } from 'lucide-react';

/* ---------- scroll reveal + count-up helpers ---------- */

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function useCountUp(target: number, start: boolean, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const begin = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - begin) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, target, duration]);
  return value;
}

/* ---------- compact benchmark card ---------- */

const KEYWORD_CHIPS = ['Distributed Systems', 'Kubernetes', 'Go / Rust', 'Event Sourcing'];

const BARS = [
  { label: 'Action Impact', pct: 96 },
  { label: 'Keyword Relevance', pct: 91 },
];

function MatchDonut({ score, animate }: { score: number; animate: boolean }) {
  const value = useCountUp(score, animate);
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, value) / 100) * circumference;
  return (
    <div
      className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center"
      role="img"
      aria-label={`Job match score ${score} out of 100`}
    >
      <svg className="h-full w-full -rotate-90" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={radius} strokeWidth="6.5" fill="transparent" className="stroke-[#E4E0F5]" />
        <circle
          cx="34"
          cy="34"
          r={radius}
          strokeWidth="6.5"
          fill="transparent"
          stroke="#5B21B6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-[1200ms] ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-[19px] font-extrabold text-[#1E1235] tabular-nums">{value}</span>
        <span className="text-[7.5px] font-bold tracking-widest text-slate-400">MATCH</span>
      </div>
    </div>
  );
}

function CandidateAnalysisCard() {
  const { ref, visible } = useInView<HTMLDivElement>(0.25);
  const impact = useCountUp(96, visible);
  const relevance = useCountUp(91, visible);
  const uplift = useCountUp(14, visible);
  const counts = [impact, relevance];

  return (
    <div
      ref={ref}
      className={`mx-auto w-full max-w-[540px] rounded-[22px] border border-slate-200/60 bg-white p-4 sm:p-5 shadow-[0_18px_55px_rgba(30,18,53,0.10)] transition-all duration-700 motion-reduce:transition-none hover:shadow-[0_24px_65px_rgba(109,40,217,0.16)] motion-safe:hover:-translate-y-1.5 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {/* File header */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E07856]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E8A15C]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#C4B5FD]" />
        </span>
        <p className="truncate text-[12px] font-medium text-slate-500">Candidate_Analysis_v3.pdf</p>
        <span className="ml-auto shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[10.5px] font-bold text-slate-500">
          Sample output
        </span>
      </div>

      {/* Score + diagnostics */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_2px_10px_rgba(30,18,53,0.05)]">
          <MatchDonut score={94} animate={visible} />
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold tracking-tight text-slate-900">Job Match Score</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Target: Staff Systems Architect
            </p>
            <p className="text-[11px] font-bold text-[#2563EB]">Top 5% of Applicants</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_2px_10px_rgba(30,18,53,0.05)]">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-extrabold text-slate-900">Diagnostic Dimensions</p>
            <span className="text-[10.5px] font-semibold text-slate-400">Optimal</span>
          </div>
          <div className="mt-2 space-y-2">
            {BARS.map((bar, i) => (
              <div key={bar.label}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-500">{bar.label}</span>
                  <span className="font-bold text-slate-700 tabular-nums">{counts[i]}%</span>
                </div>
                <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#5B21B6] transition-all duration-1000 ease-out motion-reduce:transition-none"
                    style={{ width: visible ? `${bar.pct}%` : '0%', transitionDelay: `${200 + i * 150}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-slate-400">Formatting &amp; readability verified</p>
        </div>
      </div>

      {/* Keywords */}
      <p className="mt-3.5 text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
        Role Keyword Matching
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {KEYWORD_CHIPS.map((chip, i) => (
          <span
            key={chip}
            className={`inline-flex cursor-default items-center gap-1 rounded-full bg-[#F5F3FF] border border-purple-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-all duration-500 motion-safe:hover:bg-[#EDE9FE] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-sm ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
            style={{ transitionDelay: `${300 + i * 80}ms` }}
          >
            <Check className="h-3 w-3 text-[#6D28D9]" strokeWidth={3} /> {chip}
          </span>
        ))}
        <span className="inline-flex cursor-default items-center rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
          +3 suggested
        </span>
      </div>

      {/* AI enhancement */}
      <div
        className={`mt-3 rounded-2xl bg-[#F5F3FF] p-3.5 transition-all duration-500 motion-safe:hover:bg-[#EFEAFF] ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDelay: '350ms' }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-slate-900">
            <Sparkles className="h-3.5 w-3.5 text-[#6D28D9]" />
            AI Impact Enhancement
          </p>
          <span className="shrink-0 rounded-full bg-[#6D28D9] px-2.5 py-1 text-[10.5px] font-bold text-white tabular-nums">
            +{uplift}% MATCH
          </span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500">
          Built services in Go that handled high traffic across internal data layers.
        </p>
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-white p-2.5 text-[11.5px] leading-relaxed text-slate-600 shadow-sm transition-colors motion-safe:hover:bg-purple-50/50">
          <Rocket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6D28D9]" />
          <span>
            Architected high-throughput microservices reducing p99 latency by 38% at 12M daily requests.
          </span>
        </p>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14 md:pt-16 md:pb-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-8 items-center">
        {/* Left: headline + CTAs */}
        <div>
          <h1 className="font-display text-[2.75rem] sm:text-6xl font-extrabold tracking-tight leading-[1.04] text-[#1E1235]">
            Turn your resume into
            <br />
            your <span className="text-[#6D28D9]">unfair advantage.</span>
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-slate-600 max-w-md">
            Upload your resume and a target job description. ReworkCV scores your ATS
            fit, pinpoints exactly what to fix, and helps you apply with confidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/analysis"
              className="inline-flex items-center gap-2 bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-[15px] font-bold px-7 py-3.5 rounded-full transition-all hover:shadow-lg hover:shadow-purple-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              Analyze My Resume
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-[14px] font-bold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"
            >
              See How It Works
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-slate-600">
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} /> ATS fit scoring
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} /> AI resume coach
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} /> Tailored cover letter
            </li>
          </ul>
        </div>

        {/* Right: benchmark card */}
        <CandidateAnalysisCard />
      </div>
    </section>
  );
}
