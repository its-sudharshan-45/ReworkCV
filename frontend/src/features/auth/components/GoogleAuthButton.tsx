
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-message';
import { createClient } from '@/lib/supabase/client';

interface GoogleAuthButtonProps {
  /** Text shown inside the button. Defaults to "Continue with Google". */
  label?: string;
  /**
   * The path to redirect to after a successful OAuth exchange.
   * Supabase will forward this through the OAuth `state` parameter so that
   * the callback route can honour deep-link redirects.
   */
  redirectTo?: string;
}

/** Google "G" logo SVG (official brand colors). */
function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  label = 'Continue with Google',
  redirectTo,
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();

      // Build the absolute callback URL so Supabase knows where to redirect
      // after the Google consent screen. We always land on /auth/callback which
      // then performs the code-exchange and sends the user to `redirectTo`.
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      if (redirectTo) {
        callbackUrl.searchParams.set('next', redirectTo);
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (oauthError) {
        setError('Could not sign in with Google. Please try again.');
        setIsLoading(false);
      }
      // On success the browser is redirected away by Supabase, so we leave
      // isLoading = true so the button stays disabled during the navigation.
    } catch {
      setError('Could not sign in with Google. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        id="google-auth-btn"
        type="button"
        variant="outline"
        className="h-[50px] w-full rounded-full border-slate-200 bg-white text-[14.5px] font-semibold text-[#17151F] transition-colors duration-200 hover:bg-slate-50 hover:text-[#17151F]"
        onClick={handleClick}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        <GoogleLogo />
        {isLoading ? 'Redirecting…' : label}
      </Button>
      <FormMessage id="google-auth-error" message={error ?? undefined} />
    </div>
  );
}
