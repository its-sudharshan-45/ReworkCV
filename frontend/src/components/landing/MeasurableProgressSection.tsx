import React from 'react';
import { Reveal } from '@/components/landing/Reveal';

const PILLARS = [
  {
    number: '01',
    title: 'No invented experience',
    description: 'Suggestions only work with what you\u2019ve actually accomplished.',
  },
  {
    number: '02',
    title: 'Job-specific guidance',
    description: 'Recommendations correspond directly to target job requisitions.',
  },
  {
    number: '03',
    title: 'You stay in control',
    description: 'You review, accept, or modify every phrase before finalizing.',
  },
];

export function MeasurableProgressSection() {
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
        <Reveal className="text-center">
          <h2 className="text-center text-2xl md:text-[28px] font-extrabold tracking-tight text-[#1E1235]">
            Built Around Your Real Experience.
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0">
          {PILLARS.map((pillar, i) => (
            <Reveal
              key={pillar.number}
              delay={i * 120}
              className={`group text-center px-6 py-4 rounded-2xl transition-all duration-300 motion-safe:hover:-translate-y-1.5 motion-safe:hover:bg-[#FAF8FF] motion-safe:hover:shadow-[0_16px_40px_rgba(109,40,217,0.10)] ${i > 0 ? 'md:border-l md:border-slate-200' : ''}`}
            >
              <p className="text-[11px] font-bold tracking-widest text-slate-400 transition-colors motion-safe:group-hover:text-[#6D28D9]">{pillar.number}</p>
              <p className="mt-2 text-[14px] font-bold text-slate-900">{pillar.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{pillar.description}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mx-auto mt-10 max-w-md text-center text-[13px] leading-relaxed text-slate-400 italic">
            &ldquo;ReworkCV helps you present your experience more clearly. It does not create
            experience you don&rsquo;t have.&rdquo;
          </p>
        </Reveal>
      </div>
    </section>
  );
}
