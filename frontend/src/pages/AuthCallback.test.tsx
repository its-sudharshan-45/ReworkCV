import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthCallbackPage } from '@/pages/AuthCallback';

const navigate = vi.fn();
let searchParams = new URLSearchParams();
const exchangeCodeForSession = vi.fn();
const getSession = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [searchParams],
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession,
      getSession,
    },
  }),
}));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams = new URLSearchParams();
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exchanges the code before routing recovery links to reset-password', async () => {
    searchParams = new URLSearchParams('code=pkce-code&type=recovery');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    });
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/reset-password', { replace: true });
    });
  });

  it('honours deep-link destinations after a successful exchange', async () => {
    searchParams = new URLSearchParams('code=pkce-code&next=/resume/report/r1/a1');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/resume/report/r1/a1', { replace: true });
    });
  });

  it('redirects provider errors back to login', async () => {
    vi.useFakeTimers();
    searchParams = new URLSearchParams('error=access_denied');

    render(<AuthCallbackPage />);

    await vi.advanceTimersByTimeAsync(1600);
    expect(navigate).toHaveBeenCalledWith('/login?error=oauth_exchange_failed', {
      replace: true,
    });
  });

  it('proceeds to the destination when the exchange fails but a session exists', async () => {
    searchParams = new URLSearchParams('code=pkce-code&next=/analysis');
    exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: 'code has already been used' },
    });
    // The client auto-detected the session from the URL first.
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/analysis', { replace: true });
    });
    expect(navigate).not.toHaveBeenCalledWith(
      expect.stringContaining('error='),
      expect.anything(),
    );
  });

  it('redirects to login when the exchange fails and no session exists', async () => {
    vi.useFakeTimers();
    searchParams = new URLSearchParams('code=stale-code');
    exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: 'invalid grant' },
    });
    getSession.mockResolvedValue({ data: { session: null } });

    render(<AuthCallbackPage />);

    await vi.advanceTimersByTimeAsync(1600);
    expect(navigate).toHaveBeenCalledWith('/login?error=oauth_exchange_failed', {
      replace: true,
    });
  });
});
