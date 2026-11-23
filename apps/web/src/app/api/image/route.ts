import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let target: URL;
  try {
    const normalized = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
    target = new URL(normalized);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: `${target.protocol}//${target.host}/`,
      },
      redirect: 'follow',
    });

    if (!upstream.ok || !upstream.body) {
      return new NextResponse(null, { status: upstream.status || 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
