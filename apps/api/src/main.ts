import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { isAllowedOrigin } from './common/security/security.util';

async function bootstrap() {
  const logger = new Logger('CinemaFlow-Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Allow JSON payloads for compressed avatar/banner/chat photo uploads while bounding RAM
  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));

  // Security headers (XSS, Clickjacking, MIME-sniffing protection)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.removeHeader('X-Powered-By');

    // HTTP browser/CDN caching for public read-only media catalog endpoints
    if (req.method === 'GET' && req.originalUrl.startsWith('/api/media/') && !req.originalUrl.includes('redirect')) {
      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    }

    // CSRF defense: reject state-changing browser requests from untrusted Origin
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    const origin = req.headers.origin as string | undefined;
    if (isMutating && origin && !isAllowedOrigin(origin, process.env.CORS_ORIGIN)) {
      return res.status(403).json({
        statusCode: 403,
        message: 'CSRF protection: untrusted Origin header',
      });
    }

    return next();
  });

  // Strict dynamic CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin, process.env.CORS_ORIGIN)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Input validation & uniform error handling
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🎬 67movies API running on: http://localhost:${port}/api`);
}

bootstrap();
