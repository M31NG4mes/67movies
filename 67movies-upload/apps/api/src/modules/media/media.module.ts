import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { TmdbService } from './tmdb.service';
import { ExternalMediaService } from './external-media.service';
import { KinopoiskProviderService } from './providers/kinopoisk.provider';
import { AnimeProviderService } from './providers/anime.provider';
import { TvMazeProviderService } from './providers/tvmaze.provider';
import { OmdbProviderService } from './providers/omdb.provider';
import { AniLibertyProviderService } from './providers/aniliberty.provider';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    TmdbService,
    ExternalMediaService,
    KinopoiskProviderService,
    AnimeProviderService,
    TvMazeProviderService,
    OmdbProviderService,
    AniLibertyProviderService,
  ],
  exports: [
    MediaService,
    TmdbService,
    ExternalMediaService,
    KinopoiskProviderService,
    AnimeProviderService,
    TvMazeProviderService,
    OmdbProviderService,
    AniLibertyProviderService,
  ],
})
export class MediaModule {}
