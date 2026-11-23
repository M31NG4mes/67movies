import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MediaTypeDto } from '../../users/dto/users.dto';

export class SendFriendRequestDto {
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Укажите корректный email друга' })
  email?: string;
}

export class UpsertRatingDto {
  @IsInt()
  @Min(1)
  tmdbId: number;

  @IsOptional()
  @IsEnum(MediaTypeDto)
  mediaType?: MediaTypeDto;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  posterPath?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  review?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class CreateCollectionDto {
  @IsString()
  @MinLength(2, { message: 'Название подборки должно быть минимум 2 символа' })
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class AddCollectionItemDto {
  @IsInt()
  @Min(1)
  tmdbId: number;

  @IsOptional()
  @IsEnum(MediaTypeDto)
  mediaType?: MediaTypeDto;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  posterPath?: string;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  gifUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  movieTmdbId?: number;

  @IsOptional()
  @IsEnum(MediaTypeDto)
  movieMediaType?: MediaTypeDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  movieTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moviePosterPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  replyToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  replyToContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  replyToSenderName?: string;
}

export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class ToggleReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji: string;
}

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsArray()
  @IsString({ each: true })
  memberIds: string[];
}

export class AddGroupMembersDto {
  @IsArray()
  @IsString({ each: true })
  memberIds: string[];
}
