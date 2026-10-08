import React from 'react';
import { Reveal } from '@/components/landing/Reveal';
import { SectionHeader } from '@/components/landing/SectionHeader';

const TRY_CHIPS = ['Analyze keyword match', 'Review bullet verbs', 'Draft interview talking points'];

export function CoreJourneySection() {
  return (
    <section id="ai-coach" className="bg-[#0D0D20]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <SectionHeader
            dark
            eyebrow="AI coach"
            title="Your resume, with an AI coach beside you."
            sub="Ask about your resume, your target role, missing skills, and bullets worth improving — answers stay grounded in your real experience."
          />
        </div>

        <Reveal delay={140} className="lg:col-span-7">
        <div className="rounded-2xl bg-[#16162B] border border-white/10 p-4 sm:p-5 transition-all duration-300 motion-safe:hover:border-[#6D28D9]/40 motion-safe:hover:shadow-[0_20px_60px_rgba(109,40,217,0.25)]">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
              You
            </span>
            <p className="rounded-xl rounded-tl-sm bg-white/10 px-3.5 py-2.5 text-[13px] text-slate-100">
              How can I improve my project section for this job?
            </p>
          </div>

          <div className="mt-3 flex items-start gap-2.5">
            <div className="flex-1 rounded-xl bg-[#1E1E38] border border-[#6D28D9]/25 p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-purple-300 uppercase">
                <span>✦</span> AI Resume Coach
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-slate-100">
                Your project section demonstrates relevant technical experience. Strengthen it by
                emphasizing{' '}
                <span className="text-purple-200 font-medium">the technologies you used</span>,{' '}
                <span className="text-purple-200 font-medium">the problem you solved</span>, and{' '}
                <span className="text-purple-200 font-medium">the measurable outcome</span> — using
                only details already present in your resume.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">Try asking:</span>
            {TRY_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:border-[#6D28D9]/50 motion-safe:hover:bg-[#6D28D9]/20 motion-safe:hover:text-white cursor-default"
              >
                &ldquo;{chip}&rdquo;
              </span>
            ))}
          </div>
        </div>
        </Reveal>
      </div>
    </section>
  );
}
