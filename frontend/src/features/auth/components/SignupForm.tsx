import { Link, useNavigate } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AUTH_ICONS, AuthField, AuthFormAlert, AuthSubmitButton, PasswordField } from '@/features/auth/components/AuthFormControls';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { GoogleAuthButton } from '@/features/auth/components/GoogleAuthButton';
import { OAuthDivider } from '@/features/auth/components/OAuthDivider';
import { signupSchema, type SignupFormValues } from '@/features/auth/schemas';
import { getFieldErrors, mapAuthError } from '@/features/auth/utils';
import { createClient } from '@/lib/supabase/client';

const initialValues: SignupFormValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function SignupForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState<SignupFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof SignupFormValues, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const parsed = signupSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.fullName },
          // Send email-confirmation links back to the app callback so the
          // session is exchanged and the user lands on the analysis page.
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setFormError(mapAuthError(error));
        return;
      }

      if (data.session) {
        navigate(AUTH_ROUTES.dashboard, { replace: true });
        return;
      }

      setFormError(null);
      navigate(`${AUTH_ROUTES.login}?registered=1`, { replace: true });
    } catch {
      setFormError('Unable to create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-center text-[24px] font-bold tracking-tight text-[#17151F]">
        Create your account
      </h1>
      <p className="mx-auto mt-1.5 max-w-[290px] text-center text-[13px] leading-relaxed text-slate-500">
        Join ReworkCV to elevate, score, and land interviews with your tailored resume.
      </p>

      <div className="mt-4">
        <GoogleAuthButton label="Continue with Google" />
      </div>

      <OAuthDivider />

      <form onSubmit={handleSubmit} className="mt-1 space-y-3.5" noValidate>
        <AuthField
          id="fullName"
          label="Full Name"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Alex Rivera"
          icon={AUTH_ICONS.name}
          value={values.fullName}
          error={fieldErrors.fullName}
          errorId="signup-fullname-error"
          onChange={(event) => setValues((prev) => ({ ...prev, fullName: event.target.value }))}
          disabled={isSubmitting}
          required
        />

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
          errorId="signup-email-error"
          onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
          disabled={isSubmitting}
          required
        />

        <PasswordField
          id="password"
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={values.password}
          error={fieldErrors.password}
          errorId="signup-password-error"
          onChange={(event) => setValues((prev) => ({ ...prev, password: event.target.value }))}
          disabled={isSubmitting}
          required
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm Password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={values.confirmPassword}
          error={fieldErrors.confirmPassword}
          errorId="signup-confirm-password-error"
          onChange={(event) =>
            setValues((prev) => ({ ...prev, confirmPassword: event.target.value }))
          }
          disabled={isSubmitting}
          required
        />

        {formError && <AuthFormAlert kind="error" message={formError} />}

        <AuthSubmitButton loading={isSubmitting} loadingLabel="Creating account…">
          Create Account <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </AuthSubmitButton>
      </form>

      <p className="mt-5 text-center text-[13px] text-slate-500">
        Already have an account?{' '}
        <Link to={AUTH_ROUTES.login} className="font-bold text-[#D61F9E] underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
