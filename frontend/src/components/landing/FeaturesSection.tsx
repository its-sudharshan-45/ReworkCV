import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Reveal } from '@/components/landing/Reveal';
import { SectionHeader } from '@/components/landing/SectionHeader';

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4">
          <SectionHeader
            eyebrow="Before / After"
            title="See what ReworkCV helps you improve."
            sub="Clarity, impact, and job relevance — grounded only in experience you already have."
          />
          <Reveal delay={140}>
            <div className="mt-6 inline-flex items-center rounded-full border border-slate-200 p-1 text-[12px] font-bold">
              <button
                type="button"
                onClick={() => setShowAfter(false)}
                className={`cursor-pointer rounded-full px-4 py-2 transition-colors ${
                  !showAfter ? 'bg-[#1E1235] text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Before
              </button>
              <button
                type="button"
                onClick={() => setShowAfter(true)}
                className={`cursor-pointer rounded-full px-4 py-2 transition-colors ${
                  showAfter ? 'bg-[#1E1235] text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                After
              </button>
            </div>
            <div className="mt-5 space-y-2.5">
              {[
                { label: '100% truthful — nothing invented', active: true },
                { label: 'Impact quantified in numbers', active: showAfter },
                { label: 'Target keywords highlighted', active: showAfter },
              ].map((row) => (
                <p key={row.label} className="flex items-center gap-2 text-[13.5px] font-medium text-slate-600">
                  <Check
                    className={`h-4 w-4 ${row.active ? 'text-emerald-600' : 'text-slate-300'}`}
                    strokeWidth={3}
                  />
                  {row.label}
                </p>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={120} className="lg:col-span-8">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(30,18,53,0.06)] p-5 sm:p-7 transition-all duration-300 motion-safe:hover:border-[#6D28D9]/25 motion-safe:hover:shadow-[0_20px_50px_rgba(109,40,217,0.14)]">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Full-stack project bullet
          </p>

          <p className="mt-3 text-[10px] font-bold tracking-widest text-emerald-600 uppercase">
            Optimized resume presentation
          </p>
          <p className="mt-2 font-display text-[19px] md:text-[22px] font-bold leading-snug text-slate-900">
            &ldquo;{showAfter ? AFTER_TEXT : BEFORE_TEXT}&rdquo;
          </p>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-[12px] text-slate-500">
              Ground truth preserved. Only existing project experience is refined.
            </p>
          </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}
