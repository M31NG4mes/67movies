import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isSafeExternalUrl,
  sanitizeProxyHeaders,
  sanitizeText,
  isAllowedOrigin,
} = require('../dist/apps/api/src/common/security/security.util.js');
const { AppCacheService } = require('../dist/apps/api/src/common/cache/cache.service.js');
const { MetricsService } = require('../dist/apps/api/src/common/monitoring/metrics.service.js');
const {
  hashPassword,
  verifyPassword,
} = require('../dist/apps/api/src/modules/auth/password.util.js');

test('Unit: SSRF protection blocks private IPs, localhost, metadata, and non-http schemes', () => {
  assert.equal(isSafeExternalUrl('https://api.themoviedb.org/3/movie/popular'), true);
  assert.equal(isSafeExternalUrl('https://api.tvmaze.com/schedule'), true);

  assert.equal(isSafeExternalUrl('http://127.0.0.1:4000/api/health'), false);
  assert.equal(isSafeExternalUrl('http://localhost:3000'), false);
  assert.equal(isSafeExternalUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isSafeExternalUrl('http://10.0.0.1/internal'), false);
  assert.equal(isSafeExternalUrl('http://192.168.1.5/admin'), false);
  assert.equal(isSafeExternalUrl('http://172.16.0.10/secret'), false);
  assert.equal(isSafeExternalUrl('file:///etc/passwd'), false);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl(''), false);
});

test('Unit: Proxy header sanitizer strips sensitive headers and CRLF', () => {
  const clean = sanitizeProxyHeaders({
    Referer: 'https://example.com',
    Authorization: 'Bearer secret-token',
    Cookie: 'session=abc',
    Host: 'internal.local',
    'User-Agent': 'Mozilla/5.0\r\nX-Injected: bad',
  });
  assert.equal(clean.Referer, 'https://example.com');
  assert.equal(clean.Authorization, undefined);
  assert.equal(clean.Cookie, undefined);
  assert.equal(clean.Host, undefined);
  assert.equal(clean['User-Agent'], undefined);
});

test('Unit: XSS text sanitizer strips script tags and inline HTML', () => {
  assert.equal(
    sanitizeText('<script>alert("xss")</script>Привет <b>мир</b>!'),
    'Привет мир!',
  );
  assert.equal(sanitizeText('javascript:alert(1) test'), 'alert(1) test');
  assert.equal(sanitizeText('Обычный отзыв 🎬🔥'), 'Обычный отзыв 🎬🔥');
});

test('Unit: CORS/CSRF origin validator allows trusted domains and blocks unknown origins', () => {
  assert.equal(isAllowedOrigin('http://localhost:3000'), true);
  assert.equal(isAllowedOrigin('https://67movies-app.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://custom.example.com', 'https://custom.example.com'), true);
  assert.equal(isAllowedOrigin('https://evil-attacker.com', 'https://custom.example.com'), false);
  assert.equal(isAllowedOrigin(undefined), true);
});

test('Unit: AppCacheService handles TTL, wrap(), invalidation and hit-rate metrics', async () => {
  const cache = new AppCacheService();
  assert.equal(cache.get('missing'), null);

  cache.set('media:1', { title: 'Dune' }, 60);
  assert.deepEqual(cache.get('media:1'), { title: 'Dune' });

  let calls = 0;
  const val1 = await cache.wrap('media:2', 60, async () => {
    calls++;
    return { title: 'Interstellar' };
  });
  const val2 = await cache.wrap('media:2', 60, async () => {
    calls++;
    return { title: 'ShouldNotRun' };
  });
  assert.equal(calls, 1);
  assert.deepEqual(val1, val2);

  const removed = cache.invalidatePrefix('media:');
  assert.equal(removed, 2);
  const stats = cache.getStats();
  assert.equal(stats.hits >= 2, true);
  assert.equal(stats.misses >= 2, true);
});

test('Unit: MetricsService tracks latencies, error counters and memory stats', () => {
  const metrics = new MetricsService();
  metrics.recordRequest(200, 15);
  metrics.recordRequest(404, 25);
  metrics.recordRequest(429, 5);
  metrics.recordRequest(500, 120);

  const snap = metrics.getSnapshot();
  assert.equal(snap.requests.total, 4);
  assert.equal(snap.requests.errors4xx, 2);
  assert.equal(snap.requests.errors5xx, 1);
  assert.equal(snap.requests.rateLimited429, 1);
  assert.equal(snap.requests.p95LatencyMs >= 25, true);
  assert.equal(snap.memoryMb.rss > 0, true);
});

test('Unit: Scrypt password hashing verifies valid passwords and uses unique salts', async () => {
  const h1 = await hashPassword('StrongPass123!');
  const h2 = await hashPassword('StrongPass123!');
  assert.notEqual(h1, h2);
  assert.equal(await verifyPassword('StrongPass123!', h1), true);
  assert.equal(await verifyPassword('WrongPass123!', h1), false);
});
