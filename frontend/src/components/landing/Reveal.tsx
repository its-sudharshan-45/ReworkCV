import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms for cascading entrances. */
  delay?: number;
  /** Vertical offset in px for the entrance motion. */
  offset?: number;
  as?: 'div' | 'li' | 'span';
}

/**
 * Scroll-triggered reveal wrapper for landing sections.
 * Fades + slides content in once when it enters the viewport.
 * Respects prefers-reduced-motion via motion-reduce overrides.
 */
export function Reveal({ children, className, delay = 0, offset = 28, as = 'div' }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as as 'div';

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms`, ['--reveal-offset' as string]: `${offset}px` }}
      className={cn(
        'transition-all duration-700 ease-out will-change-transform motion-reduce:transition-none motion-reduce:transform-none',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[var(--reveal-offset)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
