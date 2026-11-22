import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { MediaService } from './media.service';
import { ExternalMediaService } from './external-media.service';
import { MediaType } from '@cinemaflow/types';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly externalMediaService: ExternalMediaService,
  ) {}

  @Get('trending')
  async getTrending(
    @Query('type') type: 'movie' | 'tv' | 'all' = 'all',
    @Query('timeWindow') timeWindow: 'day' | 'week' = 'day',
    @Query('page') page = '1'
  ) {
    return this.mediaService.getTrending(type, timeWindow, parseInt(page, 10) || 1);
  }

  @Get('popular/movies')
  async getPopularMovies(@Query('page') page = '1') {
    return this.mediaService.getPopularMovies(parseInt(page, 10) || 1);
  }

  @Get('popular/tv')
  async getPopularTv(@Query('page') page = '1') {
    return this.mediaService.getPopularTv(parseInt(page, 10) || 1);
  }

  @Get('new/movies')
  async getNewMovies(@Query('page') page = '1') {
    return this.mediaService.getNewMovies(parseInt(page, 10) || 1);
  }

  @Get('new/tv')
  async getNewTv(@Query('page') page = '1') {
    return this.mediaService.getNewTv(parseInt(page, 10) || 1);
  }

  @Get('calendar')
  async getCalendar(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('type') type: 'all' | 'movie' | 'tv' = 'all'
  ) {
    const now = new Date();
    const y = year ? parseInt(year, 10) || now.getFullYear() : now.getFullYear();
    const m = month ? parseInt(month, 10) || now.getMonth() + 1 : now.getMonth() + 1;
    return this.mediaService.getCalendarReleases(y, Math.min(12, Math.max(1, m)), type);
  }

  @Get('genres')
  async getGenres(@Query('type') type: MediaType = 'movie') {
    return this.mediaService.getGenres(type);
  }

  @Get('discover')
  async discover(
    @Query('type') type: MediaType = 'movie',
    @Query('category') category?: string,
    @Query('genreId') genreId?: string,
    @Query('sort') sort: 'popularity' | 'rating' | 'date' | 'votes' = 'popularity',
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
    @Query('minRating') minRating?: string,
    @Query('lang') originalLanguage?: string,
    @Query('page') page = '1'
  ) {
    return this.mediaService.discoverByGenre(
      type,
      genreId ? parseInt(genreId, 10) : undefined,
      parseInt(page, 10) || 1,
      sort,
      {
        category,
        yearFrom: yearFrom ? parseInt(yearFrom, 10) : undefined,
        yearTo: yearTo ? parseInt(yearTo, 10) : undefined,
        minRating: minRating ? parseFloat(minRating) : undefined,
        originalLanguage: originalLanguage || undefined,
      }
    );
  }

  @Get('search')
  async search(@Query('q') query = '', @Query('page') page = '1') {
    return this.mediaService.search(query, parseInt(page, 10) || 1);
  }

  @Get('movie/:id')
  async getMovieDetails(@Param('id') id: string) {
    return this.mediaService.getMovieDetails(id);
  }

  @Get('tv/:id')
  async getTvDetails(@Param('id') id: string) {
    return this.mediaService.getTvDetails(id);
  }

  @Get('tv/:id/season/:seasonNumber')
  async getTvSeason(
    @Param('id') id: string,
    @Param('seasonNumber') seasonNumber: string
  ) {
    return this.mediaService.getTvSeason(id, parseInt(seasonNumber, 10) || 1);
  }

  @Get('tvmaze-schedule')
  async getTvMazeSchedule(@Query('date') date?: string) {
    return this.externalMediaService.getTvMazeSchedule(date);
  }

  @Get('extra/:id')
  async getExtras(
    @Param('id') id: string,
    @Query('type') type: 'movie' | 'tv' = 'movie',
    @Query('title') title?: string,
    @Query('originalTitle') originalTitle?: string,
    @Query('year') year?: string,
    @Query('imdbId') imdbId?: string,
    @Query('isAnime') isAnime?: string,
  ) {
    return this.externalMediaService.getAllExtras({
      tmdbId: id,
      type,
      title,
      originalTitle,
      year,
      imdbId,
      isAnime: isAnime === 'true',
    });
  }

  @Get('kinopoisk-redirect')
  async kinopoiskRedirect(
    @Query('tmdbId') tmdbId: string,
    @Query('type') type: MediaType = 'movie',
    @Query('title') title = '',
    @Query('year') year = '',
    @Res() res: Response
  ) {
    const targetUrl = await this.mediaService.resolveKinopoiskUrl({
      tmdbId,
      type,
      title,
      year,
    });
    return res.redirect(302, targetUrl);
  }

  @Get(':id')
  async getDetails(
    @Param('id') id: string,
    @Query('type') type?: MediaType
  ) {
    return this.mediaService.getDetails(id, type);
  }
}
