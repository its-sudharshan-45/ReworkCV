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
}));

describe('LoginForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows validation errors for empty credentials', async () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

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

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects to profile after successful login', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'user-1' } },
      error: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/analysis', { replace: true });
    });
  });
});
