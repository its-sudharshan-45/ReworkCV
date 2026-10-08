import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/landing/Reveal';

export function AboutAndCtaSection() {
  return (
    <section className="bg-[#FAFAFC] border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center">
        <Reveal>
          <h2 className="text-2xl md:text-[30px] font-extrabold tracking-tight leading-tight text-[#1E1235]">
            Ready to Rework Your
            <br />
            Resume?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-slate-500">
            Understand where your resume stands, discover what you can improve, and prepare a
            stronger application for your next opportunity.
          </p>
        </Reveal>
        <Reveal delay={130}>
          <Link
            to="/analysis"
            className="group mt-6 inline-flex items-center gap-2 bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-[14px] font-bold px-6 py-3 rounded-full transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_16px_35px_rgba(109,40,217,0.35)] active:translate-y-0 active:scale-[0.98]"
          >
            Analyze My Resume
            <ArrowRight className="h-4 w-4 transition-transform duration-300 motion-safe:group-hover:translate-x-1" />
          </Link>
          <p className="mt-5 text-[11.5px] text-slate-400">
            No account required for initial scan <span className="mx-1.5 text-slate-300">·</span> Free ATS
            preview <span className="mx-1.5 text-slate-300">·</span> Privacy guaranteed
          </p>
        </Reveal>
      </div>
    </section>
  );
}
