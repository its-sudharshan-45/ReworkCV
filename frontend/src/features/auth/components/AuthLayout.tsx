import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Centered auth card on a soft lavender canvas. Single page-level scroll;
 * compact so complete forms stay reachable on 720p+ viewports.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F6F1FF] text-[#17151F] antialiased">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col justify-center px-5 py-8 sm:px-6">
        <div className="rounded-[28px] bg-white px-6 py-8 shadow-[0_24px_70px_rgba(109,40,217,0.12)] sm:px-8 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
          <div className="flex flex-col items-center text-center">
            <Link
              to="/"
              aria-label="ReworkCV home"
              className="rounded-2xl transition-transform duration-300 motion-safe:hover:scale-105 motion-safe:active:scale-95"
            >
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-[0_0_24px_rgba(109,40,217,0.45)] ring-1 ring-slate-200">
                <img
                  src="/reworkcv-logo.png"
                  alt="ReworkCV home"
                  className="h-full w-full object-cover select-none"
                  draggable={false}
                />
              </span>
            </Link>
            <p className="mt-3 text-[17px] font-extrabold tracking-tight">
              Rework<span className="text-[#D61F9E]">CV</span>
            </p>
          </div>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </main>
  );
}
