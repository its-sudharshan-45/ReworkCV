import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SignupForm } from '@/features/auth/components/SignupForm';

const navigate = vi.fn();
const signUp = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp,
    },
  }),
}));

describe('SignupForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows validation error when passwords do not match', async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Passwords do not match')).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('requires a full name', async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Enter your full name')).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows duplicate signup error', async () => {
    signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    });

    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('An account with this email already exists.')).toBeTruthy();
  });

  it('sends the full name to Supabase on registration', async () => {
    signUp.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: { id: 'user-1' } },
      error: null,
    });

    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Jane Doe' },
    });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'jane@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'password123',
        options: { data: { full_name: 'Jane Doe' } },
      });
    });
  });
});
