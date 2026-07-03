# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

# Enable corepack for pnpm (pin to v9 matching lockfile)
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy manifest files first for better layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json tsconfig.base.json package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/liquidity-hunter/package.json ./artifacts/liquidity-hunter/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/

RUN pnpm install --no-frozen-lockfile

# Copy full source
COPY artifacts ./artifacts
COPY lib ./lib
COPY tsconfig.json tsconfig.base.json ./

# Build only the API server (frontend is served by Vite dev server or built separately)
RUN pnpm --filter @workspace/api-server run build

# ---- Runtime stage ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace config + built artifacts
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/artifacts/api-server/package.json ./artifacts/api-server/
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

# Install production deps only for the server
RUN pnpm install --no-frozen-lockfile --prod --filter @workspace/api-server

EXPOSE 3001
CMD ["node", "artifacts/api-server/dist/index.mjs"]
