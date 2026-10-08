import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AUTH_ICONS, AuthField, AuthFormAlert, AuthSubmitButton, PasswordField } from '@/features/auth/components/AuthFormControls';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { OAuthDivider } from '@/features/auth/components/OAuthDivider';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas';
import { getFieldErrors, mapAuthError } from '@/features/auth/utils';
import { createClient, setRememberMe } from '@/lib/supabase/client';

export function LoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Surface OAuth errors forwarded back via the ?error= query param.
  const oauthError = searchParams.get('error');
  const registered = searchParams.get('registered');
  const initialFormError = oauthError
    ? 'Could not sign in with Google. Please try again.'
    : null;

  const [values, setValues] = useState<LoginFormValues & { remember: boolean }>({
    email: '',
    password: '',
    remember: true,
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(initialFormError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const parsed = loginSchema.safeParse({ email: values.email, password: values.password });

    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      // Apply the session persistence choice before signing in.
      setRememberMe(values.remember);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        setFormError(mapAuthError(error));
        return;
      }

      const nextPath = searchParams.get('next');
      const destination =
        nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
          ? nextPath
          : AUTH_ROUTES.dashboard;

      navigate(destination, { replace: true });
    } catch {
      setFormError('Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-center text-[24px] font-bold tracking-tight text-[#17151F]">
        Welcome Back
      </h1>
      <p className="mx-auto mt-1.5 max-w-[280px] text-center text-[13px] leading-relaxed text-slate-500">
        Log in to elevate, score, and land interviews with your tailored resume.
      </p>

      {registered && !formError && (
        <div className="mt-4">
          <AuthFormAlert
            kind="success"
            message="Account created. Check your email to confirm it, then sign in."
          />
        </div>
      )}

      <div className="mt-5">
        <GoogleAuthButton redirectTo={searchParams.get('next') ?? undefined} />
      </div>

      <OAuthDivider />

      <form onSubmit={handleSubmit} className="mt-1 space-y-3.5" noValidate>
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
          errorId="email-error"
          onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
          disabled={isSubmitting}
          required
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
              Password
            </span>
            <Link
              to={AUTH_ROUTES.forgotPassword}
              className="text-[12px] font-semibold text-[#17151F] underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            label="Password"
            hideLabel
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={values.password}
            error={fieldErrors.password}
            errorId="password-error"
            onChange={(event) => setValues((prev) => ({ ...prev, password: event.target.value }))}
            disabled={isSubmitting}
            required
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-slate-600">
          <input
            type="checkbox"
            checked={values.remember}
            onChange={(event) => setValues((prev) => ({ ...prev, remember: event.target.checked }))}
            disabled={isSubmitting}
            className="h-4 w-4 rounded accent-[#C1359E]"
          />
          Remember me for 30 days
        </label>

        {formError && <AuthFormAlert kind="error" message={formError} />}

        <AuthSubmitButton loading={isSubmitting} loadingLabel="Signing in…">
          Log in to Dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </AuthSubmitButton>
      </form>

      <p className="mt-5 text-center text-[13px] text-slate-500">
        Don&apos;t have an account?{' '}
        <Link to={AUTH_ROUTES.signup} className="font-bold text-[#D61F9E] underline-offset-4 hover:underline">
          Sign up for free
        </Link>
      </p>
    </div>
  );
}
