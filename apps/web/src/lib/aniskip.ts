export interface SkipInterval {
  skipId: string;
  skipType: 'op' | 'ed';
  startTime: number;
  endTime: number;
}

export interface EpisodeSkipSegments {
  op: SkipInterval | null;
  ed: SkipInterval | null;
}

const malIdCache = new Map<string, number | null>();
const skipTimesCache = new Map<string, EpisodeSkipSegments>();

/**
 * Resolves a MyAnimeList ID directly or by searching Jikan API using anime title/originalTitle.
 */
export async function resolveMalId(params: {
  malId?: number;
  title?: string;
  originalTitle?: string;
}): Promise<number | null> {
  if (params.malId && params.malId > 0) {
    return params.malId;
  }

  const query = (params.originalTitle || params.title || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!query || query.length < 2) return null;

  const cacheKey = query.toLowerCase();
  if (malIdCache.has(cacheKey)) {
    return malIdCache.get(cacheKey) ?? null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (!res.ok) {
      malIdCache.set(cacheKey, null);
      return null;
    }

    const json: any = await res.json();
    const foundId = Number(json?.data?.[0]?.mal_id) || null;
    malIdCache.set(cacheKey, foundId);
    return foundId;
  } catch {
    return null;
  }
}

/**
 * Fetches OP/ED skip intervals for a specific MAL ID and episode from AniSkip API v2.
 * Never returns fabricated/random timestamps.
 */
export async function fetchAniSkipTimestamps(
  malId: number,
  episodeNumber: number,
  episodeLength = 0
): Promise<EpisodeSkipSegments> {
  if (!malId || malId <= 0 || !episodeNumber || episodeNumber <= 0) {
    return { op: null, ed: null };
  }

  const cacheKey = `${malId}:${episodeNumber}`;
  const cached = skipTimesCache.get(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const epLen = episodeLength > 0 ? Math.floor(episodeLength) : 0;
    const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episodeNumber}?types=op&types=ed&episodeLength=${epLen}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const empty: EpisodeSkipSegments = { op: null, ed: null };
      if (res.status === 404) {
        skipTimesCache.set(cacheKey, empty);
      }
      return empty;
    }

    const json: any = await res.json();
    const results: any[] = Array.isArray(json?.results) ? json.results : [];

    let op: SkipInterval | null = null;
    let ed: SkipInterval | null = null;

    for (const item of results) {
      const type = String(item?.skipType || '').toLowerCase();
      const startTime = Number(item?.interval?.startTime);
      const endTime = Number(item?.interval?.endTime);
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
        continue;
      }

      if (type === 'op' && !op) {
        op = {
          skipId: String(item.skipId || `op-${malId}-${episodeNumber}`),
          skipType: 'op',
          startTime,
          endTime,
        };
      } else if (type === 'ed' && !ed) {
        ed = {
          skipId: String(item.skipId || `ed-${malId}-${episodeNumber}`),
          skipType: 'ed',
          startTime,
          endTime,
        };
      }
    }

    const parsed: EpisodeSkipSegments = { op, ed };
    skipTimesCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return { op: null, ed: null };
  }
}
