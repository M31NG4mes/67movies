import { NextRequest, NextResponse } from 'next/server';
import { StreamSourceGroup, VideoQuality, VideoStream } from '@cinemaflow/types';

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

function decryptKodikSrc(encoded: string): string | null {
  if (!encoded) return null;
  if (encoded.startsWith('http://') || encoded.startsWith('https://')) return encoded;
  if (encoded.startsWith('//')) return `https:${encoded}`;

  const zCharCode = 'Z'.charCodeAt(0);
  const rot13 = encoded.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const limit = c <= 'Z' ? zCharCode : 122;
    const shifted = code + 18;
    return String.fromCharCode(shifted <= limit ? shifted : shifted - 26);
  });

  for (const candidate of [rot13, encoded]) {
    try {
      const padded = candidate.padEnd(candidate.length + ((4 - (candidate.length % 4)) % 4), '=');
      const decoded = Buffer.from(padded, 'base64').toString('utf-8');
      if (decoded.startsWith('//')) return `https:${decoded}`;
      if (decoded.startsWith('http://') || decoded.startsWith('https://')) return decoded;
    } catch {
      continue;
    }
  }
  return null;
}

function resolveEpisodeEmbedLink(item: any, season?: number, episode?: number): string | null {
  let rawLink: string | undefined = item?.link;

  if (season !== undefined && episode !== undefined && item?.seasons) {
    const seasonObj = item.seasons[String(season)] || item.seasons[season];
    const epObj = seasonObj?.episodes?.[String(episode)] || seasonObj?.episodes?.[episode];
    if (typeof epObj === 'string') {
      rawLink = epObj;
    } else if (epObj && typeof epObj === 'object' && epObj.link) {
      rawLink = epObj.link;
    } else if (Object.keys(item.seasons).length > 0) {
      return null;
    }
  }

  if (!rawLink) return null;
  return rawLink.startsWith('//')
    ? `https:${rawLink}`
    : rawLink.startsWith('http')
    ? rawLink
    : `https://${rawLink}`;
}

async function probeKodikQualities(embedUrl: string): Promise<Array<{ q: VideoQuality; label: string }>> {
  try {
    const embedParsed = new URL(embedUrl);
    const htmlRes = await fetch(embedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Referer: `${embedParsed.protocol}//${embedParsed.host}/`,
      },
      cache: 'no-store',
    });
    if (!htmlRes.ok) return [];
    const html = await htmlRes.text();

    let urlParams: Record<string, any> = {};
    const urlParamsMatch =
      /urlParams\s*=\s*'([^']+)'/.exec(html) ||
      /urlParams\s*=\s*"([^"]+)"/.exec(html);
    if (urlParamsMatch?.[1]) {
      try {
        urlParams = JSON.parse(urlParamsMatch[1]);
      } catch {}
    }

    const pathMatch = /\/(video|seria|movie|episode)\/(\d+)\/([a-zA-Z0-9]+)\//.exec(embedParsed.pathname);
    const vType =
      /videoInfo\.type\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1] ||
      /vInfo\.type\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1] ||
      pathMatch?.[1] ||
      'video';
    const vId =
      /videoInfo\.id\s*=\s*['"]?(\d+)['"]?/.exec(html)?.[1] ||
      /vInfo\.id\s*=\s*['"]?(\d+)['"]?/.exec(html)?.[1] ||
      pathMatch?.[2] ||
      '';
    const vHash =
      /videoInfo\.hash\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1] ||
      /vInfo\.hash\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1] ||
      pathMatch?.[3] ||
      '';

    if (!vId || !vHash) return [];

    const pdHost = urlParams.pd || embedParsed.host;
    let decodedRef = urlParams.ref || '';
    try {
      if (decodedRef.includes('%')) decodedRef = decodeURIComponent(decodedRef);
    } catch {}

    const form = new URLSearchParams();
    if (urlParams.d) form.set('d', String(urlParams.d));
    if (urlParams.d_sign) form.set('d_sign', String(urlParams.d_sign));
    if (urlParams.pd) form.set('pd', String(urlParams.pd));
    if (urlParams.pd_sign) form.set('pd_sign', String(urlParams.pd_sign));
    if (decodedRef) form.set('ref', String(decodedRef));
    if (urlParams.ref_sign) form.set('ref_sign', String(urlParams.ref_sign));
    form.set('bad_user', 'true');
    form.set('cdn_is_working', 'true');
    form.set('type', vType);
    form.set('hash', vHash);
    form.set('id', vId);
    form.set('info', '{}');

    for (const epPath of ['/ftor', '/gvi', '/video-links']) {
      const ftorRes = await fetch(`https://${pdHost}${epPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Origin: `https://${pdHost}`,
          Referer: embedUrl,
        },
        body: form.toString(),
        cache: 'no-store',
      }).catch(() => null);

      if (!ftorRes || !ftorRes.ok) continue;
      const json: any = await ftorRes.json().catch(() => null);
      const links = json?.links;
      if (!links || typeof links !== 'object') continue;

      const available: Array<{ q: VideoQuality; label: string }> = [];
      for (const [label, q] of [
        ['1080', '1080p'],
        ['720', '720p'],
        ['480', '480p'],
        ['360', '360p'],
      ] as Array<[string, VideoQuality]>) {
        const entry = Array.isArray(links[label]) ? links[label][0] : links[label];
        if (typeof entry?.src === 'string' && decryptKodikSrc(entry.src)) {
          available.push({ q, label });
        }
      }
      if (available.length > 0) return available;
    }
  } catch {
    return [];
  }
  return [];
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
  const candidates: Array<{ item: any; voice: string; embedUrl: string }> = [];

  for (const { item } of scored) {
    const voice = String(item?.translation?.title || 'Русская озвучка').trim();
    if (seenVoices.has(voice.toLowerCase())) continue;
    const embedUrl = resolveEpisodeEmbedLink(item, season, episode);
    if (!embedUrl) continue;
    seenVoices.add(voice.toLowerCase());
    candidates.push({ item, voice, embedUrl });
    if (candidates.length >= 10) break;
  }

  const verifiedGroups = await Promise.all(
    candidates.map(async ({ item, voice, embedUrl }) => {
      const qualities = await probeKodikQualities(embedUrl);
      if (qualities.length === 0) return null;

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
        streamUrl: `/api/stream?kodikLink=${encodeURIComponent(embedUrl)}&quality=${label}`,
        isProxyRequired: false,
      }));

      const group: StreamSourceGroup = {
        providerId: 'kodik',
        providerName: 'Kodik',
        voiceActing: voice,
        streams,
      };
      return group;
    }),
  );

  const sourceGroups = verifiedGroups.filter((g): g is StreamSourceGroup => g !== null);
  return NextResponse.json({ sourceGroups });
}
