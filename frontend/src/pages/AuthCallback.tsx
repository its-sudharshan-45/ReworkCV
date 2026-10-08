import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { Loader2 } from 'lucide-react';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    let isMounted = true;

    function redirectLater(path: string, delayMs: number) {
      const id = window.setTimeout(() => {
        if (isMounted) navigate(path, { replace: true });
      }, delayMs);
      timeouts.current.push(id);
    }

    async function handleAuthCallback() {
      const typeParam = searchParams.get('type');
      const hashType = window.location.hash.match(/type=([^&]+)/)?.[1];
      if (typeParam === 'recovery' || hashType === 'recovery') {
        // Password-recovery links land here; hand off to the reset page which
        // reads the recovery session from the URL.
        if (isMounted) navigate(AUTH_ROUTES.resetPassword, { replace: true });
        return;
      }

      const code = searchParams.get('code');
      const nextParam = searchParams.get('next');
      const destination =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
          ? nextParam
          : AUTH_ROUTES.dashboard;

      const supabase = createClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (isMounted) {
            setErrorMsg('OAuth authentication failed. Redirecting to login…');
            redirectLater(`${AUTH_ROUTES.login}?error=oauth_exchange_failed`, 1500);
          }
          return;
        }
      } else {
        // Check if session was already picked up from URL hash
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) {
            setErrorMsg('No authentication code or session found. Redirecting to login…');
            redirectLater(`${AUTH_ROUTES.login}?error=oauth_no_code`, 1500);
          }
          return;
        }
      }

      if (isMounted) {
        navigate(destination, { replace: true });
      }
    }

    void handleAuthCallback();

    const pending = timeouts.current;
    return () => {
      isMounted = false;
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7]">
      <div className="flex flex-col items-center gap-3 text-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#6D4AFF]" />
        <p className="text-sm font-medium text-[#686572]">
          {errorMsg || 'Completing sign in…'}
        </p>
      </div>
    </div>
  );
}
