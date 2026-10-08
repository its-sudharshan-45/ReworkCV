import React from 'react';
import { Reveal } from '@/components/landing/Reveal';

const TRY_CHIPS = ['Analyze keyword match', 'Review bullet verbs', 'Draft interview talking points'];

export function CoreJourneySection() {
  return (
    <section id="ai-coach" className="bg-[#0D0D20]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6D28D9]/20 border border-[#6D28D9]/30 px-3 py-1 text-[11px] font-bold text-purple-300 transition-colors motion-safe:hover:bg-[#6D28D9]/30 motion-safe:hover:border-[#6D28D9]/50">
            <span className="text-[10px]">✦</span> Adaptive Career Intelligence
          </span>
          <h2 className="mt-4 text-2xl md:text-[32px] font-extrabold tracking-tight leading-tight text-white max-w-md">
            Your Resume, With an AI Coach Beside You.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400 max-w-xl">
            Ask questions about your resume, your target role, missing skills, bullet points,
            keywords, and areas worth improving.
          </p>
        </Reveal>

        <Reveal delay={140}>
        <div className="mt-8 max-w-2xl rounded-2xl bg-[#16162B] border border-white/5 p-4 sm:p-5 transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:border-[#6D28D9]/40 motion-safe:hover:shadow-[0_20px_60px_rgba(109,40,217,0.25)]">
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
              <p className="mt-2 text-[13px] leading-relaxed text-slate-200">
                Your project section demonstrates relevant technical experience. Strengthen it by
                emphasizing{' '}
                <span className="text-purple-300 font-medium">the technologies you used</span>,{' '}
                <span className="text-purple-300 font-medium">the problem you solved</span>, and{' '}
                <span className="text-purple-300 font-medium">the measurable outcome</span> — using
                only details already present in your resume.
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6D28D9] text-white text-sm">
              →
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">Try asking:</span>
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
