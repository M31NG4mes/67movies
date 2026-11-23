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

const FORBIDDEN_NICKNAME_ROOTS = [
  // Russian profanity & slurs
  'хуй',
  'хуя',
  'хуе',
  'хуи',
  'пизд',
  'еба',
  'ебл',
  'ебн',
  'ебу',
  'ебт',
  'бляд',
  'блять',
  'блят',
  'сука',
  'сучк',
  'мудак',
  'мудил',
  'гандон',
  'гондон',
  'пидор',
  'пидар',
  'педик',
  'шлюх',
  'шалав',
  'мраз',
  'ублюд',
  'залуп',
  'манда',
  'дроч',
  'сперм',
  'порно',
  'даун',
  'дебил',
  // English profanity & slurs
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'asshole',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'hitler',
  'nazi',
  'porn',
  // System / impersonation
  'admin',
  'administrator',
  'moderator',
  'support',
  '67movies',
  'админ',
  'модератор',
];

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'б',
  '7': 't',
  '@': 'a',
  '$': 's',
  'ё': 'е',
  'й': 'и',
};

function normalizeForProfanityCheck(raw: string): string {
  const lower = raw.toLowerCase();
  let mapped = '';
  for (const ch of lower) {
    mapped += LEET_MAP[ch] ?? ch;
  }
  return mapped.replace(/[^a-zа-я0-9]+/gi, '');
}

/**
 * Validates a user nickname against length, allowed characters, and forbidden/profane words.
 * Returns null if valid, or a Russian error message if invalid.
 */
export function validateNickname(rawName: string): string | null {
  const name = (rawName || '').trim();
  if (name.length < 2) {
    return 'Никнейм должен содержать минимум 2 символа';
  }
  if (name.length > 32) {
    return 'Никнейм не должен превышать 32 символа';
  }
  if (name.includes('@')) {
    return 'Никнейм не может содержать символ @';
  }
  if (!/^[a-zA-Zа-яА-ЯёЁ0-9 _.-]+$/.test(name)) {
    return 'Никнейм может содержать только буквы, цифры, пробел, дефис, точку и _';
  }

  const collapsed = normalizeForProfanityCheck(name);
  const cyrCollapsed = collapsed
    .replace(/x/g, 'х')
    .replace(/y/g, 'у')
    .replace(/p/g, 'р')
    .replace(/c/g, 'с')
    .replace(/a/g, 'а')
    .replace(/e/g, 'е')
    .replace(/o/g, 'о')
    .replace(/k/g, 'к')
    .replace(/m/g, 'м')
    .replace(/b/g, 'в');

  for (const root of FORBIDDEN_NICKNAME_ROOTS) {
    if (collapsed.includes(root) || cyrCollapsed.includes(root)) {
      return 'Этот никнейм содержит запрещённые слова или недопустим';
    }
  }

  return null;
}
