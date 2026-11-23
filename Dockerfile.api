FROM node:20-alpine AS base
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@10.6.5 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/types/package.json packages/types/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma

RUN pnpm install --no-frozen-lockfile --filter @cinemaflow/api...

COPY packages/types packages/types
COPY apps/api apps/api

RUN pnpm --filter @cinemaflow/types build || true
RUN pnpm --filter @cinemaflow/api prisma:generate
RUN pnpm --filter @cinemaflow/api build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "cd apps/api && npx prisma db push --skip-generate || true && node --max-old-space-size=320 dist/apps/api/src/main"]
