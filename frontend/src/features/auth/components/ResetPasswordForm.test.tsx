import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm';

const navigate = vi.fn();
const getSession = vi.fn();
const updateUser = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession,
      updateUser,
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

describe('ResetPasswordForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows an expired-link state without a recovery session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    render(<ResetPasswordForm />);

    expect(await screen.findByText(/invalid or has expired/i)).toBeDefined();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('shows a mismatch error and updates on valid input', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    updateUser.mockResolvedValue({ data: {}, error: null });

    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.queryByText(/invalid or has expired/i)).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'different123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    expect(await screen.findByText('Passwords do not match')).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: 'newpassword123' });
    });
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/analysis', { replace: true });
    });
  });

  it('surfaces update failures without navigating away', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    updateUser.mockResolvedValue({
      data: {},
      error: { message: 'New password should be different from the old password.' },
    });

    render(<ResetPasswordForm />);

    await waitFor(() => {
      expect(screen.queryByText(/invalid or has expired/i)).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    // Unknown provider messages fall back to a safe generic error.
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
