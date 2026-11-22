import { Controller, Get, Query, Req, Res, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';

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

    let parsedHeaders: Record<string, string> = {};
    if (rawHeaders) {
      try {
        parsedHeaders = JSON.parse(rawHeaders);
      } catch (e) {}
    }

    const host = req.get('host') || 'localhost:4000';
    const protocol = req.protocol || 'http';
    const proxyBase = `${protocol}://${host}/api/proxy`;

    return this.proxyService.proxyManifest(targetUrl, parsedHeaders, proxyBase, res);
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

    let parsedHeaders: Record<string, string> = {};
    if (rawHeaders) {
      try {
        parsedHeaders = JSON.parse(rawHeaders);
      } catch (e) {}
    }

    return this.proxyService.proxySegment(targetUrl, parsedHeaders, range, res);
  }
}
