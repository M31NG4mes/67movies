/**
 * Security utilities for SSRF protection, XSS sanitization, and CSRF origin checks.
 */

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  '0.0.0.0',
  '[::1]',
]);

/**
 * Validates an external URL against SSRF (blocks file://, localhost, link-local, RFC1918 IPs).
 */
export function isSafeExternalUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > 2048) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return false;
    }
    const stripped = hostname.replace(/^\[|\]$/g, '');
    if (PRIVATE_IP_PATTERNS.some((re) => re.test(stripped))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Filters forwarded proxy headers to prevent header-injection / credential leakage.
 */
export function sanitizeProxyHeaders(headers: Record<string, string>): Record<string, string> {
  const allowed = new Set(['referer', 'origin', 'user-agent', 'accept', 'accept-language']);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    const keyLower = k.toLowerCase();
    if (allowed.has(keyLower) && typeof v === 'string' && !/[\r\n]/.test(v)) {
      out[k] = v.slice(0, 500);
    }
  }
  return out;
}

/**
 * Strips dangerous HTML/script tags and javascript: URIs to defend against stored XSS.
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Checks whether an Origin header is allowed for CORS / CSRF defense.
 */
export function isAllowedOrigin(origin: string | undefined, configuredOrigins?: string): boolean {
  if (!origin) return true; // Non-browser / same-origin / curl / server-to-server
  const normalized = origin.toLowerCase().replace(/\/+$/, '');

  // Always allow local dev
  if (
    normalized === 'http://localhost:3000' ||
    normalized === 'http://127.0.0.1:3000' ||
    normalized === 'http://localhost:4000'
  ) {
    return true;
  }

  // Allow configured origins (comma-separated) or wildcard
  if (configuredOrigins) {
    const list = configuredOrigins
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/\/+$/, ''))
      .filter(Boolean);
    if (list.includes('*') || list.includes(normalized)) {
      return true;
    }
  }

  // Allow Vercel preview/production deployments of the app
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(normalized)) {
    return true;
  }

  return false;
}
