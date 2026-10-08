import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginForm } from '@/features/auth/components/LoginForm';

const navigate = vi.fn();
const signInWithPassword = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams()],
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword,
    },
  }),
  setRememberMe: vi.fn(),
}));

describe('LoginForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows validation errors for empty credentials', async () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Log in to Dashboard' }));

    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(screen.getByText('Password must be at least 8 characters')).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows authentication error from Supabase', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in to Dashboard' }));

    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects to profile after successful login', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'user-1' } },
      error: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in to Dashboard' }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/analysis', { replace: true });
    });
  });

  it('toggles password visibility', async () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput.type).toBe('password');
  });

  it('links to the forgot password page', async () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeTruthy();
  });

  it('applies the remember-me choice before signing in', async () => {
    const { setRememberMe } = await import('@/lib/supabase/client');
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'user-1' } },
      error: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    // Uncheck "Remember me for 30 days" (checked by default).
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Log in to Dashboard' }));

    await waitFor(() => {
      expect(vi.mocked(setRememberMe)).toHaveBeenCalledWith(false);
      expect(signInWithPassword).toHaveBeenCalled();
    });
  });
});
