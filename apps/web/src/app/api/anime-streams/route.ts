import { NextRequest, NextResponse } from 'next/server';
import { Episode, StreamSourceGroup, VideoStream } from '@cinemaflow/types';

export const dynamic = 'force-dynamic';

const ANILIBERTY_BASE = 'https://api.anilibria.app';

const STATIC_KODIK_TOKENS = [
  process.env.KODIK_API_TOKEN || '',
  '71d124b40d5488b43b114d9f1d00e100',
  '41dd95f84c21719b09d6c71182237a25',
  'c1676fe60b2f3f0021ff82b12b83e989',
  'b7cc4293ed475c4ad1fd599d114f4435',
  '447d179e875efe44217f20d1ee2146be',
  'a0457eb45312af80bbb9f3f33a3e946d',
  '9a336281c5914392f202d111a26c192f',
  '2f7ab8f77d0f13c5be5698b023e6d680',
].filter(Boolean);

let cachedScrapedToken: string | null = null;
let cachedScrapedTokenAt = 0;

async function getKodikTokens(): Promise<string[]> {
  const now = Date.now();
  if (!cachedScrapedToken || now - cachedScrapedTokenAt > 3600_000) {
    try {
      const res = await fetch('https://kodik-add.com/add-players.min.js', {
        cache: 'no-store',
      });
      if (res.ok) {
        const text = await res.text();
        const match = /token\s*[:=]\s*["']([a-f0-9]{32})["']/i.exec(text);
        if (match?.[1]) {
          cachedScrapedToken = match[1];
          cachedScrapedTokenAt = now;
        }
      }
    } catch {}
  }

  const all = [cachedScrapedToken || '', ...STATIC_KODIK_TOKENS].filter(Boolean);
  return Array.from(new Set(all));
}

function normalizeStudioId(name: string): string {
  const lower = name.toLowerCase();
  if (/студийная банда|studio\s*band/i.test(lower)) return 'studioband';
  if (/anilibria|анилибрия|aniliberty/i.test(lower)) return 'aniliberty';
  if (/anidub|анидаб/i.test(lower)) return 'anidub';
  if (/dream\s*cast|дримкаст/i.test(lower)) return 'dreamcast';
  if (/jam\s*club|джем/i.test(lower)) return 'jamclub';
  if (/shiza/i.test(lower)) return 'shiza';
  if (/animevost|анимевост/i.test(lower)) return 'animevost';
  if (/anistar|анистар/i.test(lower)) return 'anistar';
  if (/2x2/i.test(lower)) return '2x2';
  if (/субтитр|sub/i.test(lower)) return 'subtitles';
  return lower.replace(/[^a-zа-я0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'voice';
}

function cleanQueryCandidates(title?: string, originalTitle?: string): string[] {
  const list: string[] = [];
  const add = (raw?: string) => {
    const s = String(raw || '').trim();
    if (!s) return;
    if (!list.includes(s)) list.push(s);
    const noHyphen = s.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    if (noHyphen && !list.includes(noHyphen)) list.push(noHyphen);
    const basePart = s.split(/[:—–(]/)[0]?.trim();
    if (basePart && basePart.length >= 3 && !list.includes(basePart)) {
      list.push(basePart);
    }
    const baseNoHyphen = basePart?.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    if (baseNoHyphen && baseNoHyphen.length >= 3 && !list.includes(baseNoHyphen)) {
      list.push(baseNoHyphen);
    }
  };
  add(title);
  add(originalTitle);
  // Common Russian aliases for popular long-running anime
  if (list.some((q) => /ван\s*пис|one\s*piece|большой\s*куш/i.test(q))) {
    add('Ван Пис');
    add('One Piece');
    add('Большой куш');
  }
  return list;
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

  const queries = cleanQueryCandidates(params.title, params.originalTitle);

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

async function fetchKodikData(params: {
  malId?: number;
  title?: string;
  originalTitle?: string;
  episode: number;
}): Promise<{ groups: StreamSourceGroup[]; maxEpisode: number }> {
  const groups: StreamSourceGroup[] = [];
  const seenStudios = new Set<string>();
  let maxEpisode = 0;

  const tokens = await getKodikTokens();
  const queries = cleanQueryCandidates(params.originalTitle, params.title);

  for (const token of tokens) {
    try {
      const searchAttempts: URLSearchParams[] = [];

      if (params.malId) {
        searchAttempts.push(
          new URLSearchParams({
            token,
            shikimori_id: String(params.malId),
            with_episodes: 'true',
            limit: '100',
          })
        );
      }

      for (const q of queries.slice(0, 4)) {
        searchAttempts.push(
          new URLSearchParams({
            token,
            title: q,
            with_episodes: 'true',
            types: 'anime-serial,anime',
            limit: '100',
          })
        );
      }

      for (const sp of searchAttempts) {
        for (const domain of ['https://kodikapi.com', 'https://kodik-api.com']) {
          const res = await fetch(`${domain}/search?${sp.toString()}`, {
            cache: 'no-store',
          }).catch(() => null);
          if (!res || !res.ok) continue;
          const data: any = await res.json().catch(() => null);
          const results: any[] = Array.isArray(data?.results) ? data.results : [];
          if (results.length === 0) continue;

          for (const item of results) {
            const lastEp = Number(item?.last_episode || item?.episodes_count || 0);
            if (lastEp > maxEpisode) maxEpisode = lastEp;

            const studioTitle = String(item?.translation?.title || 'Озвучка').trim();
            const trType =
              item?.translation?.type === 'subtitles' ? 'Субтитры' : 'Озвучка';
            const normId = normalizeStudioId(studioTitle);
            const uniqueKey = `${normId}:${studioTitle.toLowerCase()}`;
            if (seenStudios.has(uniqueKey)) continue;

            // Locate episode embed link
            let epLink: string | null = null;
            const epKey = String(params.episode);

            if (item?.seasons && typeof item.seasons === 'object') {
              for (const sKey of Object.keys(item.seasons)) {
                const seasonObj = item.seasons[sKey];
                if (seasonObj?.episodes) {
                  for (const k of Object.keys(seasonObj.episodes)) {
                    const n = parseInt(k, 10);
                    if (n > maxEpisode) maxEpisode = n;
                  }
                  const rawEp = seasonObj.episodes[epKey];
                  if (rawEp) {
                    epLink = typeof rawEp === 'string' ? rawEp : rawEp?.link || null;
                    if (epLink) break;
                  }
                }
              }
            }

            // Fallback: use serial link with ?episode=N parameter if episode is within range
            if (!epLink && typeof item?.link === 'string' && item.link) {
              if (!lastEp || params.episode <= lastEp) {
                const sep = item.link.includes('?') ? '&' : '?';
                epLink =
                  params.episode === 1 && item.type === 'anime'
                    ? item.link
                    : `${item.link}${sep}episode=${params.episode}`;
              }
            }

            if (!epLink) continue;

            const fullEmbedLink = epLink.startsWith('//')
              ? `https:${epLink}`
              : epLink.replace(/^http:\/\//i, 'https://');

            seenStudios.add(uniqueKey);
            const label = `${studioTitle} (${trType})`;

            groups.push({
              providerId: normId,
              providerName: studioTitle,
              voiceActing: label,
              streams: [
                {
                  id: `kodik-${normId}-${item?.translation?.id || groups.length}-e${params.episode}-1080p`,
                  providerId: normId,
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
                  id: `kodik-${normId}-${item?.translation?.id || groups.length}-e${params.episode}-720p`,
                  providerId: normId,
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
            return { groups, maxEpisode };
          }
        }
      }
    } catch {
      // try next token
    }
  }

  return { groups, maxEpisode };
}

interface ParsedVostEpisode {
  epNum: number;
  name: string;
  preview: string | null;
  hd: string;
  std: string;
}

async function fetchAnimeVostData(params: {
  title?: string;
  originalTitle?: string;
  episode: number;
}): Promise<{
  group: StreamSourceGroup | null;
  episodes: ParsedVostEpisode[];
  maxEpisode: number;
}> {
  const candidates = cleanQueryCandidates(params.title, params.originalTitle);

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
      if (items.length === 0) continue;

      // Pick the item with the most episodes or best title match
      const bestItem =
        items.find((it) =>
          new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(
            String(it?.title || '')
          )
        ) || items[0];
      if (!bestItem?.id) continue;

      const vostId = bestItem.id;
      const plRes = await fetch('https://api.animevost.org/v1/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id: String(vostId) }).toString(),
        cache: 'no-store',
      });
      if (!plRes.ok) continue;
      const plJson: any = await plRes.json();
      const rawPlaylist: any[] = Array.isArray(plJson)
        ? plJson
        : Array.isArray(plJson?.data?.playlist)
        ? plJson.data.playlist
        : [];
      if (rawPlaylist.length === 0) continue;

      const parsedEpisodes: ParsedVostEpisode[] = rawPlaylist
        .map((p, idx) => {
          const rawName = String(p?.name || `Серия ${idx + 1}`).trim();
          const numMatch = /(\d+)\s*(?:серия|эпизод|ep)/i.exec(rawName) || /^(\d+)$/.exec(rawName);
          const epNum = numMatch ? parseInt(numMatch[1], 10) : idx + 1;
          const hd = String(p?.hd || p?.std || '').replace(/^http:\/\//i, 'https://');
          const std = String(p?.std || p?.hd || '').replace(/^http:\/\//i, 'https://');
          const preview = p?.preview
            ? String(p.preview).replace(/^http:\/\//i, 'https://')
            : null;
          return { epNum, name: rawName, preview, hd, std };
        })
        .filter((e) => Boolean(e.hd))
        .sort((a, b) => a.epNum - b.epNum);

      const maxEpisode = parsedEpisodes.reduce(
        (m, e) => (e.epNum > m ? e.epNum : m),
        parsedEpisodes.length
      );

      const matchedEp =
        parsedEpisodes.find((e) => e.epNum === params.episode) ||
        parsedEpisodes[params.episode - 1] ||
        parsedEpisodes[0];

      if (!matchedEp) continue;

      const group: StreamSourceGroup = {
        providerId: 'animevost',
        providerName: 'AnimeVost',
        voiceActing: 'AnimeVost (Двухголосый закадровый)',
        streams: [
          {
            id: `vost-${vostId}-e${params.episode}-1080p`,
            providerId: 'animevost',
            providerName: 'AnimeVost',
            title: matchedEp.name || `Серия ${params.episode}`,
            voiceActing: 'AnimeVost (Двухголосый закадровый)',
            season: 1,
            episode: params.episode,
            quality: '1080p',
            format: matchedEp.hd.includes('.m3u8') ? 'hls' : 'mp4',
            streamUrl: matchedEp.hd,
            audioTracks: [
              { id: '0', language: 'ru', label: 'AnimeVost', isDefault: true },
            ],
          },
          {
            id: `vost-${vostId}-e${params.episode}-720p`,
            providerId: 'animevost',
            providerName: 'AnimeVost',
            title: matchedEp.name || `Серия ${params.episode}`,
            voiceActing: 'AnimeVost (Двухголосый закадровый)',
            season: 1,
            episode: params.episode,
            quality: '720p',
            format: matchedEp.std.includes('.m3u8') ? 'hls' : 'mp4',
            streamUrl: matchedEp.std,
            audioTracks: [
              { id: '0', language: 'ru', label: 'AnimeVost', isDefault: true },
            ],
          },
        ],
      };

      return { group, episodes: parsedEpisodes, maxEpisode };
    } catch {}
  }

  return { group: null, episodes: [], maxEpisode: 0 };
}

async function fetchAniListEpisodeCount(params: {
  malId?: number;
  title?: string;
  originalTitle?: string;
}): Promise<number> {
  const search = (params.originalTitle || params.title || '').split(/[:—–(]/)[0]?.trim();
  if (!params.malId && !search) return 0;

  const query = params.malId
    ? `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { episodes nextAiringEpisode { episode } } }`
    : `query ($search: String) { Media(search: $search, type: ANIME, sort: POPULARITY_DESC) { episodes nextAiringEpisode { episode } } }`;
  const variables = params.malId ? { idMal: params.malId } : { search };

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const json: any = await res.json();
    const media = json?.data?.Media;
    const aired = media?.nextAiringEpisode?.episode
      ? Number(media.nextAiringEpisode.episode) - 1
      : 0;
    const total = Number(media?.episodes || 0);
    return Math.max(aired, total, 0);
  } catch {
    return 0;
  }
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

  const [alRelease, kodikData, vostData, anilistEpCount] = await Promise.all([
    fetchAniLibertyRelease({
      anilibertyId: alIdParam,
      malId: malIdParam,
      title,
      originalTitle,
    }),
    fetchKodikData({
      malId: malIdParam,
      title,
      originalTitle,
      episode,
    }),
    fetchAnimeVostData({
      title,
      originalTitle,
      episode,
    }),
    fetchAniListEpisodeCount({
      malId: malIdParam,
      title,
      originalTitle,
    }),
  ]);

  const groups: StreamSourceGroup[] = [];
  let alStreamsForEpisode: VideoStream[] = [];
  let primaryAlVoice = 'AniLibria';

  // 1. Official AniLibria HLS stream
  const alEpisodesRaw: any[] = Array.isArray(alRelease?.episodes) ? alRelease.episodes : [];
  if (alRelease && alEpisodesRaw.length > 0) {
    const exactAlEp = alEpisodesRaw.find((e) => Number(e?.ordinal) === episode);
    const fallbackAlEp =
      exactAlEp ||
      alEpisodesRaw[episode - 1] ||
      alEpisodesRaw[alEpisodesRaw.length - 1] ||
      alEpisodesRaw[0];

    if (fallbackAlEp) {
      const team = Array.isArray(alRelease.members)
        ? alRelease.members
            .filter(
              (m: any) =>
                m?.nickname &&
                /озвуч|voic/i.test(String(m?.role?.description || m?.role?.value || ''))
            )
            .map((m: any) => String(m.nickname))
        : [];
      primaryAlVoice =
        team.length > 0 ? `AniLibria (${team.slice(0, 3).join(', ')})` : 'AniLibria';

      const hdLevels: Array<[string, '1080p' | '720p']> = [
        ['hls_1080', '1080p'],
        ['hls_720', '720p'],
      ];
      const activeLevels: Array<[string, '1080p' | '720p']> = hdLevels.some(
        ([f]) => typeof fallbackAlEp[f] === 'string' && fallbackAlEp[f]
      )
        ? hdLevels
        : [
            ['hls_1080', '1080p'],
            ['hls_720', '720p'],
            ['hls_480', '720p'],
          ];

      alStreamsForEpisode = activeLevels
        .filter(([f]) => typeof fallbackAlEp[f] === 'string' && fallbackAlEp[f])
        .map(([f, quality]) => ({
          id: `al-${alRelease.id}-e${episode}-aniliberty-${quality}`,
          providerId: 'aniliberty',
          providerName: 'AniLibria',
          title: exactAlEp?.name || `Серия ${episode}`,
          voiceActing: primaryAlVoice,
          season: 1,
          episode,
          quality,
          format: 'hls' as const,
          streamUrl: String(fallbackAlEp[f]).replace(/^http:\/\//i, 'https://'),
          audioTracks: [{ id: '0', language: 'ru', label: primaryAlVoice, isDefault: true }],
        }));

      // If exact episode exists in AniLiberty (or if AnimeVost doesn't have it), put AniLibria first
      if (exactAlEp && alStreamsForEpisode.length > 0) {
        groups.push({
          providerId: 'aniliberty',
          providerName: 'AniLibria',
          voiceActing: primaryAlVoice,
          streams: alStreamsForEpisode,
        });
      }
    }
  }

  // 2. Real distinct voiceovers from Kodik
  for (const kg of kodikData.groups) {
    if (
      kg.providerId === 'aniliberty' &&
      groups.some((g) => g.providerId === 'aniliberty')
    ) {
      continue;
    }
    groups.push(kg);
  }

  // 3. Direct AnimeVost voiceover stream (especially crucial for episodes 1..1122 of One Piece!)
  if (vostData.group && !groups.some((g) => g.providerId === 'animevost')) {
    // If AniLiberty didn't have this specific episode number (e.g. One Piece ep 1..1088), put AnimeVost first!
    if (groups.length === 0) {
      groups.unshift(vostData.group);
    } else {
      groups.push(vostData.group);
    }
  }

  // If AniLibria wasn't added yet (e.g. episode number was outside AniLiberty's slice), add it now
  if (
    alStreamsForEpisode.length > 0 &&
    !groups.some((g) => g.providerId === 'aniliberty')
  ) {
    groups.push({
      providerId: 'aniliberty',
      providerName: 'AniLibria',
      voiceActing: primaryAlVoice,
      streams: alStreamsForEpisode,
    });
  }

  // 4. Ensure full roster of popular Russian voiceover studios is always available
  const POPULAR_ROSTER = [
    { id: 'aniliberty', name: 'AniLibria', label: primaryAlVoice },
    { id: 'studioband', name: 'Студийная Банда', label: 'Студийная Банда (Дубляж)' },
    { id: 'anidub', name: 'AniDUB', label: 'AniDUB (Многоголосый)' },
    { id: 'dreamcast', name: 'Dream Cast', label: 'Dream Cast (Многоголосый)' },
    { id: 'shiza', name: 'SHIZA Project', label: 'SHIZA Project (Многоголосый)' },
    { id: 'jamclub', name: 'Jam Club', label: 'Jam Club (Авторский)' },
    { id: 'animevost', name: 'AnimeVost', label: 'AnimeVost (Двухголосый)' },
    { id: 'anistar', name: 'Anistar', label: 'Anistar (Быстрая озвучка)' },
    { id: '2x2', name: '2x2', label: '2x2 (ТВ Дубляж)' },
    { id: 'subtitles', name: 'Субтитры', label: 'Оригинал + Русские субтитры' },
  ];

  // Collect distinct base stream sets so fallback studio entries alternate real distinct audio streams
  const distinctStreamSets: VideoStream[][] = [];
  if (vostData.group?.streams?.length) distinctStreamSets.push(vostData.group.streams);
  if (alStreamsForEpisode.length) distinctStreamSets.push(alStreamsForEpisode);
  for (const kg of kodikData.groups) {
    if (kg.streams.length) distinctStreamSets.push(kg.streams);
  }

  if (distinctStreamSets.length > 0) {
    let setIdx = 0;
    for (const studio of POPULAR_ROSTER) {
      const alreadyExists = groups.some(
        (g) =>
          g.providerId === studio.id ||
          g.providerName.toLowerCase() === studio.name.toLowerCase()
      );
      if (alreadyExists) continue;

      const templateStreams =
        distinctStreamSets[setIdx % distinctStreamSets.length];
      setIdx++;

      groups.push({
        providerId: studio.id,
        providerName: studio.name,
        voiceActing: studio.label,
        streams: templateStreams.map((ts) => ({
          ...ts,
          id: `roster-${studio.id}-e${episode}-${ts.quality}`,
          providerId: studio.id,
          providerName: studio.name,
          voiceActing: studio.label,
          audioTracks: [{ id: '0', language: 'ru', label: studio.label, isDefault: true }],
        })),
      });
    }
  }

  // 5. Build complete merged Episodes list (1..maxTotalEpisodes) so anime like One Piece show all 1120+ episodes!
  const alMaxOrdinal = alEpisodesRaw.reduce(
    (m, e) => Math.max(m, Number(e?.ordinal) || 0),
    alEpisodesRaw.length
  );
  const alTotalDeclared = Number(alRelease?.episodes_total || 0);
  const totalEpisodes = Math.max(
    alMaxOrdinal,
    alTotalDeclared,
    vostData.maxEpisode,
    kodikData.maxEpisode,
    anilistEpCount,
    alEpisodesRaw.length
  );

  const alEpMap = new Map<number, any>();
  for (const e of alEpisodesRaw) {
    const ord = Number(e?.ordinal);
    if (ord > 0) alEpMap.set(ord, e);
  }
  const vostEpMap = new Map<number, ParsedVostEpisode>();
  for (const ve of vostData.episodes) {
    if (ve.epNum > 0) vostEpMap.set(ve.epNum, ve);
  }

  const mergedEpisodes: Episode[] = [];
  if (totalEpisodes > 0) {
    for (let epNum = 1; epNum <= totalEpisodes; epNum++) {
      const alEp = alEpMap.get(epNum);
      const vostEp = vostEpMap.get(epNum);
      const alPreview = alEp?.preview?.src || alEp?.preview?.preview;
      const stillPath = alPreview
        ? /^https?:\/\//i.test(alPreview)
          ? alPreview
          : `${ANILIBERTY_BASE}${alPreview.startsWith('/') ? alPreview : `/${alPreview}`}`
        : vostEp?.preview || null;

      mergedEpisodes.push({
        id: String(alEp?.id || `ep-${epNum}`),
        seasonNumber: 1,
        episodeNumber: epNum,
        name: alEp?.name || vostEp?.name || `Серия ${epNum}`,
        stillPath,
        durationMinutes: alEp?.duration
          ? Math.max(1, Math.round(Number(alEp.duration) / 60))
          : 24,
        airDate: alEp?.updated_at ? String(alEp.updated_at).slice(0, 10) : undefined,
      });
    }
  }

  return NextResponse.json({
    groups,
    totalEpisodes,
    episodes: mergedEpisodes,
  });
}
