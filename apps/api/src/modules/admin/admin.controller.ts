import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import {
  CreateMediaSourceDto,
  UpdateAdminUserDto,
  UpdateMediaSourceDto,
  UpdateSiteSettingsDto,
} from './dto/admin.dto';

/**
 * Every administrative action is enforced server-side via JwtAuthGuard + RolesGuard.
 * RolesGuard checks live user role and active status directly against the database.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Access Check & First Admin Bootstrap ---

  @Get('access')
  getAccessStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.getAccessStatus(user.userId);
  }

  @Post('bootstrap')
  bootstrapFirstAdmin(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.bootstrapFirstAdmin(user.userId);
  }

  // --- Dashboard & Watch Analytics (ADMIN + MODERATOR) ---

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  getDashboardStats(@Query('days') days?: string) {
    return this.adminService.getDashboardStats(days ? parseInt(days, 10) : 14);
  }

  // --- Users & Accounts Management ---

  @Get('users')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  listUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listUsers({ search, role, status });
  }

  @Patch('users/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  updateUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminService.updateUser(user, id, dto);
  }

  @Post('users/:id/revoke-sessions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  revokeUserSessions(@Param('id') id: string) {
    return this.adminService.revokeAllUserSessions(id);
  }

  @Delete('users/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteUser(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.adminService.deleteUser(user, id);
  }

  // --- Sources Management & Health Checks ---

  @Get('sources')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  listSources() {
    return this.adminService.listSources();
  }

  @Post('sources')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  createSource(@Body() dto: CreateMediaSourceDto) {
    return this.adminService.createSource(dto);
  }

  @Patch('sources/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  updateSource(@Param('id') id: string, @Body() dto: UpdateMediaSourceDto) {
    return this.adminService.updateSource(id, dto);
  }

  @Delete('sources/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteSource(@Param('id') id: string) {
    return this.adminService.deleteSource(id);
  }

  @Post('sources/:id/check')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  checkSourceHealth(@Param('id') id: string) {
    return this.adminService.checkSourceHealth(id);
  }

  @Post('sources/check-all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  checkAllSourcesHealth() {
    return this.adminService.checkAllSourcesHealth();
  }

  // --- Source Error Logs ---

  @Get('source-errors')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  listSourceErrors(@Query('sourceId') sourceId?: string) {
    return this.adminService.listSourceErrors(sourceId);
  }

  @Delete('source-errors')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  clearSourceErrors(@Query('sourceId') sourceId?: string) {
    return this.adminService.clearSourceErrors(sourceId);
  }

  // --- Global Site Settings ---

  @Get('site-settings')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  getSiteSettings() {
    return this.adminService.getSiteSettings();
  }

  @Patch('site-settings')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateSiteSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSiteSettingsDto,
  ) {
    return this.adminService.updateSiteSettings(user.userId, dto);
  }
}
