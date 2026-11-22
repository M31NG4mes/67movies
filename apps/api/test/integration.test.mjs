import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Use isolated in-memory mode so tests never touch production Neon PostgreSQL
process.env.NODE_ENV = 'test';
process.env.USE_IN_MEMORY_DB = 'true';
process.env.RATE_LIMIT_AUTH_MAX = '12';
process.env.RATE_LIMIT_MAX = '200';
process.env.CORS_ORIGIN = 'http://localhost:3000';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/apps/api/src/app.module.js');
const { AllExceptionsFilter } = require('../dist/apps/api/src/common/filters/http-exception.filter.js');
const { isAllowedOrigin } = require('../dist/apps/api/src/common/security/security.util.js');

let app;
let baseUrl;

test.before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    const origin = req.headers.origin;
    if (isMutating && origin && !isAllowedOrigin(origin, process.env.CORS_ORIGIN)) {
      return res.status(403).json({ statusCode: 403, message: 'CSRF protection: untrusted Origin header' });
    }
    return next();
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(0);
  const addr = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${addr.port}/api`;
});

test.after(async () => {
  if (app) await app.close();
});

test('Integration: GET /api/health returns 200 with security headers and X-Request-Id', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.ok(res.headers.get('x-request-id'));
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, '67movies-api');
});

test('Integration: Proxy SSRF protection blocks localhost and AWS metadata URLs', async () => {
  const res1 = await fetch(
    `${baseUrl}/proxy/hls?url=${encodeURIComponent('http://169.254.169.254/latest/meta-data/')}`,
  );
  assert.equal(res1.status, 403);

  const res2 = await fetch(
    `${baseUrl}/proxy/segment?url=${encodeURIComponent('http://127.0.0.1:4000/api/health')}`,
  );
  assert.equal(res2.status, 403);
});

test('Integration: CSRF protection blocks mutating request from untrusted Origin', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://evil-attacker-site.example',
    },
    body: JSON.stringify({ email: 'a@b.com', password: 'Password123!' }),
  });
  assert.equal(res.status, 403);
});

test('Integration: Auth register/login/me and server-side RBAC enforcement', async () => {
  const uniq = Date.now();
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'AuditUser',
      email: `audit_${uniq}@example.com`,
      password: 'AuditPassword123!',
    }),
  });
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  assert.ok(regData.accessToken);

  // Regular USER must be denied access to /admin/* and /health/metrics
  const deniedStats = await fetch(`${baseUrl}/admin/stats`, {
    headers: { Authorization: `Bearer ${regData.accessToken}` },
  });
  assert.equal(deniedStats.status, 403);

  const deniedMetrics = await fetch(`${baseUrl}/health/metrics`, {
    headers: { Authorization: `Bearer ${regData.accessToken}` },
  });
  assert.equal(deniedMetrics.status, 403);

  // Unauthenticated access returns 401
  const unauth = await fetch(`${baseUrl}/admin/users`);
  assert.equal(unauth.status, 401);
});

test('Integration: Rate limiter enforces 429 Too Many Requests on auth brute-force', async () => {
  let got429 = false;
  for (let i = 0; i < 16; i++) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.55',
      },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
    });
    if (res.status === 429) {
      got429 = true;
      assert.ok(res.headers.get('retry-after'));
      break;
    }
  }
  assert.equal(got429, true, 'Expected 429 Too Many Requests after exceeding auth rate limit');
});
