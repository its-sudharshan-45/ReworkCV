import React from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { CoreJourneySection } from '@/components/landing/CoreJourneySection';
import { MeasurableProgressSection } from '@/components/landing/MeasurableProgressSection';
import { AboutAndCtaSection } from '@/components/landing/AboutAndCtaSection';

export function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">
      {/* Sticky Navigation */}
      <Navbar />

      <main>
        {/* Hero */}
        <HeroSection />

        {/* Understand. Improve. Apply. */}
        <HowItWorksSection />

        {/* See What ReworkCV Helps You Improve. */}
        <FeaturesSection />

        {/* AI Coach (dark) */}
        <CoreJourneySection />

        {/* Built Around Your Real Experience. */}
        <MeasurableProgressSection />

        {/* Final CTA */}
        <AboutAndCtaSection />
      </main>
    </div>
  );
}
