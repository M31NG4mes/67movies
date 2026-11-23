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

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url') || '';
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
