import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { HistoryService } from './history.service';
import { PlaybackSyncPayload } from '@cinemaflow/types';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Post('sync')
  async syncProgress(
    @Query('profileId') profileId = 'default-profile',
    @Body() payload: PlaybackSyncPayload
  ) {
    return this.historyService.syncProgress(profileId, payload);
  }

  @Get('progress/:mediaId')
  async getProgress(
    @Param('mediaId') mediaId: string,
    @Query('profileId') profileId = 'default-profile'
  ) {
    return this.historyService.getProgress(profileId, mediaId);
  }

  @Get('continue-watching')
  async getContinueWatching(@Query('profileId') profileId = 'default-profile') {
    return this.historyService.getContinueWatching(profileId);
  }
}
