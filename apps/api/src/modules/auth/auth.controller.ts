import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user.sessionId, dto?.refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.userId, user.sessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  async revokeSession(@CurrentUser() user: AuthenticatedUser, @Param('id') sessionId: string) {
    return this.authService.revokeSession(user.userId, sessionId);
  }
}
