import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import {
  AddFavoriteDto,
  CreateProfileDto,
  MediaTypeDto,
  SyncProgressDto,
  UpdateProfileDto,
  UpdateUserSettingsDto,
} from './dto/users.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- Profiles ---

  @Get('profiles')
  listProfiles(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listProfiles(user.userId);
  }

  @Post('profiles')
  createProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProfileDto) {
    return this.usersService.createProfile(user.userId, dto);
  }

  @Patch('profiles/:id')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, id, dto);
  }

  @Delete('profiles/:id')
  deleteProfile(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deleteProfile(user.userId, id);
  }

  // --- Favorites ---

  @Get('favorites')
  listFavorites(
    @CurrentUser() user: AuthenticatedUser,
    @Query('profileId') profileId: string,
  ) {
    return this.usersService.listFavorites(user.userId, profileId);
  }

  @Post('favorites')
  addFavorite(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddFavoriteDto) {
    return this.usersService.addFavorite(user.userId, dto);
  }

  @Delete('favorites/:tmdbId')
  removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('profileId') profileId: string,
    @Query('mediaType') mediaType: MediaTypeDto = MediaTypeDto.MOVIE,
  ) {
    return this.usersService.removeFavorite(user.userId, profileId, mediaType, tmdbId);
  }

  // --- Watch Progress & History (Cross-device sync) ---

  @Post('progress/sync')
  syncProgress(@CurrentUser() user: AuthenticatedUser, @Body() dto: SyncProgressDto) {
    return this.usersService.syncProgress(user.userId, dto);
  }

  @Get('progress/continue-watching')
  getContinueWatching(
    @CurrentUser() user: AuthenticatedUser,
    @Query('profileId') profileId: string,
  ) {
    return this.usersService.getContinueWatching(user.userId, profileId);
  }

  @Get('progress/history')
  getWatchHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('profileId') profileId: string,
  ) {
    return this.usersService.getWatchHistory(user.userId, profileId);
  }

  @Delete('progress/history/:id')
  deleteHistoryItem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deleteHistoryItem(user.userId, id);
  }

  @Get('progress/:tmdbId')
  getProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('profileId') profileId: string,
    @Query('mediaType') mediaType: MediaTypeDto = MediaTypeDto.MOVIE,
    @Query('seasonNumber') seasonNumber?: string,
    @Query('episodeNumber') episodeNumber?: string,
  ) {
    return this.usersService.getProgress(
      user.userId,
      profileId,
      mediaType,
      tmdbId,
      seasonNumber ? parseInt(seasonNumber, 10) || 0 : 0,
      episodeNumber ? parseInt(episodeNumber, 10) || 0 : 0,
    );
  }

  // --- User Settings ---

  @Get('settings')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getSettings(user.userId);
  }

  @Patch('settings')
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserSettingsDto) {
    return this.usersService.updateSettings(user.userId, dto);
  }
}
