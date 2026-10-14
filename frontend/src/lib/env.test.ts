import { describe, expect, it } from 'vitest';
import { normalizeApiUrl } from '@/lib/env';

describe('normalizeApiUrl', () => {
  it('appends the default API path to a bare backend host', () => {
    expect(normalizeApiUrl('https://reworkcv-2.onrender.com')).toBe(
      'https://reworkcv-2.onrender.com/api/v1',
    );
  });

  it('leaves a fully qualified API base URL untouched', () => {
    expect(normalizeApiUrl('https://reworkcv-2.onrender.com/api/v1')).toBe(
      'https://reworkcv-2.onrender.com/api/v1',
    );
    expect(normalizeApiUrl('http://localhost:4000/api/v1')).toBe(
      'http://localhost:4000/api/v1',
    );
  });

  it('preserves explicitly configured custom paths', () => {
    expect(normalizeApiUrl('https://gateway.example.com/custom-prefix')).toBe(
      'https://gateway.example.com/custom-prefix',
    );
  });

  it('strips trailing slashes that would produce double-slash request paths', () => {
    expect(normalizeApiUrl('https://reworkcv-2.onrender.com/api/v1/')).toBe(
      'https://reworkcv-2.onrender.com/api/v1',
    );
    expect(normalizeApiUrl('https://reworkcv-2.onrender.com/')).toBe(
      'https://reworkcv-2.onrender.com/api/v1',
    );
    expect(normalizeApiUrl('/api/v1/')).toBe('/api/v1');
  });

  it('leaves same-origin paths otherwise untouched', () => {
    expect(normalizeApiUrl('/api/v1')).toBe('/api/v1');
  });

  it('trims whitespace and passes unparseable values through for schema validation', () => {
    expect(normalizeApiUrl('  https://reworkcv-2.onrender.com/api/v1  ')).toBe(
      'https://reworkcv-2.onrender.com/api/v1',
    );
    expect(normalizeApiUrl('not-a-url')).toBe('not-a-url');
  });
});
