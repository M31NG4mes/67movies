import { VideoQuality, VideoStream, StreamFormat } from '@cinemaflow/types';

/**
 * Normalizes common balancer output strings and qualities (e.g. "1080p", "720", "[1080p] https://...")
 */
export class StreamNormalizer {
  static parseQuality(rawQuality?: string | number): VideoQuality {
    if (!rawQuality) return 'auto';
    const str = String(rawQuality).toLowerCase();
    if (str.includes('4k') || str.includes('2160')) return '2160p';
    if (str.includes('1440') || str.includes('2k')) return '1440p';
    if (str.includes('1080')) return '1080p';
    if (str.includes('720')) return '720p';
    if (str.includes('480')) return '480p';
    if (str.includes('360')) return '360p';
    return 'auto';
  }

  static detectFormat(url: string): StreamFormat {
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.m3u8')) return 'hls';
    if (cleanUrl.endsWith('.mpd')) return 'dash';
    if (cleanUrl.endsWith('.mp4')) return 'mp4';
    if (cleanUrl.startsWith('magnet:') || cleanUrl.endsWith('.torrent')) return 'torrent';
    return 'hls'; // Default for most streaming links
  }

  /**
   * Parses typical balancer stream strings like:
   * "[720p]https://site.com/video720.m3u8,[1080p]https://site.com/video1080.m3u8"
   */
  static parseMultiQualityString(
    input: string,
    metadata: {
      providerId: string;
      providerName: string;
      title: string;
      voiceActing?: string;
      season?: number;
      episode?: number;
      headers?: Record<string, string>;
    }
  ): VideoStream[] {
    const streams: VideoStream[] = [];
    if (!input || typeof input !== 'string') return streams;

    // Matches "[1080p]http://... or [720p Ultra]http://..."
    const regex = /\[([^\]]+)\](https?:\/\/[^\s,]+)/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      const rawQuality = match[1];
      const streamUrl = match[2];
      const quality = this.parseQuality(rawQuality);
      const format = this.detectFormat(streamUrl);

      streams.push({
        id: `${metadata.providerId}-${quality}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        providerId: metadata.providerId,
        providerName: metadata.providerName,
        title: `${metadata.title} (${quality})`,
        voiceActing: metadata.voiceActing,
        season: metadata.season,
        episode: metadata.episode,
        quality,
        format,
        streamUrl,
        isProxyRequired: true,
        headers: metadata.headers,
      });
    }

    // Fallback if not bracket-formatted, but a direct link
    if (streams.length === 0 && input.startsWith('http')) {
      const format = this.detectFormat(input);
      streams.push({
        id: `${metadata.providerId}-auto-${Date.now()}`,
        providerId: metadata.providerId,
        providerName: metadata.providerName,
        title: metadata.title,
        voiceActing: metadata.voiceActing,
        season: metadata.season,
        episode: metadata.episode,
        quality: 'auto',
        format,
        streamUrl: input,
        isProxyRequired: true,
        headers: metadata.headers,
      });
    }

    return streams;
  }
}
