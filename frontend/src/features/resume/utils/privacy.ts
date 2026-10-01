import { sanitizeText } from './sanitize';

export function maskEmail(email: unknown): string | undefined {
  if (typeof email !== 'string') return undefined;
  const clean = email.trim();
  if (!clean || !clean.includes('@')) return undefined;
  const [local, domain] = clean.split('@');
  if (!local || !domain) return undefined;
  const first = sanitizeText(local).charAt(0) || '•';
  return `${first}••••@${sanitizeText(domain)}`;
}

export function maskPhone(phone: unknown): string | undefined {
  if (typeof phone !== 'string') return undefined;
  const clean = sanitizeText(phone);
  if (!clean) return undefined;
  const digits = clean.replace(/\D/g, '');
  if (digits.length < 4) return undefined;
  const last4 = digits.slice(-4);
  const prefix = clean.slice(0, 3);
  return `${prefix}••••${last4}`;
}
