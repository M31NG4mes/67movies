import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { TmdbService } from './tmdb.service';
import { ExternalMediaService } from './external-media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, TmdbService, ExternalMediaService],
  exports: [MediaService, TmdbService, ExternalMediaService],
})
export class MediaModule {}
