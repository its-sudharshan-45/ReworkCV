import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { LogoLockup } from '@/components/brand/Logo';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Features', href: '#features' },
    { name: 'AI Coach', href: '#ai-coach' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center rounded-lg transition-transform duration-300 motion-safe:hover:scale-[1.04] motion-safe:active:scale-[0.98]"
            aria-label="ReworkCV home"
          >
            <LogoLockup markClassName="h-8 w-8 rounded-full" textClassName="text-[17px]" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="group relative text-[13.5px] font-medium text-slate-600 hover:text-slate-900 transition-colors py-1"
              >
                {link.name}
                <span className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-[#6D28D9] transition-transform duration-300 group-hover:scale-x-100" aria-hidden="true" />
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-5">
            <Link
              to="/login"
              className="text-[13.5px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/analysis"
              className="inline-flex items-center bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-[13px] font-bold px-5 py-2.5 rounded-full transition-all duration-300 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_12px_25px_rgba(109,40,217,0.35)] active:translate-y-0 active:scale-[0.98]"
            >
              Analyze My Resume
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  {link.name}
                </a>
              ))}
              <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-center"
                >
                  Sign In
                </Link>
                <Link
                  to="/analysis"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center bg-[#6D28D9] text-white text-sm font-bold px-4 py-2.5 rounded-full transition-colors hover:bg-[#5B21B6]"
                >
                  Analyze My Resume
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
