import { Controller, Get, Query, Req, Res, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { isSafeExternalUrl, sanitizeProxyHeaders } from '../../common/security/security.util';

@Controller('proxy')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('hls')
  async proxyHls(
    @Query('url') targetUrl: string,
    @Query('headers') rawHeaders: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!targetUrl) {
      return res.status(400).send('Missing url query parameter');
    }
    if (!isSafeExternalUrl(targetUrl)) {
      return res.status(403).json({ statusCode: 403, message: 'Blocked unsafe or private proxy URL' });
    }

    let parsedHeaders: Record<string, string> = {};
    if (rawHeaders) {
      try {
        parsedHeaders = sanitizeProxyHeaders(JSON.parse(rawHeaders));
      } catch (e) {}
    }

    const host = req.get('host') || 'localhost:4000';
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const protocol = forwardedProto || (isLocalHost ? req.protocol || 'http' : 'https');
    const proxyBase = `${protocol}://${host}/api/proxy`;
    const safeTargetUrl = targetUrl.replace(/^http:\/\//i, 'https://');

    return this.proxyService.proxyManifest(safeTargetUrl, parsedHeaders, proxyBase, res);
  }

  @Get('segment')
  async proxySegment(
    @Query('url') targetUrl: string,
    @Query('headers') rawHeaders: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response
  ) {
    if (!targetUrl) {
      return res.status(400).send('Missing url query parameter');
    }
    if (!isSafeExternalUrl(targetUrl)) {
      return res.status(403).json({ statusCode: 403, message: 'Blocked unsafe or private proxy URL' });
    }

    let parsedHeaders: Record<string, string> = {};
    if (rawHeaders) {
      try {
        parsedHeaders = sanitizeProxyHeaders(JSON.parse(rawHeaders));
      } catch (e) {}
    }

    return this.proxyService.proxySegment(targetUrl, parsedHeaders, range, res);
  }
}
