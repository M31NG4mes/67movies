FROM node:20-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @cinemaflow/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
ENV PORT 3000
CMD ["node", "apps/web/server.js"]
