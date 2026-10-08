import type { Response } from 'express';

/**
 * Safe Content-Disposition handling for file downloads.
 *
 * Why: download filenames are partly derived from user-controlled data
 * (resume filenames, NER-extracted candidate names, job titles). Embedding
 * them raw in a header allows CRLF/header injection and broken downloads.
 * This strips everything outside a safe alphabet, caps length, and emits
 * both `filename` (compat) and RFC 5987 `filename*` (unicode-correct).
 */
export function sanitizeDownloadFilename(name: string, fallback: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f"\\/:*?<>|;,&+=$#%@!']/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
    .slice(0, 120);

  if (!cleaned || cleaned.toLowerCase() === 'null' || cleaned.toLowerCase() === 'undefined') {
    return fallback;
  }
  return cleaned;
}

export function setDownloadHeaders(
  res: Response,
  opts: { filename: string; mimeType: string; contentLength?: number },
): void {
  const ascii = opts.filename.replace(/[^\x20-\x7e]/g, '_');
  const encoded = encodeURIComponent(opts.filename);
  res.setHeader('Content-Type', opts.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (typeof opts.contentLength === 'number') {
    res.setHeader('Content-Length', opts.contentLength);
  }
}
