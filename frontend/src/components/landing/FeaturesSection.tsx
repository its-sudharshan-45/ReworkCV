import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Reveal } from '@/components/landing/Reveal';

const BEFORE_TEXT = 'Worked on a marketplace app with login features and APIs.';
const AFTER_TEXT = (
  <>
    Developed a responsive <span className="text-[#6D28D9] font-semibold">React-based</span> marketplace
    with secure authentication and <span className="text-[#6D28D9] font-semibold">REST APIs</span>.
  </>
);

export function FeaturesSection() {
  const [showAfter, setShowAfter] = useState(true);

  return (
    <section id="features" className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        <Reveal>
          <h2 className="text-2xl md:text-[28px] font-extrabold tracking-tight text-[#1E1235]">
            See What ReworkCV Helps You Improve.
          </h2>
          <p className="mt-2 text-[13.5px] text-slate-500">
            Improve clarity, impact, and job relevance — without inventing experience.
          </p>
        </Reveal>

        <Reveal delay={120}>
        <div className="mt-8 max-w-3xl rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(30,18,53,0.06)] p-5 sm:p-6 transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:border-[#6D28D9]/25 motion-safe:hover:shadow-[0_20px_50px_rgba(109,40,217,0.14)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-slate-500">
              Transformation Focus:{' '}
              <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Full-Stack Project Bullet
              </span>
            </p>
            <div className="flex items-center rounded-full border border-slate-200 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setShowAfter(false)}
                className={`cursor-pointer rounded-full px-3 py-1.5 transition-colors ${
                  !showAfter ? 'bg-[#6D28D9] text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Before Rework
              </button>
              <button
                type="button"
                onClick={() => setShowAfter(true)}
                className={`cursor-pointer rounded-full px-3 py-1.5 transition-colors ${
                  showAfter ? 'bg-[#6D28D9] text-white' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                After Rework
              </button>
            </div>
          </div>

          <p className="mt-4 text-[10px] font-bold tracking-widest text-emerald-500 uppercase">
            Optimized Resume Presentation
          </p>
          <p className="mt-2 text-[17px] md:text-[19px] font-bold leading-snug text-slate-900">
            &ldquo;{showAfter ? AFTER_TEXT : BEFORE_TEXT}&rdquo;
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <Check className="h-3.5 w-3.5" strokeWidth={3} /> 100% Truthful
            </span>
            <span className="text-[#6D28D9]">Quantified Impact</span>
            <span className="text-[#6D28D9]">Target Keywords Highlighted</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-[11.5px] text-slate-400">
              Ground truth preserved. Only existing project experience is refined.
            </p>
            <button
              type="button"
              onClick={() => setShowAfter((v) => !v)}
              className="cursor-pointer text-[12px] font-bold text-[#6D28D9] hover:underline"
            >
              Toggle Comparison →
            </button>
          </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}
