FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

# Copy workspace manifest and root lockfile first (maximises layer cache reuse)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install only the backend workspace (and its local dependency @naologic/shared)
RUN pnpm install --frozen-lockfile --filter production-reflow --filter @naologic/shared

# Generate Prisma client before source arrives (separate cache layer)
COPY backend/prisma ./backend/prisma
RUN pnpm --filter production-reflow db:generate

# Copy source for both the backend and the shared package it imports
COPY backend/. ./backend/
COPY shared/. ./shared/

WORKDIR /app/backend

EXPOSE 3000

COPY backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
