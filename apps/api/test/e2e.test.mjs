import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.NODE_ENV = 'test';
process.env.USE_IN_MEMORY_DB = 'true';
process.env.RATE_LIMIT_AUTH_MAX = '100';
process.env.RATE_LIMIT_MAX = '500';

const require = createRequire(import.meta.url);
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/apps/api/src/app.module.js');
const { AllExceptionsFilter } = require('../dist/apps/api/src/common/filters/http-exception.filter.js');

let app;
let baseUrl;

async function apiReq(path, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test.before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
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

test('E2E Scenario: Full multi-user flow (Auth -> Friends -> Chat + Typing + XSS -> Collections -> Admin/Moderator RBAC)', async () => {
  const tag = Date.now();

  // 1. Register User A and User B
  const userA = await apiReq('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Alice', email: `alice_${tag}@test.local`, password: 'Password123!' }),
  });
  assert.equal(userA.status, 201);

  const userB = await apiReq('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bob', email: `bob_${tag}@test.local`, password: 'Password123!' }),
  });
  assert.equal(userB.status, 201);

  const tokenA = userA.data.accessToken;
  const tokenB = userB.data.accessToken;
  const idA = userA.data.user.id;
  const idB = userB.data.user.id;

  // 2. Friends flow: Alice adds Bob -> Bob accepts
  const reqFriend = await apiReq(
    '/social/friends/request',
    { method: 'POST', body: JSON.stringify({ email: `bob_${tag}@test.local` }) },
    tokenA,
  );
  assert.equal(reqFriend.status, 201);

  const accept = await apiReq(
    `/social/friends/${reqFriend.data.id}/accept`,
    { method: 'POST' },
    tokenB,
  );
  assert.equal(accept.status, 201);

  // 3. Chat flow: Typing indicator + Movie card + XSS sanitization
  const typingRes = await apiReq(`/social/messages/${idB}/typing`, { method: 'POST' }, tokenA);
  assert.equal(typingRes.status, 201);

  const threadBefore = await apiReq(`/social/messages/${idA}`, {}, tokenB);
  assert.equal(threadBefore.status, 200);
  assert.equal(threadBefore.data.isFriendTyping, true);

  const sendMsg = await apiReq(
    `/social/messages/${idB}`,
    {
      method: 'POST',
      body: JSON.stringify({
        content: '<script>alert(1)</script>Глянь этот фильм!',
        movieTmdbId: 693134,
        movieMediaType: 'MOVIE',
        movieTitle: 'Дюна: Часть вторая',
      }),
    },
    tokenA,
  );
  assert.equal(sendMsg.status, 201);
  assert.equal(sendMsg.data.content, 'Глянь этот фильм!'); // XSS stripped!
  assert.equal(sendMsg.data.movieTmdbId, 693134);

  const threadAfter = await apiReq(`/social/messages/${idA}`, {}, tokenB);
  assert.equal(threadAfter.status, 200);
  assert.equal(threadAfter.data.messages.length, 1);
  assert.equal(threadAfter.data.messages[0].isRead, true);

  // 4. Collections & Public Showcase flow
  const col = await apiReq(
    '/social/collections',
    { method: 'POST', body: JSON.stringify({ title: 'Топ фантастики', isPublic: true }) },
    tokenA,
  );
  assert.equal(col.status, 201);

  const addColItem = await apiReq(
    `/social/collections/${col.data.id}/items`,
    {
      method: 'POST',
      body: JSON.stringify({ tmdbId: 693134, mediaType: 'MOVIE', title: 'Дюна 2' }),
    },
    tokenA,
  );
  assert.equal(addColItem.status, 201);

  const showcase = await apiReq(`/social/users/${idA}/profile`);
  assert.equal(showcase.status, 200);
  assert.equal(showcase.data.collections.length >= 1, true);

  // 5. Admin & Moderator Server-Side RBAC
  // Ensure Alice can become admin if none exists (or skip bootstrap check if local store had one)
  const accessA = await apiReq('/admin/access', {}, tokenA);
  if (accessA.data.canBootstrapAdmin) {
    const boot = await apiReq('/admin/bootstrap', { method: 'POST' }, tokenA);
    assert.equal(boot.status, 201);
    assert.equal(boot.data.user.role, 'ADMIN');

    // Second bootstrap by Bob MUST fail with 403
    const bootB = await apiReq('/admin/bootstrap', { method: 'POST' }, tokenB);
    assert.equal(bootB.status, 403);

    // Admin promotes Bob to MODERATOR
    const promoteB = await apiReq(
      `/admin/users/${idB}`,
      { method: 'PATCH', body: JSON.stringify({ role: 'MODERATOR' }) },
      tokenA,
    );
    assert.equal(promoteB.status, 200);
    assert.equal(promoteB.data.role, 'MODERATOR');

    // Moderator can view dashboard stats (200)
    const modStats = await apiReq('/admin/stats', {}, tokenB);
    assert.equal(modStats.status, 200);

    // Moderator MUST be blocked (403) from editing global site settings
    const modSettingsDenied = await apiReq(
      '/admin/site-settings',
      { method: 'PATCH', body: JSON.stringify({ siteName: 'Hacked' }) },
      tokenB,
    );
    assert.equal(modSettingsDenied.status, 403);

    // Admin CAN update global site settings (200)
    const adminSettingsOk = await apiReq(
      '/admin/site-settings',
      { method: 'PATCH', body: JSON.stringify({ siteName: '67movies Verified' }) },
      tokenA,
    );
    assert.equal(adminSettingsOk.status, 200);
    assert.equal(adminSettingsOk.data.siteName, '67movies Verified');
  }
});
