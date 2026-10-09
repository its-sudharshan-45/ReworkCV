import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

const resetPasswordForEmail = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail,
    },
  }),
}));

describe('ForgotPasswordForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('validates the email before submitting', async () => {
    render(<ForgotPasswordForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('shows a neutral success state without revealing account existence', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(
      await screen.findByText(/If an account exists for this email/i),
    ).toBeTruthy();
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    // Recovery links must route through the auth callback so PKCE codes are
    // exchanged for a session before the reset form loads.
    const redirectTo = resetPasswordForEmail.mock.calls[0][1]?.redirectTo as string;
    const callbackUrl = new URL(redirectTo);
    expect(callbackUrl.pathname).toBe('/auth/callback');
    expect(callbackUrl.searchParams.get('next')).toBe('/reset-password');
  });

  it('shows a friendly error when the request fails', async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'For security purposes, you can only request this once every 60 seconds' },
    });

    render(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(await screen.findByText(/Please wait a minute/i)).toBeTruthy();
  });
});
