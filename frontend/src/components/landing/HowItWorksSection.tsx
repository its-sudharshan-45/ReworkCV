import React from 'react';
import { Reveal } from '@/components/landing/Reveal';

const STEPS = [
  {
    number: '01',
    title: 'RESUME REPORT',
    description: 'Understand your resume with a clear, structured analysis across content, ATS compatibility, and role relevance.',
  },
  {
    number: '02',
    title: 'AI RESUME COACH',
    description: 'Ask questions and get personalized guidance based on your resume and target job.',
  },
  {
    number: '03',
    title: 'COVER LETTER',
    description: 'Create a tailored cover letter built around the same application context without starting from a blank page.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-[#FAFAFC] border-y border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        <Reveal>
          <h2 className="text-2xl md:text-[28px] font-extrabold tracking-tight text-[#1E1235]">
            Understand. Improve. Apply.
          </h2>
          <p className="mt-2 text-[13.5px] text-slate-500">
            Everything you need to turn a resume into a stronger job application.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={i * 120} className="group relative">
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[13px] font-bold text-slate-500 transition-all duration-300 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:border-[#6D28D9]/40 motion-safe:group-hover:text-[#6D28D9] motion-safe:group-hover:shadow-[0_10px_25px_rgba(109,40,217,0.18)]">
                  {step.number}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="hidden md:block h-px flex-1 border-t border-dashed border-slate-300" aria-hidden="true" />
                )}
              </div>
              <p className="mt-4 text-[12px] font-bold tracking-wide text-slate-900 transition-colors motion-safe:group-hover:text-[#6D28D9]">{step.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 max-w-xs">{step.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
