import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum MediaTypeDto {
  MOVIE = 'MOVIE',
  SERIES = 'SERIES',
}

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(15_000_000)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15_000_000)
  bannerUrl?: string;

  @IsOptional()
  @IsBoolean()
  isKidsMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  pin?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15_000_000)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15_000_000)
  bannerUrl?: string;

  @IsOptional()
  @IsBoolean()
  isKidsMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;
}

export class AddFavoriteDto {
  @IsString()
  profileId: string;

  @IsEnum(MediaTypeDto)
  mediaType: MediaTypeDto;

  @IsInt()
  @Min(1)
  tmdbId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  posterPath?: string;
}

export class SyncProgressDto {
  @IsString()
  profileId: string;

  @IsEnum(MediaTypeDto)
  mediaType: MediaTypeDto;

  @IsInt()
  @Min(1)
  tmdbId: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  seasonNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  episodeNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  posterPath?: string;

  @IsNumber()
  @Min(0)
  currentTime: number;

  @IsNumber()
  @Min(0)
  duration: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;
}

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsBoolean()
  autoplayNext?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultQuality?: string;

  @IsOptional()
  @IsBoolean()
  subtitlesEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  subtitleLanguage?: string;

  @IsOptional()
  @IsBoolean()
  reducedMotion?: boolean;
}
