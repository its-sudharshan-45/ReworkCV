import { cn } from '@/lib/utils';

interface LogoMarkProps {
  className?: string;
  imgClassName?: string;
}

/**
 * Official ReworkCV mark (white circular badge on a black tile).
 * Rendered in a circular cropped frame so only the badge shows —
 * no blend modes, so it stays fully visible at all times.
 */
export function LogoMark({ className, imgClassName }: LogoMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none overflow-hidden rounded-full bg-white ring-1 ring-slate-200',
        className ?? 'h-10 w-10',
      )}
    >
      <img
        src="/reworkcv-logo.png"
        alt=""
        aria-hidden="true"
        className={cn('h-full w-full object-cover', imgClassName)}
        draggable={false}
      />
    </span>
  );
}

interface LogoLockupProps {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}

/** Logo mark + "ReworkCV" wordmark used across the product. */
export function LogoLockup({ className, markClassName, textClassName }: LogoLockupProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span className={cn('text-[19px] font-bold tracking-tight text-[#17151F]', textClassName)}>
        ReworkCV
      </span>
    </span>
  );
}
