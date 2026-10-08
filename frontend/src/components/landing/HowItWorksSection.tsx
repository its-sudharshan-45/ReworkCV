import React from 'react';
import { Reveal } from '@/components/landing/Reveal';
import { SectionHeader } from '@/components/landing/SectionHeader';

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <SectionHeader
          eyebrow="How it works"
          title="Understand. Improve. Apply."
          sub="Three steps turn your resume into a stronger job application."
        />

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {STEPS.map((step, i) => (
            <Reveal
              key={step.number}
              delay={i * 120}
              className="group relative rounded-2xl border border-slate-200/80 bg-white p-6 transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:border-[#6D28D9]/30 motion-safe:hover:shadow-[0_18px_45px_rgba(109,40,217,0.12)]"
            >
              <span className="font-display text-[13px] font-extrabold tracking-widest text-[#6D28D9]">
                {step.number}
              </span>
              <p className="mt-3 text-[13px] font-extrabold tracking-wide text-slate-900">{step.title}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{step.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
