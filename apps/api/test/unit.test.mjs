import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isSafeExternalUrl,
  sanitizeProxyHeaders,
  sanitizeText,
  isAllowedOrigin,
  validateNickname,
} = require('../dist/apps/api/src/common/security/security.util.js');
const { AppCacheService } = require('../dist/apps/api/src/common/cache/cache.service.js');
const { MetricsService } = require('../dist/apps/api/src/common/monitoring/metrics.service.js');
const {
  hashPassword,
  verifyPassword,
} = require('../dist/apps/api/src/modules/auth/password.util.js');
const {
  parsePrefixedMediaId,
  normalizeTitle,
  stripHtml,
  isValidPosterUrl,
  mergeAndDeduplicateMedia,
} = require('../dist/apps/api/src/modules/media/media-aggregator.util.js');

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

test('Unit: Multi-source ID parser routes kp/mal/tvmaze/omdb/tmdb prefixes', () => {
  assert.deepEqual(parsePrefixedMediaId('kp-435'), { provider: 'kinopoisk', rawId: '435' });
  assert.deepEqual(parsePrefixedMediaId('mal-16498'), { provider: 'anime', rawId: '16498' });
  assert.deepEqual(parsePrefixedMediaId('tvmaze-82'), { provider: 'tvmaze', rawId: '82' });
  assert.deepEqual(parsePrefixedMediaId('omdb-tt0133093'), { provider: 'omdb', rawId: 'tt0133093' });
  assert.deepEqual(parsePrefixedMediaId('tt0133093'), { provider: 'omdb', rawId: 'tt0133093' });
  assert.deepEqual(parsePrefixedMediaId('693134'), { provider: 'tmdb', rawId: '693134' });
  assert.deepEqual(parsePrefixedMediaId('al-10306'), { provider: 'aniliberty', rawId: '10306' });
});

