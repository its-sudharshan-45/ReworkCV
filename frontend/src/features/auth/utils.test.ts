import { describe, expect, it } from 'vitest';
import { loginSchema, signupSchema } from '@/features/auth/schemas';
import { getFieldErrors, mapAuthError } from '@/features/auth/utils';
import type { AuthError } from '@supabase/supabase-js';
import { z } from 'zod';

describe('auth schemas', () => {
  it('rejects invalid login email and short password', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'short' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getFieldErrors(result.error);
      expect(errors.email).toBe('Enter a valid email address');
      expect(errors.password).toBe('Password must be at least 8 characters');
    }
  });

  it('accepts valid login credentials', () => {
    const result = loginSchema.safeParse({
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects signup when passwords do not match', () => {
    const result = signupSchema.safeParse({
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
      confirmPassword: 'password456',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getFieldErrors(result.error);
      expect(errors.confirmPassword).toBe('Passwords do not match');
    }
  });

  it('rejects signup without a full name', () => {
    const result = signupSchema.safeParse({
      fullName: '',
      email: 'jane@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getFieldErrors(result.error).fullName).toBe('Enter your full name');
    }
  });
});

describe('mapAuthError', () => {
  it('maps common authentication failures to safe messages', () => {
    expect(
      mapAuthError({ message: 'Invalid login credentials' } as AuthError),
    ).toBe('Invalid email or password.');

    expect(
      mapAuthError({ message: 'User already registered' } as AuthError),
    ).toBe('An account with this email already exists.');
  });
});

describe('getFieldErrors', () => {
  it('returns the first validation message per field', () => {
    const schema = z.object({
      email: z.string().email('Enter a valid email address'),
    });
    const result = schema.safeParse({ email: 'bad' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getFieldErrors(result.error).email).toBe('Enter a valid email address');
    }
  });
});
