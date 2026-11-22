-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'SERIES');
CREATE TYPE "SourceType" AS ENUM ('HLS', 'DASH', 'MP4', 'EXTERNAL');

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sessions
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: profiles
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isKidsMode" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "pinHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_settings
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "accentColor" TEXT NOT NULL DEFAULT '#8065FF',
    "language" TEXT NOT NULL DEFAULT 'ru',
    "autoplayNext" BOOLEAN NOT NULL DEFAULT true,
    "defaultQuality" TEXT NOT NULL DEFAULT '1080p',
    "subtitlesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "subtitleLanguage" TEXT NOT NULL DEFAULT 'ru',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: movies
CREATE TABLE "movies" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "imdbId" TEXT,
    "kinopoiskId" INTEGER,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "tagline" TEXT,
    "overview" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "releaseYear" INTEGER,
    "durationMinutes" INTEGER,
    "voteAverage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ageRating" TEXT,
    "genres" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: series
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "imdbId" TEXT,
    "kinopoiskId" INTEGER,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "tagline" TEXT,
    "overview" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "firstAirYear" INTEGER,
    "voteAverage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ageRating" TEXT,
    "genres" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable: seasons
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "posterPath" TEXT,
    "episodeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable: episodes
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "overview" TEXT,
    "stillPath" TEXT,
    "durationMinutes" INTEGER,
    "airDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sources
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'HLS',
    "url" TEXT NOT NULL,
    "quality" TEXT NOT NULL DEFAULT '1080p',
    "language" TEXT NOT NULL DEFAULT 'ru',
    "voiceActing" TEXT,
    "subtitles" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "movieId" TEXT,
    "seriesId" TEXT,
    "episodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable: favorites
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "movieId" TEXT,
    "seriesId" TEXT,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable: watch_history
CREATE TABLE "watch_history" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "movieId" TEXT,
    "seriesId" TEXT,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "title" TEXT NOT NULL,
    "posterPath" TEXT,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watch_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: watch_progress
CREATE TABLE "watch_progress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "movieId" TEXT,
    "seriesId" TEXT,
    "seasonNumber" INTEGER NOT NULL DEFAULT 0,
    "episodeNumber" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "posterPath" TEXT,
    "currentTime" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "duration" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "watch_progress_pkey" PRIMARY KEY ("id")
);

-- Unique & Performance Indexes
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");
CREATE INDEX "profiles_userId_idx" ON "profiles"("userId");
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");
CREATE UNIQUE INDEX "movies_tmdbId_key" ON "movies"("tmdbId");
CREATE UNIQUE INDEX "movies_imdbId_key" ON "movies"("imdbId");
CREATE UNIQUE INDEX "movies_kinopoiskId_key" ON "movies"("kinopoiskId");
CREATE INDEX "movies_releaseYear_idx" ON "movies"("releaseYear");
CREATE INDEX "movies_voteAverage_idx" ON "movies"("voteAverage");
CREATE UNIQUE INDEX "series_tmdbId_key" ON "series"("tmdbId");
CREATE UNIQUE INDEX "series_imdbId_key" ON "series"("imdbId");
CREATE UNIQUE INDEX "series_kinopoiskId_key" ON "series"("kinopoiskId");
CREATE INDEX "series_firstAirYear_idx" ON "series"("firstAirYear");
CREATE INDEX "series_voteAverage_idx" ON "series"("voteAverage");
CREATE UNIQUE INDEX "seasons_seriesId_seasonNumber_key" ON "seasons"("seriesId", "seasonNumber");
CREATE UNIQUE INDEX "episodes_seasonId_episodeNumber_key" ON "episodes"("seasonId", "episodeNumber");
CREATE INDEX "sources_movieId_idx" ON "sources"("movieId");
CREATE INDEX "sources_seriesId_episodeId_idx" ON "sources"("seriesId", "episodeId");
CREATE UNIQUE INDEX "favorites_profileId_mediaType_tmdbId_key" ON "favorites"("profileId", "mediaType", "tmdbId");
CREATE INDEX "favorites_profileId_createdAt_idx" ON "favorites"("profileId", "createdAt");
CREATE INDEX "watch_history_profileId_watchedAt_idx" ON "watch_history"("profileId", "watchedAt");
CREATE UNIQUE INDEX "watch_progress_profileId_mediaType_tmdbId_seasonNumber_episodeNumber_key"
    ON "watch_progress"("profileId", "mediaType", "tmdbId", "seasonNumber", "episodeNumber");
CREATE INDEX "watch_progress_profileId_updatedAt_idx" ON "watch_progress"("profileId", "updatedAt");

-- Foreign Keys
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sources" ADD CONSTRAINT "sources_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sources" ADD CONSTRAINT "sources_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sources" ADD CONSTRAINT "sources_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