test('Unit: AniLiberty provider maps catalog/release payloads and builds HLS stream groups offline', async () => {
  const { AniLibertyProviderService } = require('../dist/apps/api/src/modules/media/providers/aniliberty.provider.js');
  const release = {
    id: 777,
    type: { value: 'TV' },
    year: 2024,
    name: { main: 'Тестовое аниме', english: 'Test Anime' },
    poster: { src: '/storage/releases/posters/777/p.jpg' },
    mal: { id: 55, rating: 8.1, votes: 1000 },
    age_rating: { label: '16+' },
    is_ongoing: true,
    episodes_total: 12,
    genres: [{ id: 15, name: 'Боевые искусства' }],
    description: 'Описание\r\nтест',
    members: [
      { nickname: 'Voicer', role: { value: 'voicing', description: 'Озвучка' } },
      { nickname: 'Timer', role: { value: 'timing', description: 'Тайминг' } },
    ],
    episodes: [
      { id: 'e1', ordinal: 1, name: 'Первая', duration: 1440, hls_480: 'https://x/480.m3u8', hls_720: 'https://x/720.m3u8', hls_1080: 'https://x/1080.m3u8' },
      { id: 'e2', ordinal: 2, name: null, duration: 1440, hls_480: 'https://x/2-480.m3u8', hls_720: null, hls_1080: null },
    ],
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    const body = u.includes('/anime/releases/777') ? { data: release } : { data: [release], meta: { pagination: { total: 1, current_page: 1, total_pages: 1 } } };
    return { ok: true, status: 200, json: async () => body };
  };
  try {
    const mem = new Map();
    const svc = new AniLibertyProviderService(
      { get: (_k, d) => d },
      { get: async (k) => mem.get(k) || null, set: async (k, v) => mem.set(k, v) },
    );

    const cat = await svc.getCatalog({ page: 1, search: 'тест', genreId: 15 });
    assert.equal(cat.items.length, 1);
    assert.equal(cat.items[0].id, 'al-777');
    assert.equal(cat.items[0].source, 'aniliberty');
    assert.equal(cat.items[0].posterPath, 'https://api.anilibria.app/storage/releases/posters/777/p.jpg');
    assert.equal(cat.items[0].voteAverage, 8.1);

    const detail = await svc.getDetails(777);
    assert.equal(detail.seasons[0].episodes.length, 2);
    assert.equal(detail.voiceovers.length, 2);

    const groups = await svc.getStreams(777, 1);
    assert.equal(groups.length, 7);
    assert.deepEqual(groups[0].streams.map((s) => s.quality), ['1080p', '720p']);
    assert.equal(groups[0].streams[0].format, 'hls');
    assert.match(groups[0].voiceActing, /Voicer/);

    const ep2 = await svc.getStreams(777, 2);
    assert.deepEqual(ep2[0].streams.map((s) => s.quality), ['720p']);
    assert.deepEqual(await svc.getStreams(777, 99), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Unit: Multi-source aggregator deduplicates by ID/title+year and enriches metadata', () => {
  assert.equal(normalizeTitle('Ёлки: Новые!'), 'елки новые');
  assert.equal(stripHtml('<p>Hello <b>world</b>&nbsp;!</p>'), 'Hello world !');

  const tmdb = [
    {
      id: '693134',
      tmdbId: 693134,
      source: 'tmdb',
      type: 'movie',
      title: 'Дюна: Часть вторая',
      originalTitle: 'Dune: Part Two',
      overview: 'Описание фильма временно отсутствует.',
      releaseYear: 2024,
      voteAverage: 8.6,
      genres: [],
    },
  ];

  const kp = [
    // Duplicate of TMDB movie by tmdbId -> should enrich kinopoiskId + overview, not duplicate
    {
      id: 'kp-4540126',
      tmdbId: 693134,
      kinopoiskId: 4540126,
      imdbId: 'tt15239678',
      source: 'kinopoisk',
      type: 'movie',
      title: 'Дюна: Часть вторая',
      overview: 'Пол Атрейдес объединяется с Чани и фременами.',
      releaseYear: 2024,
      voteAverage: 8.5,
      genres: [{ id: 9000, name: 'Фантастика' }],
    },
    // Unique Russian movie only on Kinopoisk -> should be added!
    {
      id: 'kp-41519',
      kinopoiskId: 41519,
      source: 'kinopoisk',
      type: 'movie',
      title: 'Брат',
      originalTitle: 'Брат',
      overview: 'Демобилизованный из армии Данила Багров возвращается в родной городок.',
      posterPath: 'https://st.kp.yandex.net/images/film_big/41519.jpg',
      releaseYear: 1997,
      voteAverage: 8.3,
      genres: [{ id: 9001, name: 'Драма' }],
    },
  ];

  const omdb = [
    // Duplicate of Dune via imdbId -> should not duplicate
    {
      id: 'omdb-tt15239678',
      imdbId: 'tt15239678',
      source: 'omdb',
      type: 'movie',
      title: 'Dune: Part Two',
      overview: 'English plot',
      releaseYear: 2024,
      voteAverage: 8.5,
      genres: [],
    },
  ];

  const merged = mergeAndDeduplicateMedia(tmdb, [kp, omdb]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, '693134');
  assert.equal(merged[0].kinopoiskId, 4540126);
  assert.equal(merged[0].imdbId, 'tt15239678');
  assert.equal(merged[0].overview, 'Пол Атрейдес объединяется с Чани и фременами.');
  assert.equal(merged[1].id, 'kp-41519');
  assert.equal(merged[1].title, 'Брат');
});

test('Unit: Poster URL validator rejects broken hotlink/placeholder URLs and filters posterless items when required', () => {
  assert.equal(isValidPosterUrl('https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498.jpg'), true);
  assert.equal(isValidPosterUrl('https://image.tmdb.org/t/p/w500/abc.jpg'), true);
  assert.equal(isValidPosterUrl('https://shikimori.one/system/animes/original/16498.jpg'), false);
  assert.equal(isValidPosterUrl('https://kinopoiskapiunofficial.tech/images/posters/kp/no-poster.gif'), false);
  assert.equal(isValidPosterUrl(null), false);

  const filtered = mergeAndDeduplicateMedia(
    [
      {
        id: 'mal-1',
        malId: 1,
        type: 'tv',
        title: 'Broken Poster Anime',
        overview: 'test',
        posterPath: 'https://shikimori.one/system/animes/original/1.jpg',
        releaseYear: 2020,
        voteAverage: 8.0,
        genres: [],
      },
      {
        id: 'mal-2',
        malId: 2,
        type: 'tv',
        title: 'Valid Poster Anime',
        overview: 'test',
        posterPath: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2.jpg',
        releaseYear: 2021,
        voteAverage: 8.5,
        genres: [],
      },
    ],
    [],
    { requirePoster: true },
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'mal-2');
});

test('Unit: Nickname censorship blocks Russian/English profanity, leetspeak, and reserved names', () => {
  assert.equal(validateNickname('AlexCinema'), null);
  assert.equal(validateNickname('Киноман_2026'), null);
  assert.equal(validateNickname('A'), 'Никнейм должен содержать минимум 2 символа');
  assert.equal(validateNickname('user@mail.ru'), 'Никнейм не может содержать символ @');
  assert.notEqual(validateNickname('сука123'), null);
  assert.notEqual(validateNickname('х_у_й'), null);
  assert.notEqual(validateNickname('f.u.c.k_you'), null);
  assert.notEqual(validateNickname('SuperAdmin'), null);
  assert.notEqual(validateNickname('Админ сайта'), null);
});
