/** Sanitize untrusted resume/JD/AI text for safe rendering. */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#x2F;': '/',
  '&nbsp;': ' ',
};

export function decodeHtmlEntities(input: string): string {
  let out = input;
  for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
    out = out.split(entity).join(char);
  }
  out = out.replace(/&#(\d+);/g, (_m, code: string) => {
    const n = parseInt(code, 10);
    return Number.isFinite(n) ? String.fromCharCode(n) : '';
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => {
    const n = parseInt(code, 16);
    return Number.isFinite(n) ? String.fromCharCode(n) : '';
  });
  return out;
}

export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  let out = decodeHtmlEntities(input);
  // Intentional: strip control/invisible chars from untrusted resume + AI text.
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  out = out
    .replace(/[""«»]/g, '"')
    .replace(/[''‚‛]/g, "'")
    .replace(/[––—―]/g, '-')
    .replace(/…/g, '...');
  // Intentional: collapse irregular whitespace (incl. NBSP) from pasted resumes.
  // eslint-disable-next-line no-irregular-whitespace
  out = out.replace(/[ \t ]+/g, ' ');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

export function sanitizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const s = sanitizeText(item);
    if (s) out.push(s);
  }
  return out;
}

/** Returns true if a display string is a placeholder that must never render. */
export function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  if (typeof value !== 'string') return false;
  const t = value.trim();
  return t === '' || t === 'undefined' || t === 'null' || t === 'NaN' || t === '[object Object]';
}
