import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.|\[?::1\]?)/i;

function normalizeSafeExternalUrl(raw: string): string | null {
  if (!raw || typeof raw !== 'string' || raw.length > 2048) return null;
  const trimmed = raw.trim();
  const withProto = trimmed.startsWith('//')
    ? `https:${trimmed}`
    : trimmed.replace(/^http:\/\//i, 'https://');
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (!host || PRIVATE_HOST_RE.test(host) || host.endsWith('.local') || host.endsWith('.internal')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveRelativeUrl(baseUrl: string, target: string): string {
  try {
    const resolved = new URL(target, baseUrl).toString();
    return resolved.replace(/^http:\/\//i, 'https://');
  } catch {
    return target;
  }
}

function finalizeKodikStreamUrl(decoded: string): string {
  let clean = decoded.trim();
  if (clean.startsWith('//')) clean = `https:${clean}`;
  else if (clean.startsWith('http://')) clean = clean.replace(/^http:\/\//i, 'https://');
  if (!clean.includes('.m3u8') && clean.includes('.mp4')) {
    clean = clean.replace(/\.mp4(\?.*)?$/, '.mp4:hls:manifest.m3u8$1');
  }
  return clean;
}

function decryptKodikSrc(enc: string): string | null {
  if (!enc || typeof enc !== 'string') return null;
  const trimmed = enc.trim();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return finalizeKodikStreamUrl(trimmed);
  }

  for (let rot = 0; rot < 26; rot++) {
    const shifted = trimmed.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const base = code <= 90 ? 65 : 97;
      return String.fromCharCode(((code - base + rot) % 26) + base);
    });
    try {
      const padded = shifted + '='.repeat((4 - (shifted.length % 4)) % 4);
      const decoded = Buffer.from(padded, 'base64').toString('utf8');
      if (
        (decoded.startsWith('//') || decoded.startsWith('http')) &&
        (decoded.includes('.mp4') || decoded.includes('.m3u8') || decoded.includes('kodik'))
      ) {
        return finalizeKodikStreamUrl(decoded);
      }
    } catch {
      // try next shift
    }
  }
  return null;
}

async function resolveKodikEmbedToHlsUrl(
  embedUrl: string,
  preferredQuality = '1080'
): Promise<string | null> {
  const safeEmbed = normalizeSafeExternalUrl(embedUrl);
  if (!safeEmbed) return null;

  try {
    const embedParsed = new URL(safeEmbed);
    const htmlRes = await fetch(safeEmbed, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Referer: `${embedParsed.protocol}//${embedParsed.host}/`,
      },
      cache: 'no-store',
    });
    if (!htmlRes.ok) return null;
    const html = await htmlRes.text();

    // Parse urlParams JSON from embed page
    let urlParams: Record<string, any> = {};
    const urlParamsMatch =
      /urlParams\s*=\s*'([^']+)'/.exec(html) ||
      /urlParams\s*=\s*"([^"]+)"/.exec(html);
    if (urlParamsMatch?.[1]) {
      try {
        urlParams = JSON.parse(urlParamsMatch[1]);
      } catch {}
    }

    // Parse videoInfo (type, hash, id) from HTML or embed URL path
    const pathMatch = /\/(video|seria|movie|episode)\/(\d+)\/([a-zA-Z0-9]+)\//.exec(
      embedParsed.pathname
    );
    const vType =
      /videoInfo\.type\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1] ||
      /vInfo\.type\s*=\s*['"]([^'"]+)['"]/.exec(html)?.[1] ||
      pathMatch?.[1] ||
      'seria';
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

    if (!vId || !vHash) return null;

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
          Referer: safeEmbed,
        },
        body: form.toString(),
        cache: 'no-store',
      }).catch(() => null);

      if (!ftorRes || !ftorRes.ok) continue;
      const json: any = await ftorRes.json().catch(() => null);
      const links = json?.links;
      if (!links || typeof links !== 'object') continue;

      const qualityOrder =
        preferredQuality === '360'
          ? ['360', '480', '720', '1080']
          : preferredQuality === '480'
          ? ['480', '720', '360', '1080']
          : preferredQuality === '720'
          ? ['720', '1080', '480', '360']
          : ['1080', '720', '480', '360'];

      for (const q of qualityOrder) {
        const entry = Array.isArray(links[q]) ? links[q][0] : links[q];
        const rawSrc = entry?.src;
        if (typeof rawSrc === 'string' && rawSrc) {
          const decrypted = decryptKodikSrc(rawSrc);
          if (decrypted) return decrypted;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const kodikLink = req.nextUrl.searchParams.get('kodikLink') || '';
  const qualityParam = req.nextUrl.searchParams.get('quality') || '1080';
  let rawUrl = req.nextUrl.searchParams.get('url') || '';

  if (kodikLink && !rawUrl) {
    const resolvedHls = await resolveKodikEmbedToHlsUrl(kodikLink, qualityParam);
    if (!resolvedHls) {
      return NextResponse.json(
        { error: 'Could not resolve voiceover stream from Kodik' },
        { status: 502 }
      );
    }
    rawUrl = resolvedHls;
  }

  const targetUrl = normalizeSafeExternalUrl(rawUrl);

  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Invalid or unsafe stream URL' },
      { status: 400 }
    );
  }

  const reqHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
    Accept: '*/*',
  };

  if (targetUrl.includes('kodik') || targetUrl.includes('solodcdn')) {
    reqHeaders['Referer'] = 'https://kodik.info/';
  }

  const rangeHeader = req.headers.get('range');
  if (rangeHeader) {
    reqHeaders['Range'] = rangeHeader;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: reqHeaders,
      cache: 'no-store',
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream stream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    const isM3u8 =
      targetUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegurl');

    if (isM3u8) {
      const text = await upstream.text();
      const lines = text.split(/\r?\n/);

      const rewritten = lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith('#')) {
            if (trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/g, (_, uri: string) => {
                const fullUri = resolveRelativeUrl(targetUrl, uri);
                return `URI="/api/stream?url=${encodeURIComponent(fullUri)}"`;
              });
            }
            return line;
          }

          const fullSegmentUrl = resolveRelativeUrl(targetUrl, trimmed);
          return `/api/stream?url=${encodeURIComponent(fullSegmentUrl)}`;
        })
        .join('\n');

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Binary video/audio segment (.ts, .m4s, .aac, .mp4, key)
    const responseHeaders = new Headers();
    responseHeaders.set(
      'Content-Type',
      upstream.headers.get('content-type') || 'video/mp2t'
    );
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'public, max-age=3600');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders.set('Accept-Ranges', acceptRanges);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to proxy stream', details: err?.message || 'Unknown error' },
      { status: 502 }
    );
  }
}
