import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Response } from 'express';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  /**
   * Proxies and rewrites HLS m3u8 playlists so child segments and sub-playlists route through the proxy
   */
  async proxyManifest(
    targetUrl: string,
    customHeaders: Record<string, string>,
    proxyHost: string,
    res: Response
  ) {
    try {
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          ...customHeaders,
        },
        responseType: 'text',
        timeout: 10000,
      });

      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const lines = response.data.split('\n');
      const rewrittenLines = lines.map((line: string) => {
        const trimmed = line.trim();
        // If line is empty or is an HLS tag (starts with #)
        if (!trimmed || trimmed.startsWith('#')) {
          // Handle URI attributes in tags like #EXT-X-KEY:METHOD=AES-128,URI="..."
          if (trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
              const fullKeyUrl = uri.startsWith('http') ? uri : `${baseUrl}${uri}`;
              const proxiedKey = `${proxyHost}/segment?url=${encodeURIComponent(fullKeyUrl)}&headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;
              return `URI="${proxiedKey}"`;
            });
          }
          return line;
        }

        // Segment or child playlist URL
        const fullSegmentUrl = trimmed.startsWith('http') ? trimmed : `${baseUrl}${trimmed}`;
        const isM3u8 = fullSegmentUrl.includes('.m3u8');
        const endpoint = isM3u8 ? 'hls' : 'segment';

        return `${proxyHost}/${endpoint}?url=${encodeURIComponent(fullSegmentUrl)}&headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;
      });

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(rewrittenLines.join('\n'));
    } catch (err: any) {
      this.logger.error(`Manifest proxy failed for [${targetUrl}]: ${err.message}`);
      res.status(502).json({ error: 'Failed to proxy HLS manifest', details: err.message });
    }
  }

  /**
   * Streams video chunks (.ts, .m4s, mp4) directly to client with HTTP range support
   */
  async proxySegment(
    targetUrl: string,
    customHeaders: Record<string, string>,
    clientRange: string | undefined,
    res: Response
  ) {
    try {
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        ...customHeaders,
      };

      if (clientRange) {
        headers['Range'] = clientRange;
      }

      const response = await axios({
        method: 'GET',
        url: targetUrl,
        headers,
        responseType: 'stream',
        timeout: 15000,
        validateStatus: () => true, // Pass through 200, 206, etc.
      });

      res.status(response.status);
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', String(response.headers['content-type']));
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', String(response.headers['content-length']));
      }
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', String(response.headers['content-range']));
      }
      if (response.headers['accept-ranges']) {
        res.setHeader('Accept-Ranges', String(response.headers['accept-ranges']));
      }

      response.data.pipe(res);
    } catch (err: any) {
      this.logger.error(`Segment proxy failed for [${targetUrl}]: ${err.message}`);
      res.status(502).send('Segment proxy failure');
    }
  }
}
