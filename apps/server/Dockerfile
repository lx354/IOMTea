FROM node:24-alpine AS base
RUN npm install -g pnpm@9.15.9
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json packages/shared-types/
COPY apps/server/package.json apps/server/tsconfig.json apps/server/drizzle.config.ts apps/server/

RUN pnpm install --no-frozen-lockfile

COPY packages/shared-types/src packages/shared-types/src/
COPY apps/server/src apps/server/src/
COPY apps/server/drizzle apps/server/drizzle/

RUN npx turbo build --filter=@iomtea/server
RUN pnpm --filter @iomtea/server deploy --prod /deploy

FROM base AS runner
RUN apk add --no-cache wget
COPY --from=builder /deploy /app
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
EXPOSE 5858
CMD sh -c "pnpm exec tsx node_modules/drizzle-kit/bin.cjs migrate && pnpm exec tsx src/index.ts"
