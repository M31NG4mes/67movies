import { NextRequest, NextResponse } from 'next/server';
import { StreamSourceGroup } from '@cinemaflow/types';

export const dynamic = 'force-dynamic';

const ANILIBERTY_BASE = 'https://api.anilibria.app';
const KODIK_TOKENS = [
  process.env.KODIK_API_TOKEN || '',
  'b7cc4293ed475c4ad1fd599d114f4435',
  '447d179e875efe44217f20d1ee2146be',
  'a0457eb45312af80bbb9f3f33a3e946d',
  '9a336281c5914392f202d111a26c192f',
].filter(Boolean);

function normalizeStudioId(name: string): string {
  const lower = name.toLowerCase();
  if (/студийная банда|studio\s*band/i.test(lower)) return 'studioband';
  if (/anilibria|анилибрия|aniliberty/i.test(lower)) return 'aniliberty';
  if (/anidub|анидаб/i.test(lower)) return 'anidub';
  if (/dream\s*cast|дримкаст/i.test(lower)) return 'dreamcast';
  if (/jam\s*club|джем/i.test(lower)) return 'jamclub';
  if (/shiza/i.test(lower)) return 'shiza';
  if (/animevost|анимевост/i.test(lower)) return 'animevost';
  return lower.replace(/[^a-zа-я0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'voice';
}

async function fetchAniLibertyRelease(params: {
  anilibertyId?: number;
  malId?: number;
  title?: string;
  originalTitle?: string;
}): Promise<any | null> {
  if (params.anilibertyId) {
    try {
      const res = await fetch(
        `${ANILIBERTY_BASE}/api/v1/anime/releases/${params.anilibertyId}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const raw: any = await res.json();
        const r = raw?.data || raw;
        if (r?.id) return r;
      }
    } catch {}
  }

  const queries = [params.title, params.originalTitle]
    .map((q) => (q || '').trim())
    .filter(Boolean);

  for (const q of queries) {
    try {
      const sp = new URLSearchParams({ page: '1', limit: '8', 'f[search]': q });
      const res = await fetch(
        `${ANILIBERTY_BASE}/api/v1/anime/catalog/releases?${sp.toString()}`,
        { cache: 'no-store' }
      );
      if (!res.ok) continue;
      const json: any = await res.json();
      const list: any[] = Array.isArray(json?.data) ? json.data : [];
      if (list.length === 0) continue;

      const hit =
        (params.malId
          ? list.find(
              (r) =>
                Number(r?.mal?.id) === params.malId ||
                Number(r?.shikimori?.id) === params.malId
            )
          : undefined) || list[0];

      if (hit?.id) {
        const detailRes = await fetch(
          `${ANILIBERTY_BASE}/api/v1/anime/releases/${hit.id}`,
          { cache: 'no-store' }
        );
        if (detailRes.ok) {
          const detailRaw: any = await detailRes.json();
          return detailRaw?.data || detailRaw;
        }
      }
    } catch {}
  }
  return null;
}

async function fetchKodikTranslations(params: {
  malId?: number;
  title?: string;
  originalTitle?: string;
  episode: number;
}): Promise<StreamSourceGroup[]> {
  const groups: StreamSourceGroup[] = [];
  const seenStudios = new Set<string>();

  for (const token of KODIK_TOKENS) {
    try {
      const searchAttempts: URLSearchParams[] = [];

      if (params.malId) {
        searchAttempts.push(
          new URLSearchParams({
            token,
            shikimori_id: String(params.malId),
            with_episodes: 'true',
          })
        );
      }

      const searchTitle = (params.originalTitle || params.title || '').trim();
      if (searchTitle) {
        searchAttempts.push(
          new URLSearchParams({
            token,
            title: searchTitle,
            with_episodes: 'true',
            types: 'anime-serial,anime',
            limit: '25',
          })
        );
      }

      if (params.title && params.title !== searchTitle) {
        searchAttempts.push(
          new URLSearchParams({
            token,
            title: params.title.trim(),
            with_episodes: 'true',
            types: 'anime-serial,anime',
            limit: '25',
          })
        );
      }

      for (const sp of searchAttempts) {
        const res = await fetch(`https://kodikapi.com/search?${sp.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) continue;
        const data: any = await res.json();
        const results: any[] = Array.isArray(data?.results) ? data.results : [];
        if (results.length === 0) continue;

        for (const item of results) {
          const studioTitle = String(
            item?.translation?.title || 'Озвучка'
          ).trim();
          const trType = item?.translation?.type === 'subtitles' ? 'Субтитры' : 'Озвучка';
          const studioId = `${normalizeStudioId(studioTitle)}_${item?.translation?.id || ''}`.replace(
            /_+$/,
            ''
          );

          if (seenStudios.has(studioTitle.toLowerCase())) continue;

          // Locate episode embed link
          let epLink: string | null = null;
          const epKey = String(params.episode);

          if (item?.seasons && typeof item.seasons === 'object') {
            for (const sKey of Object.keys(item.seasons)) {
              const seasonObj = item.seasons[sKey];
              if (seasonObj?.episodes && seasonObj.episodes[epKey]) {
                const rawEp = seasonObj.episodes[epKey];
                epLink = typeof rawEp === 'string' ? rawEp : rawEp?.link || null;
                if (epLink) break;
              }
            }
          }

          if (!epLink && params.episode === 1 && typeof item?.link === 'string') {
            epLink = item.link;
          }

          if (!epLink) continue;

          const fullEmbedLink = epLink.startsWith('//')
            ? `https:${epLink}`
            : epLink.replace(/^http:\/\//i, 'https://');

          seenStudios.add(studioTitle.toLowerCase());
          const label = `${studioTitle} (${trType})`;

          groups.push({
            providerId: normalizeStudioId(studioTitle),
            providerName: studioTitle,
            voiceActing: label,
            streams: [
              {
                id: `kodik-${studioId}-e${params.episode}-1080p`,
                providerId: normalizeStudioId(studioTitle),
                providerName: studioTitle,
                title: `Серия ${params.episode}`,
                voiceActing: label,
                season: 1,
                episode: params.episode,
                quality: '1080p',
                format: 'hls',
                streamUrl: `/api/stream?kodikLink=${encodeURIComponent(fullEmbedLink)}&quality=1080`,
                audioTracks: [{ id: '0', language: 'ru', label, isDefault: true }],
              },
              {
                id: `kodik-${studioId}-e${params.episode}-720p`,
                providerId: normalizeStudioId(studioTitle),
                providerName: studioTitle,
                title: `Серия ${params.episode}`,
                voiceActing: label,
                season: 1,
                episode: params.episode,
                quality: '720p',
                format: 'hls',
                streamUrl: `/api/stream?kodikLink=${encodeURIComponent(fullEmbedLink)}&quality=720`,
                audioTracks: [{ id: '0', language: 'ru', label, isDefault: true }],
              },
            ],
          });
        }

        if (groups.length > 0) {
          return groups;
        }
      }
    } catch {
      // try next token
    }
  }

  return groups;
}

async function fetchAnimeVostGroup(params: {
  title?: string;
  originalTitle?: string;
  episode: number;
}): Promise<StreamSourceGroup | null> {
  const candidates = [params.title, params.originalTitle]
    .map((q) =>
      String(q || '')
        .split(/[:—–-]/)[0]
        .trim()
    )
    .filter((q) => q.length >= 3);

  for (const query of candidates) {
    try {
      const searchRes = await fetch('https://api.animevost.org/v1/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ name: query }).toString(),
        cache: 'no-store',
      });
      if (!searchRes.ok) continue;
      const searchJson: any = await searchRes.json();
      const items: any[] = Array.isArray(searchJson?.data) ? searchJson.data : [];
      if (items.length === 0 || !items[0]?.id) continue;

      const vostId = items[0].id;
      const plRes = await fetch('https://api.animevost.org/v1/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id: String(vostId) }).toString(),
        cache: 'no-store',
      });
      if (!plRes.ok) continue;
      const plJson: any = await plRes.json();
      const playlist: any[] = Array.isArray(plJson)
        ? plJson
        : Array.isArray(plJson?.data?.playlist)
        ? plJson.data.playlist
        : [];
      if (playlist.length === 0) continue;

      const epRegex = new RegExp(`(^|\\D)${params.episode}(\\D|$)`);
      const matchedEp =
        playlist.find((p) => epRegex.test(String(p?.name || ''))) ||
        playlist[params.episode - 1] ||
        playlist[0];

      const hdUrl = matchedEp?.hd || matchedEp?.std;
      const stdUrl = matchedEp?.std || matchedEp?.hd;
      if (!hdUrl) continue;

      const safeHd = String(hdUrl).replace(/^http:\/\//i, 'https://');
      const safeStd = String(stdUrl).replace(/^http:\/\//i, 'https://');

      return {
        providerId: 'animevost',
        providerName: 'AnimeVost',
        voiceActing: 'AnimeVost (Официальная озвучка)',
        streams: [
          {
            id: `vost-${vostId}-e${params.episode}-1080p`,
            providerId: 'animevost',
            providerName: 'AnimeVost',
            title: matchedEp?.name || `Серия ${params.episode}`,
            voiceActing: 'AnimeVost (Официальная озвучка)',
            season: 1,
            episode: params.episode,
            quality: '1080p',
            format: safeHd.includes('.m3u8') ? 'hls' : 'mp4',
            streamUrl: safeHd,
            audioTracks: [
              { id: '0', language: 'ru', label: 'AnimeVost', isDefault: true },
            ],
          },
          {
            id: `vost-${vostId}-e${params.episode}-720p`,
            providerId: 'animevost',
            providerName: 'AnimeVost',
            title: matchedEp?.name || `Серия ${params.episode}`,
            voiceActing: 'AnimeVost (Официальная озвучка)',
            season: 1,
            episode: params.episode,
            quality: '720p',
            format: safeStd.includes('.m3u8') ? 'hls' : 'mp4',
            streamUrl: safeStd,
            audioTracks: [
              { id: '0', language: 'ru', label: 'AnimeVost', isDefault: true },
            ],
          },
        ],
      };
    } catch {}
  }
  return null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawId = sp.get('id') || '';
  const episode = Math.max(1, parseInt(sp.get('episode') || '1', 10) || 1);
  const title = sp.get('title') || undefined;
  const originalTitle = sp.get('originalTitle') || undefined;
  const malIdParam = sp.get('malId') ? Number(sp.get('malId')) || undefined : undefined;
  const alIdParam = sp.get('anilibertyId')
    ? Number(sp.get('anilibertyId')) || undefined
    : /^al-(\d+)$/i.test(rawId)
    ? Number(rawId.slice(3))
    : undefined;

  const [alRelease, kodikGroups, vostGroup] = await Promise.all([
    fetchAniLibertyRelease({
      anilibertyId: alIdParam,
      malId: malIdParam,
      title,
      originalTitle,
    }),
    fetchKodikTranslations({
      malId: malIdParam,
      title,
      originalTitle,
      episode,
    }),
    fetchAnimeVostGroup({
      title,
      originalTitle,
      episode,
    }),
  ]);

  const groups: StreamSourceGroup[] = [];

  // 1. Official AniLibria HLS stream
  if (alRelease && Array.isArray(alRelease.episodes)) {
    const eps: any[] = alRelease.episodes;
    const ep =
      eps.find((e) => Number(e?.ordinal) === episode) ||
      (eps.length === 1 ? eps[0] : eps[0] || null);

    if (ep) {
      const team = Array.isArray(alRelease.members)
        ? alRelease.members
            .filter(
              (m: any) =>
                m?.nickname &&
                /озвуч|voic/i.test(String(m?.role?.description || m?.role?.value || ''))
            )
            .map((m: any) => String(m.nickname))
        : [];
      const primaryVoice =
        team.length > 0 ? `AniLibria (${team.slice(0, 3).join(', ')})` : 'AniLibria';

      const hdLevels: Array<[string, '1080p' | '720p']> = [
        ['hls_1080', '1080p'],
        ['hls_720', '720p'],
      ];
      const activeLevels: Array<[string, '1080p' | '720p']> = hdLevels.some(
        ([f]) => typeof ep[f] === 'string' && ep[f]
      )
        ? hdLevels
        : [
            ['hls_1080', '1080p'],
            ['hls_720', '720p'],
            ['hls_480', '720p'],
          ];

      const alStreams = activeLevels
        .filter(([f]) => typeof ep[f] === 'string' && ep[f])
        .map(([f, quality]) => ({
          id: `al-${alRelease.id}-e${ep.ordinal}-aniliberty-${quality}`,
          providerId: 'aniliberty',
          providerName: 'AniLibria',
          title: ep.name || `Серия ${ep.ordinal}`,
          voiceActing: primaryVoice,
          season: 1,
          episode: Number(ep.ordinal),
          quality,
          format: 'hls' as const,
          streamUrl: String(ep[f]).replace(/^http:\/\//i, 'https://'),
          audioTracks: [{ id: '0', language: 'ru', label: primaryVoice, isDefault: true }],
        }));

      if (alStreams.length > 0) {
        groups.push({
          providerId: 'aniliberty',
          providerName: 'AniLibria',
          voiceActing: primaryVoice,
          streams: alStreams,
        });
      }
    }
  }

  // 2. Real distinct voiceovers from Kodik (Студийная Банда, AniDUB, Dream Cast, SHIZA Project, Jam Club, etc.)
  for (const kg of kodikGroups) {
    // Avoid duplicating AniLibria if official AniLiberty stream is already present
    if (
      kg.providerId === 'aniliberty' &&
      groups.some((g) => g.providerId === 'aniliberty')
    ) {
      continue;
    }
    groups.push(kg);
  }

  // 3. Direct AnimeVost voiceover stream if not already in list
  if (vostGroup && !groups.some((g) => g.providerId === 'animevost')) {
    groups.push(vostGroup);
  }

  return NextResponse.json({ groups });
}
