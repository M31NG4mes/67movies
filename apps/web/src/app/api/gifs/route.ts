import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GIPHY_KEYS = [
  process.env.GIPHY_API_KEY || '',
  'GlVGYHkr3WSBnllca54iNt0yFbjz7L65',
  'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh',
].filter(Boolean);

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const limit = Math.min(40, Math.max(8, parseInt(req.nextUrl.searchParams.get('limit') || '32', 10) || 32));

  for (const apiKey of GIPHY_KEYS) {
    try {
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13&lang=ru`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(apiKey)}&limit=${limit}&rating=pg-13`;

      const res = await fetch(endpoint, { cache: 'no-store' });
      if (!res.ok) continue;

      const json: any = await res.json();
      const data: any[] = Array.isArray(json?.data) ? json.data : [];
      if (data.length === 0 && q) {
        // Also try English/default lang if Russian returned 0
        const fallbackRes = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13`,
          { cache: 'no-store' }
        );
        if (fallbackRes.ok) {
          const fj: any = await fallbackRes.json();
          if (Array.isArray(fj?.data) && fj.data.length > 0) {
            data.push(...fj.data);
          }
        }
      }

      if (data.length > 0) {
        const items = data
          .map((item) => {
            const images = item?.images || {};
            const url =
              images.downsized?.url ||
              images.fixed_height?.url ||
              images.original?.url;
            const preview =
              images.fixed_height_small?.url ||
              images.fixed_width_small?.url ||
              images.fixed_height?.url ||
              url;
            if (!url) return null;
            return {
              id: String(item.id),
              title: String(item.title || 'GIPHY GIF'),
              url: String(url),
              preview: String(preview),
            };
          })
          .filter(Boolean);

        if (items.length > 0) {
          return NextResponse.json({ items, source: 'giphy' });
        }
      }
    } catch {
      // try next key
    }
  }

  return NextResponse.json({ items: [], source: 'fallback' });
}
