import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum AdminRoleDto {
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  USER = 'USER',
}

export enum SourceCategoryDto {
  METADATA = 'METADATA',
  STREAMING = 'STREAMING',
  TRAILERS = 'TRAILERS',
  SCHEDULE = 'SCHEDULE',
  ANIME = 'ANIME',
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEnum(AdminRoleDto)
  role?: AdminRoleDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}

export class CreateMediaSourceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code: string;

  @IsOptional()
  @IsEnum(SourceCategoryDto)
  type?: SourceCategoryDto;

  @IsUrl({ require_tld: false }, { message: 'Укажите корректный URL источника' })
  baseUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  healthPath?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30000)
  timeoutMs?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class UpdateMediaSourceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(SourceCategoryDto)
  type?: SourceCategoryDto;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'Укажите корректный URL источника' })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  healthPath?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30000)
  timeoutMs?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class UpdateSiteSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  siteName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  siteTagline?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  announcementBanner?: string;

  @IsOptional()
  @IsBoolean()
  defaultAgeRestriction18?: boolean;

  @IsOptional()
  @IsString()
  defaultTheme?: string;

  @IsOptional()
  @IsBoolean()
  newYearForceEnabled?: boolean;
}
