import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('CinemaFlow-Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Allow larger JSON payloads for base64 avatar/banner uploads (up to 10MB files)
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  // Enable CORS for frontend and TV webviews
  app.enableCors({
    origin: '*',
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
    })
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🎬 CinemaFlow API running on: http://localhost:${port}/api`);
}

bootstrap();
