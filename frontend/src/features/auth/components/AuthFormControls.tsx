import React, { useState } from 'react';
import { AlertCircle, AtSign, CheckCircle2, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AUTH_ICONS = {
  email: <AtSign className="h-[17px] w-[17px]" aria-hidden="true" />,
  password: <Lock className="h-[17px] w-[17px]" aria-hidden="true" />,
  name: <User className="h-[17px] w-[17px]" aria-hidden="true" />,
} as const;

interface AuthFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  errorId?: string;
  icon?: React.ReactNode;
  /** Hide the visible label (a custom label row is rendered by the caller). */
  hideLabel?: boolean;
}

/** Filled lavender input with leading icon, per the reference design. */
export function AuthField({ id, label, error, errorId, icon, hideLabel, className, ...props }: AuthFieldProps) {
  return (
    <div>
      {hideLabel ? (
        <span id={`${id}-label`} className="sr-only">
          {label}
        </span>
      ) : (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error && errorId ? errorId : undefined}
          aria-labelledby={hideLabel ? `${id}-label` : undefined}
          className={cn(
            'h-[52px] w-full rounded-xl border bg-[#F6F1FF] pl-11 pr-4 text-[14.5px] text-[#17151F] placeholder:text-slate-400',
            'transition-[border-color,box-shadow,background-color] duration-200 outline-none',
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100'
              : 'border-transparent focus:border-[#6D4AFF] focus:bg-white focus:ring-4 focus:ring-[#6D4AFF]/15',
            'disabled:cursor-not-allowed disabled:opacity-60',
            className,
          )}
          {...props}
        />
      </div>
      {error && errorId && (
        <p id={errorId} role="alert" className="mt-1.5 text-[13px] font-medium text-red-600 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
          {error}
        </p>
      )}
    </div>
  );
}

interface PasswordFieldProps extends Omit<AuthFieldProps, 'type'> {
  autoComplete?: string;
}

/** Password input with animated show/hide toggle. */
export function PasswordField({ autoComplete = 'current-password', hideLabel, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <AuthField
        {...props}
        hideLabel={hideLabel}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        icon={AUTH_ICONS.password}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className={`absolute right-2 rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-[#6D4AFF]/5 hover:text-[#17151F] ${
          hideLabel ? 'top-[9px]' : 'top-[30px]'
        }`}
      >
        <span key={visible ? 'hide' : 'show'} className="block animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none">
          {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </span>
      </button>
    </div>
  );
}

interface AuthSubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean;
  loadingLabel: string;
}

/** Gradient pill CTA. */
export function AuthSubmitButton({ loading, loadingLabel, children, className, ...props }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className={cn(
        'flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6D28D9] to-[#D61F9E] text-[15px] font-bold text-white',
        'shadow-[0_10px_25px_rgba(109,40,217,0.30)] transition-all duration-200 hover:brightness-110 active:scale-[0.99]',
        'disabled:cursor-not-allowed disabled:opacity-70 disabled:saturate-50',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />}
      {loading ? loadingLabel : children}
    </button>
  );
}

interface AuthFormAlertProps {
  kind: 'error' | 'success';
  message: string;
}

/** Inline form-level alert. */
export function AuthFormAlert({ kind, message }: AuthFormAlertProps) {
  const isError = kind === 'error';
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13.5px] font-medium leading-snug',
        'animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none',
        isError
          ? 'border-red-200 bg-red-50 text-red-700 motion-safe:animate-[auth-shake_300ms_ease-out] motion-reduce:animate-none'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800',
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </div>
  );
}
