import { Link } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AUTH_ICONS, AuthField, AuthFormAlert, AuthSubmitButton } from '@/features/auth/components/AuthFormControls';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/features/auth/schemas';
import { getFieldErrors, mapAuthError } from '@/features/auth/utils';
import { createClient } from '@/lib/supabase/client';

export function ForgotPasswordForm() {
  const [values, setValues] = useState<ForgotPasswordFormValues>({ email: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ForgotPasswordFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      // Route recovery emails through the auth callback so PKCE-style
      // `?code=` links are exchanged for a session before the user reaches
      // the reset form. The callback forwards `next` after the exchange.
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('next', AUTH_ROUTES.resetPassword);
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: callbackUrl.toString(),
      });

      if (error) {
        setFormError(mapAuthError(error));
        return;
      }

      setIsSubmitted(true);
    } catch {
      setFormError('Unable to send the reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="text-center">
        <h1 className="text-[24px] font-bold tracking-tight text-[#17151F]">Check your email</h1>
        <div className="mt-4 text-left">
          <AuthFormAlert
            kind="success"
            message="If an account exists for this email, we've sent instructions to reset your password."
          />
        </div>
        <p className="mt-4 text-[13px] text-slate-500">
          Didn&apos;t get anything? Check spam, then{' '}
          <button
            type="button"
            onClick={() => setIsSubmitted(false)}
            className="font-bold text-[#D61F9E] underline-offset-4 hover:underline"
          >
            try again
          </button>
          .
        </p>
        <p className="mt-4 text-[13px] text-slate-500">
          <Link to={AUTH_ROUTES.login} className="font-bold text-[#D61F9E] underline-offset-4 hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-center text-[24px] font-bold tracking-tight text-[#17151F]">
        Reset your password
      </h1>
      <p className="mx-auto mt-1.5 max-w-[290px] text-center text-[13px] leading-relaxed text-slate-500">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
        <AuthField
          id="email"
          label="Email Address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="alex@careerflow.ai"
          icon={AUTH_ICONS.email}
          value={values.email}
          error={fieldErrors.email}
          errorId="forgot-email-error"
          onChange={(event) => setValues({ email: event.target.value })}
          disabled={isSubmitting}
          required
        />

        {formError && <AuthFormAlert kind="error" message={formError} />}

        <AuthSubmitButton loading={isSubmitting} loadingLabel="Sending link…">
          Send Reset Link <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </AuthSubmitButton>
      </form>

      <p className="mt-5 text-center text-[13px] text-slate-500">
        <Link to={AUTH_ROUTES.login} className="font-bold text-[#D61F9E] underline-offset-4 hover:underline">
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}
