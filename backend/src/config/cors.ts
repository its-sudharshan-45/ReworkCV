/**
 * CORS allowlist parsing and matching.
 *
 * The deployed frontend origin(s) must be listed exactly in the backend
 * `CORS_ORIGIN` dashboard value (comma-separated, no trailing slashes).
 * Browsers send `Origin: <scheme>://<host>` with no path, so matching is
 * intentionally exact: prefix/substring matching would let sibling or
 * lookalike origins (e.g. `https://app.example.com.evil.com`) through.
 *
 * Dashboard values are normalized by stripping trailing slashes so a
 * copy-pasted `https://app.example.com/` still matches the browser-sent
 * `https://app.example.com`. Incoming `Origin` headers are never normalized:
 * browsers never send a trailing slash, so a slashed input stays rejected.
 */
export function parseCorsOrigins(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);
}

/**
 * Exact-match check against a parsed allowlist. Requests without an
 * `Origin` header (curl, mobile apps, server-to-server) carry no ambient
 * authority and are always allowed; the allowlist only gates browsers.
 */
export function isCorsOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}
