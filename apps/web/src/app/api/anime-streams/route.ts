import { NextRequest, NextResponse } from 'next/server';
import { Episode, StreamSourceGroup, VideoStream } from '@cinemaflow/types';

export const dynamic = 'force-dynamic';

const ANILIBERTY_BASE = 'https://api.anilibria.app';

// Put verified live working token first; kodik-api.com is the active domain
const STATIC_KODIK_TOKENS = [
  process.env.KODIK_API_TOKEN || '',
  '41dd95f84c21719b09d6c71182237a25',
  '447d179e875efe44217f20d1ee2146be',
  '71d124b40d5488b43b114d9f1d00e100',
  'c1676fe60b2f3f0021ff82b12b83e989',
  'b7cc4293ed475c4ad1fd599d114f4435',
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
  if (/anistar|анистар/i.test(lower)) return 'anistar';
  if (/2x2/i.test(lower)) return '2x2';
  if (/субтитр|sub/i.test(lower)) return 'subtitles';
  return lower.replace(/[^a-zа-я0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'voice';
}

function normTitle(raw?: string | null): string {
  return String(raw || '')
    .replace(/\[[^\]]*\]/g, ' ') // Strip [ТВ], [ТВ-2], [1-1180 из 10000+]
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesStrictlyMatch(
  candidateA?: string | null,
  candidateB?: string | null
): boolean {
  const a = normTitle(candidateA);
  const b = normTitle(candidateB);
  if (!a || !b) return false;
  if (a === b) return true;

  const isOnePieceA = /^(ван пис|one piece|большой куш)$/.test(a);
  const isOnePieceB = /^(ван пис|one piece|большой куш)$/.test(b);
  if (isOnePieceA && isOnePieceB) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (
    shorter.length >= 5 &&
    longer.startsWith(shorter) &&
    shorter.length / longer.length >= 0.72
  ) {
    return true;
  }

  return false;
}

function cleanQueryCandidates(title?: string, originalTitle?: string): string[] {
  const list: string[] = [];
  const add = (raw?: string) => {
    const s = String(raw || '').replace(/\[[^\]]*\]/g, '').trim();
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
  if (list.some((q) => /ван[\s-]*пис|^one\s*piece$|большой\s*куш/i.test(q))) {
    add('Ван Пис');
    add('One Piece');
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
      const sp = new URLSearchParams({ page: '1', limit: '10', 'f[search]': q });
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
          : undefined) ||
        list.find(
          (r) =>
            titlesStrictlyMatch(r?.name?.main, params.title) ||
            titlesStrictlyMatch(r?.name?.english, params.originalTitle) ||
            titlesStrictlyMatch(r?.name?.main, params.originalTitle) ||
            titlesStrictlyMatch(r?.name?.english, params.title)
        );

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
}): Promise<{ groups: StreamSourceGroup[]; episodeNumbers: number[] }> {
  const groups: StreamSourceGroup[] = [];
  const seenStudios = new Set<string>();
  const epSet = new Set<number>();

  const queries = cleanQueryCandidates(params.originalTitle, params.title);

  for (const token of STATIC_KODIK_TOKENS) {
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

      for (const q of queries.slice(0, 3)) {
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
        const res = await fetch(`https://kodik-api.com/search?${sp.toString()}`, {
          cache: 'no-store',
        }).catch(() => null);
        if (!res || !res.ok) continue;

        const data: any = await res.json().catch(() => null);
        if (data?.error) break; // Invalid token, move to next token immediately
        const results: any[] = Array.isArray(data?.results) ? data.results : [];
        if (results.length === 0) continue;

        for (const item of results) {
          const itemShikiId = Number(item?.shikimori_id || 0);
          const idMatches = Boolean(params.malId && itemShikiId === params.malId);
          const otherTitles = String(item?.other_title || '')
            .split('/')
            .map((t) => t.trim())
            .filter(Boolean);
          const titleMatches =
            titlesStrictlyMatch(item?.title, params.title) ||
            titlesStrictlyMatch(item?.title_orig, params.originalTitle) ||
            titlesStrictlyMatch(item?.title, params.originalTitle) ||
            titlesStrictlyMatch(item?.title_orig, params.title) ||
            otherTitles.some(
              (ot) =>
                titlesStrictlyMatch(ot, params.title) ||
                titlesStrictlyMatch(ot, params.originalTitle)
            );

          if (!idMatches && !titleMatches) continue;

          // Collect all episode numbers from Kodik
          const lastEp = Number(item?.last_episode || item?.episodes_count || 0);
          if (lastEp > 0) {
            for (let n = 1; n <= lastEp; n++) epSet.add(n);
          }

          const studioTitle = String(item?.translation?.title || 'Озвучка').trim();
          const trType =
            item?.translation?.type === 'subtitles' ? 'Субтитры' : 'Озвучка';
          const normId = normalizeStudioId(studioTitle);
          const uniqueKey = `${normId}:${studioTitle.toLowerCase()}`;
          if (seenStudios.has(uniqueKey)) continue;

          // Locate exact episode embed link
          let epLink: string | null = null;
          const epKey = String(params.episode);

          if (item?.seasons && typeof item.seasons === 'object') {
            for (const sKey of Object.keys(item.seasons)) {
              const seasonObj = item.seasons[sKey];
              if (seasonObj?.episodes) {
                for (const k of Object.keys(seasonObj.episodes)) {
                  const n = parseInt(k, 10);
                  if (n > 0) epSet.add(n);
                }
                const rawEp = seasonObj.episodes[epKey];
                if (rawEp && !epLink) {
                  epLink = typeof rawEp === 'string' ? rawEp : rawEp?.link || null;
                }
              }
            }
          }

          if (!epLink && typeof item?.link === 'string' && item.link) {
            if (item.type === 'anime' && params.episode === 1) {
              epLink = item.link;
              epSet.add(1);
            } else if (!lastEp || params.episode <= lastEp) {
              const sep = item.link.includes('?') ? '&' : '?';
              epLink = `${item.link}${sep}season=1&episode=${params.episode}`;
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
          return { groups, episodeNumbers: Array.from(epSet) };
        }
      }
    } catch {
      // try next token
    }
  }

  return { groups, episodeNumbers: Array.from(epSet) };
}

interface ParsedVostEpisode {
  epNum: number;
  name: string;
  preview: string | null;
  hd: string;
  std: string;
}

function parseAnimeVostItemTitle(rawTitle: string): {
  ruTitle: string;
  enTitle: string;
  declaredEpisodes: number;
} {
  const bracketMatch = /\[(?:(\d+)-)?(\d+)\s+из\s+(\d+)\+?\]/i.exec(rawTitle);
  const declaredEpisodes = bracketMatch
    ? Math.max(Number(bracketMatch[2] || 0), Number(bracketMatch[3] || 0))
    : 0;
  const withoutBrackets = rawTitle.replace(/\[[^\]]*\]/g, '').trim();
  const parts = withoutBrackets.split('/');
  const ruTitle = (parts[0] || '').trim();
  const enTitle = parts.slice(1).join('/').trim();
  return { ruTitle, enTitle, declaredEpisodes };
}

async function isPlayableMediaUrl(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    try {
      const res = await fetch(url, {
        headers: { Range: 'bytes=0-1' },
        signal: controller.signal,
        cache: 'no-store',
      });
      return res.ok || res.status === 206;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

async function fetchAnimeVostData(params: {
  title?: string;
  originalTitle?: string;
  episode: number;
}): Promise<{
  group: StreamSourceGroup | null;
  episodes: ParsedVostEpisode[];
  coverUrl: string | null;
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

      const scoredMatches = items
        .map((it) => {
          const parsed = parseAnimeVostItemTitle(String(it?.title || ''));
          const matchesRu =
            titlesStrictlyMatch(parsed.ruTitle, params.title) ||
            titlesStrictlyMatch(parsed.ruTitle, params.originalTitle);
          const matchesEn =
            titlesStrictlyMatch(parsed.enTitle, params.originalTitle) ||
            titlesStrictlyMatch(parsed.enTitle, params.title);

          if (!matchesRu && !matchesEn) return null;

          let score = parsed.declaredEpisodes;
          if (
            normTitle(parsed.ruTitle) === normTitle(params.title) ||
            normTitle(parsed.enTitle) === normTitle(params.originalTitle)
          ) {
            score += 2000;
          }
          if (
            /фильм|спешл|special|movie|ova|ова/i.test(parsed.ruTitle) &&
            !/фильм|спешл|special|movie|ova|ова/i.test(String(params.title || ''))
          ) {
            score -= 1500;
          }
          return { item: it, score };
        })
        .filter(Boolean) as Array<{ item: any; score: number }>;

      if (scoredMatches.length === 0) continue;

      scoredMatches.sort((a, b) => b.score - a.score);
      const bestItem = scoredMatches[0].item;
      if (!bestItem?.id) continue;

      const vostId = bestItem.id;
      const coverUrl = bestItem.urlImagePreview
        ? String(bestItem.urlImagePreview).replace(/^http:\/\//i, 'https://')
        : null;

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

      const byEpNum = new Map<number, ParsedVostEpisode>();
      rawPlaylist.forEach((p, idx) => {
        const rawName = String(p?.name || '').trim();
        const hd = String(p?.hd || p?.std || '').replace(/^http:\/\//i, 'https://');
        const std = String(p?.std || p?.hd || '').replace(/^http:\/\//i, 'https://');
        if (!hd) return;

        const numMatch =
          /(\d+)\s*(?:-?я)?\s*(?:серия|эпизод|ep)/i.exec(rawName) ||
          /(?:серия|эпизод|ep)\s*(\d+)/i.exec(rawName) ||
          /^(\d+)$/.exec(rawName);

        if (!numMatch && rawPlaylist.length > 1 && /фильм|ова|ova|спешл/i.test(rawName)) {
          return;
        }

        const epNum = numMatch ? parseInt(numMatch[1], 10) : idx + 1;
        if (epNum <= 0 || byEpNum.has(epNum)) return;

        const preview = p?.preview
          ? String(p.preview).replace(/^http:\/\//i, 'https://')
          : null;

        byEpNum.set(epNum, {
          epNum,
          name: rawName || `Серия ${epNum}`,
          preview,
          hd,
          std,
        });
      });

      const parsedEpisodes = Array.from(byEpNum.values()).sort(
        (a, b) => a.epNum - b.epNum
      );
      if (parsedEpisodes.length === 0) continue;

      const matchedEp =
        byEpNum.get(params.episode) ||
        (parsedEpisodes.length === 1 && params.episode === 1
          ? parsedEpisodes[0]
          : undefined);

      if (!matchedEp) {
        return { group: null, episodes: parsedEpisodes, coverUrl };
      }

      // Probe whether AnimeVost MP4 CDN actually serves 200/206 before showing AnimeVost
      const [hdOk, stdOk] = await Promise.all([
        isPlayableMediaUrl(matchedEp.hd),
        matchedEp.std !== matchedEp.hd ? isPlayableMediaUrl(matchedEp.std) : Promise.resolve(false),
      ]);

      const vostStreams: VideoStream[] = [];
      if (hdOk) {
        vostStreams.push({
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
          audioTracks: [{ id: '0', language: 'ru', label: 'AnimeVost', isDefault: true }],
        });
      }
      if (stdOk) {
        vostStreams.push({
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
          audioTracks: [{ id: '0', language: 'ru', label: 'AnimeVost', isDefault: true }],
        });
      }

      const group: StreamSourceGroup | null =
        vostStreams.length > 0
          ? {
              providerId: 'animevost',
              providerName: 'AnimeVost',
              voiceActing: 'AnimeVost (Двухголосый закадровый)',
              streams: vostStreams,
            }
          : null;

      return { group, episodes: parsedEpisodes, coverUrl };
    } catch {}
  }

  return { group: null, episodes: [], coverUrl: null };
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

  const alRelease = await fetchAniLibertyRelease({
    anilibertyId: alIdParam,
    malId: malIdParam,
    title,
    originalTitle,
  });

  const effectiveTitle = title || alRelease?.name?.main || undefined;
  const effectiveOriginalTitle =
    originalTitle || alRelease?.name?.english || undefined;
  const effectiveMalId =
    malIdParam ||
    Number(alRelease?.mal?.id || alRelease?.shikimori?.id || 0) ||
    undefined;

  const [kodikData, vostData] = await Promise.all([
    fetchKodikData({
      malId: effectiveMalId,
      title: effectiveTitle,
      originalTitle: effectiveOriginalTitle,
      episode,
    }),
    fetchAnimeVostData({
      title: effectiveTitle,
      originalTitle: effectiveOriginalTitle,
      episode,
    }),
  ]);

  const groups: StreamSourceGroup[] = [];

  // 1. Official AniLibria HLS stream (ONLY when AniLiberty has this exact episode)
  const alEpisodesRaw: any[] = Array.isArray(alRelease?.episodes) ? alRelease.episodes : [];
  if (alRelease && alEpisodesRaw.length > 0) {
    const exactAlEp =
      alEpisodesRaw.find((e, idx) => (Number(e?.ordinal) || idx + 1) === episode) ||
      (alEpisodesRaw.length === 1 && episode === 1 ? alEpisodesRaw[0] : null);

    if (exactAlEp) {
      const team = Array.isArray(alRelease.members)
        ? alRelease.members
            .filter(
              (m: any) =>
                m?.nickname &&
                /озвуч|voic/i.test(String(m?.role?.description || m?.role?.value || ''))
            )
            .map((m: any) => String(m.nickname))
        : [];
      const primaryAlVoice =
        team.length > 0 ? `AniLibria (${team.slice(0, 3).join(', ')})` : 'AniLibria';

      const hdLevels: Array<[string, '1080p' | '720p']> = [
        ['hls_1080', '1080p'],
        ['hls_720', '720p'],
      ];
      const activeLevels: Array<[string, '1080p' | '720p']> = hdLevels.some(
        ([f]) => typeof exactAlEp[f] === 'string' && exactAlEp[f]
      )
        ? hdLevels
        : [
            ['hls_1080', '1080p'],
            ['hls_720', '720p'],
            ['hls_480', '720p'],
          ];

      const alStreams: VideoStream[] = activeLevels
        .filter(([f]) => typeof exactAlEp[f] === 'string' && exactAlEp[f])
        .map(([f, quality]) => ({
          id: `al-${alRelease.id}-e${episode}-aniliberty-${quality}`,
          providerId: 'aniliberty',
          providerName: 'AniLibria',
          title: exactAlEp.name || `Серия ${episode}`,
          voiceActing: primaryAlVoice,
          season: 1,
          episode,
          quality,
          format: 'hls' as const,
          streamUrl: String(exactAlEp[f]).replace(/^http:\/\//i, 'https://'),
          audioTracks: [{ id: '0', language: 'ru', label: primaryAlVoice, isDefault: true }],
        }));

      if (alStreams.length > 0) {
        groups.push({
          providerId: 'aniliberty',
          providerName: 'AniLibria',
          voiceActing: primaryAlVoice,
          streams: alStreams,
        });
      }
    }
  }

  // 2. All verified working voiceovers from Kodik (Studio Band, Animedia, Persona99, Shachiburi, 2x2, Субтитры, etc.)
  for (const kg of kodikData.groups) {
    if (
      kg.providerId === 'aniliberty' &&
      groups.some((g) => g.providerId === 'aniliberty')
    ) {
      continue;
    }
    groups.push(kg);
  }

  // 3. Direct AnimeVost voiceover stream (only if probe succeeded)
  if (vostData.group && !groups.some((g) => g.providerId === 'animevost')) {
    groups.push(vostData.group);
  }

  // 4. Build union of all real playable episodes with unique previews
  const alPosterRel =
    alRelease?.background_covers?.[0]?.src ||
    alRelease?.poster?.src ||
    alRelease?.poster?.preview;
  const alFallbackCover = alPosterRel
    ? /^https?:\/\//i.test(alPosterRel)
      ? alPosterRel
      : `${ANILIBERTY_BASE}${alPosterRel.startsWith('/') ? alPosterRel : `/${alPosterRel}`}`
    : null;
  const fallbackCover = alFallbackCover || vostData.coverUrl || null;

  const alEpMap = new Map<number, any>();
  for (const e of alEpisodesRaw) {
    const ord = Number(e?.ordinal);
    if (ord > 0) alEpMap.set(ord, e);
  }
  const vostEpMap = new Map<number, ParsedVostEpisode>();
  for (const ve of vostData.episodes) {
    if (ve.epNum > 0) vostEpMap.set(ve.epNum, ve);
  }

  const allEpNumbersSet = new Set<number>();
  Array.from(alEpMap.keys()).forEach((k) => allEpNumbersSet.add(k));
  Array.from(vostEpMap.keys()).forEach((k) => allEpNumbersSet.add(k));
  kodikData.episodeNumbers.forEach((k) => allEpNumbersSet.add(k));

  const sortedEpNumbers = Array.from(allEpNumbersSet).sort((a, b) => a - b);

  const mergedEpisodes: Episode[] = sortedEpNumbers.map((epNum) => {
    const alEp = alEpMap.get(epNum);
    const vostEp = vostEpMap.get(epNum);
    const alPreview = alEp?.preview?.src || alEp?.preview?.preview;
    const stillPath = alPreview
      ? /^https?:\/\//i.test(alPreview)
        ? alPreview
        : `${ANILIBERTY_BASE}${alPreview.startsWith('/') ? alPreview : `/${alPreview}`}`
      : vostEp?.preview || fallbackCover;

    return {
      id: String(alEp?.id || `ep-${epNum}`),
      seasonNumber: 1,
      episodeNumber: epNum,
      name: alEp?.name || vostEp?.name || `Серия ${epNum}`,
      stillPath,
      durationMinutes: alEp?.duration
        ? Math.max(1, Math.round(Number(alEp.duration) / 60))
        : 24,
      airDate: alEp?.updated_at ? String(alEp.updated_at).slice(0, 10) : undefined,
    };
  });

  return NextResponse.json({
    groups,
    totalEpisodes: mergedEpisodes.length,
    episodes: mergedEpisodes,
  });
}
