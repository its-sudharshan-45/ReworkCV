import React from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/landing/Reveal';

interface SectionHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  sub?: string;
  align?: 'left' | 'center';
  dark?: boolean;
}

/**
 * Shared landing section header: eyebrow kicker + display title + supporting
 * line. One consistent hierarchy across sections instead of ad-hoc h2 styles.
 */
export function SectionHeader({ eyebrow, title, sub, align = 'left', dark = false }: SectionHeaderProps) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <p
        className={cn(
          'text-[11px] font-bold uppercase tracking-[0.18em]',
          dark ? 'text-purple-300' : 'text-[#6D28D9]',
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          'mt-2.5 font-display text-[26px] md:text-[32px] font-extrabold tracking-tight leading-[1.12]',
          dark ? 'text-white' : 'text-[#1E1235]',
        )}
      >
        {title}
      </h2>
      {sub && (
        <p className={cn('mt-3 text-[14.5px] leading-relaxed', dark ? 'text-slate-300' : 'text-slate-500')}>
          {sub}
        </p>
      )}
    </Reveal>
  );
}
