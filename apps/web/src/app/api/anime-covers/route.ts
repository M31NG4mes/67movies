import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const kitsuIdCache = new Map<string, string>();

async function findKitsuAnimeId(queries: string[]): Promise<string | null> {
  for (const rawQ of queries) {
    const clean = rawQ
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim();
    if (!clean) continue;

    const cacheKey = clean.toLowerCase();
    if (kitsuIdCache.has(cacheKey)) {
      return kitsuIdCache.get(cacheKey)!;
    }

    try {
      const res = await fetch(
        `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(clean)}&page[limit]=5`,
        {
          headers: { Accept: 'application/vnd.api+json' },
          cache: 'force-cache',
        }
      );
      if (!res.ok) continue;
      const json: any = await res.json();
      const list: any[] = Array.isArray(json?.data) ? json.data : [];
      if (list.length === 0) continue;

      // Prefer TV series with highest episodeCount if searching for main series
      const tvHit =
        list.find((a) => a?.attributes?.subtype === 'TV') || list[0];
      if (tvHit?.id) {
        kitsuIdCache.set(cacheKey, String(tvHit.id));
        return String(tvHit.id);
      }
    } catch {}
  }
  return null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const originalTitle = sp.get('originalTitle') || '';
  const title = sp.get('title') || '';
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') || '50', 10) || 50));

  const queries = [originalTitle, title].filter((q) => q && !/[а-яА-ЯёЁ]/.test(q));
  if (queries.length === 0 && originalTitle) queries.push(originalTitle);
  if (queries.length === 0 && title) queries.push(title);

  if (queries.length === 0) {
    return NextResponse.json({ covers: {} });
  }

  const kitsuId = await findKitsuAnimeId(queries);
  if (!kitsuId) {
    return NextResponse.json({ covers: {} });
  }

  // Kitsu max page[limit] is 20, so fetch up to 3 pages of 20 in parallel to cover 50 episodes
  const batchOffsets: number[] = [];
  for (let o = offset; o < offset + limit; o += 20) {
    batchOffsets.push(o);
  }

  const covers: Record<number, { thumb: string; title?: string }> = {};

  await Promise.all(
    batchOffsets.map(async (batchOffset) => {
      const batchLimit = Math.min(20, offset + limit - batchOffset);
      try {
        const res = await fetch(
          `https://kitsu.io/api/edge/anime/${kitsuId}/episodes?page[limit]=${batchLimit}&page[offset]=${batchOffset}&sort=number`,
          {
            headers: { Accept: 'application/vnd.api+json' },
            cache: 'force-cache',
          }
        );
        if (!res.ok) return;
        const json: any = await res.json();
        const eps: any[] = Array.isArray(json?.data) ? json.data : [];
        for (const ep of eps) {
          const num = Number(ep?.attributes?.number);
          const thumb =
            ep?.attributes?.thumbnail?.original ||
            ep?.attributes?.thumbnail?.large ||
            ep?.attributes?.thumbnail?.medium ||
            null;
          if (num > 0 && thumb) {
            covers[num] = {
              thumb: String(thumb).replace(/^http:\/\//i, 'https://'),
              title: ep?.attributes?.canonicalTitle || undefined,
            };
          }
        }
      } catch {}
    })
  );

  return NextResponse.json({ covers });
}
