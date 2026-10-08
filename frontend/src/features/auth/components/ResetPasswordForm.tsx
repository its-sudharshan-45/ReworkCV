import { Link, useNavigate } from 'react-router-dom';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AuthFormAlert, AuthSubmitButton, PasswordField } from '@/features/auth/components/AuthFormControls';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/features/auth/schemas';
import { getFieldErrors, mapAuthError } from '@/features/auth/utils';
import { createClient } from '@/lib/supabase/client';

const initialValues: ResetPasswordFormValues = { password: '', confirmPassword: '' };

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState<ResetPasswordFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ResetPasswordFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // A valid recovery session (from the email link) is required to set a password.
  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setHasSession(!!data.session);
      } catch {
        if (!cancelled) setHasSession(false);
      }
    }
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

      if (error) {
        setFormError(mapAuthError(error));
        return;
      }

      navigate(AUTH_ROUTES.dashboard, { replace: true });
    } catch {
      setFormError('Unable to update your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (hasSession === false) {
    return (
      <div className="text-center">
        <h1 className="text-[24px] font-bold tracking-tight text-[#17151F]">Reset your password</h1>
        <div className="mt-4 text-left">
          <AuthFormAlert
            kind="error"
            message="This reset link is invalid or has expired. Request a new one to continue."
          />
        </div>
        <p className="mt-4 text-[13px] text-slate-500">
          <Link to={AUTH_ROUTES.forgotPassword} className="font-bold text-[#D61F9E] underline-offset-4 hover:underline">
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-center text-[24px] font-bold tracking-tight text-[#17151F]">
        Choose a new password
      </h1>
      <p className="mx-auto mt-1.5 max-w-[290px] text-center text-[13px] leading-relaxed text-slate-500">
        Enter a new password for your ReworkCV account.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
        <PasswordField
          id="password"
          label="New Password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={values.password}
          error={fieldErrors.password}
          errorId="reset-password-error"
          onChange={(event) => setValues((prev) => ({ ...prev, password: event.target.value }))}
          disabled={isSubmitting || hasSession === null}
          required
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm New Password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Repeat your new password"
          value={values.confirmPassword}
          error={fieldErrors.confirmPassword}
          errorId="reset-confirm-password-error"
          onChange={(event) =>
            setValues((prev) => ({ ...prev, confirmPassword: event.target.value }))
          }
          disabled={isSubmitting || hasSession === null}
          required
        />

        {formError && <AuthFormAlert kind="error" message={formError} />}

        <AuthSubmitButton loading={isSubmitting} loadingLabel="Updating password…">
          Update Password <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
