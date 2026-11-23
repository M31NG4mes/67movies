import { NextRequest, NextResponse } from 'next/server';
import { StreamSourceGroup, VideoStream } from '@cinemaflow/types';

export const dynamic = 'force-dynamic';

const KODIK_TOKENS = [
  process.env.KODIK_API_TOKEN || '',
  '41dd95f84c21719b09d6c71182237a25',
  '447d179e875efe44217f20d1ee2146be',
  '71d124b40d5488b43b114d9f1d00e100',
].filter(Boolean);

function normalizeTitle(raw?: string | null): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEmbedUrl(rawLink: string, season?: number, episode?: number): string {
  const base = rawLink.startsWith('//')
    ? `https:${rawLink}`
    : rawLink.startsWith('http')
    ? rawLink
    : `https://${rawLink}`;
  try {
    const u = new URL(base);
    if (season !== undefined && episode !== undefined) {
      u.searchParams.set('season', String(season));
      u.searchParams.set('episode', String(episode));
    }
    return u.toString();
  } catch {
    return base;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const title = (sp.get('title') || '').trim();
  const originalTitle = (sp.get('originalTitle') || '').trim();
  const imdbId = (sp.get('imdbId') || '').trim();
  const kinopoiskId = (sp.get('kinopoiskId') || '').trim();
  const year = Number(sp.get('year') || 0) || undefined;
  const mediaType = sp.get('type') === 'tv' ? 'tv' : 'movie';
  const season = sp.get('season') ? Number(sp.get('season')) : undefined;
  const episode = sp.get('episode') ? Number(sp.get('episode')) : undefined;

  if (!title && !originalTitle && !imdbId && !kinopoiskId) {
    return NextResponse.json({ sourceGroups: [] });
  }

  const queries: Array<Record<string, string>> = [];
  if (kinopoiskId) queries.push({ kinopoisk_id: kinopoiskId });
  if (imdbId) queries.push({ imdb_id: imdbId });
  if (title) queries.push({ title });
  if (originalTitle && originalTitle.toLowerCase() !== title.toLowerCase()) {
    queries.push({ title: originalTitle });
  }

  let matchedResults: any[] = [];

  for (const token of KODIK_TOKENS) {
    for (const qParams of queries) {
      try {
        const kSp = new URLSearchParams({
          token,
          limit: '30',
          with_episodes: 'true',
          ...qParams,
        });
        const res = await fetch(`https://kodik-api.com/search?${kSp.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) continue;
        const data: any = await res.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        if (results.length > 0) {
          matchedResults = results;
          break;
        }
      } catch {
        continue;
      }
    }
    if (matchedResults.length > 0) break;
  }

  if (matchedResults.length === 0) {
    return NextResponse.json({ sourceGroups: [] });
  }

  const targetNorm = normalizeTitle(title);
  const origNorm = normalizeTitle(originalTitle);

  const scored = matchedResults
    .map((item) => {
      let score = 0;
      const itemTitle = normalizeTitle(item.title);
      const itemOrig = normalizeTitle(item.title_orig);
      if (targetNorm && itemTitle === targetNorm) score += 100;
      else if (origNorm && itemOrig === origNorm) score += 90;
      else if (targetNorm && itemTitle.includes(targetNorm)) score += 40;
      else if (origNorm && itemOrig.includes(origNorm)) score += 35;

      if (year && item.year) {
        const diff = Math.abs(Number(item.year) - year);
        if (diff === 0) score += 40;
        else if (diff === 1) score += 15;
        else score -= 30;
      }

      const isSerial = String(item.type || '').includes('serial');
      if (mediaType === 'tv' && isSerial) score += 25;
      if (mediaType === 'movie' && !isSerial) score += 25;

      return { item, score };
    })
    .filter((entry) => entry.score >= 20 || Boolean(imdbId || kinopoiskId))
    .sort((a, b) => b.score - a.score);

  const seenVoices = new Set<string>();
  const sourceGroups: StreamSourceGroup[] = [];

  for (const { item } of scored) {
    if (!item?.link) continue;
    const voice = String(item?.translation?.title || 'Русская озвучка').trim();
    if (seenVoices.has(voice.toLowerCase())) continue;
    seenVoices.add(voice.toLowerCase());

    const embedUrl = buildEmbedUrl(item.link, season, episode);
    const qualities: Array<{ q: '1080p' | '720p' | '480p'; label: string }> = [
      { q: '1080p', label: '1080' },
      { q: '720p', label: '720' },
      { q: '480p', label: '480' },
    ];

    const streams: VideoStream[] = qualities.map(({ q, label }) => ({
      id: `kodik-${item.id}-${q}`,
      providerId: 'kodik',
      providerName: 'Kodik',
      title: `${item.title || title} (${q})`,
      voiceActing: voice,
      season,
      episode,
      quality: q,
      format: 'hls',
      streamUrl: `/api/stream?embed=${encodeURIComponent(embedUrl)}&q=${label}`,
      isProxyRequired: false,
    }));

    sourceGroups.push({
      providerId: 'kodik',
      providerName: 'Kodik',
      voiceActing: voice,
      streams,
    });

    if (sourceGroups.length >= 8) break;
  }

  return NextResponse.json({ sourceGroups });
}
