FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.6.5 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json packages/types/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile --filter @cinemaflow/web...

COPY packages/types packages/types
COPY apps/web apps/web

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TMDB_IMAGE_BASE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TMDB_IMAGE_BASE=$NEXT_PUBLIC_TMDB_IMAGE_BASE

RUN pnpm --filter @cinemaflow/types build || true
RUN pnpm --filter @cinemaflow/web build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "--filter", "@cinemaflow/web", "start"]
