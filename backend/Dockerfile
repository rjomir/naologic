FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

# Copy every workspace manifest so pnpm can resolve the full workspace graph
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json  ./backend/
COPY frontend/package.json ./frontend/
COPY shared/package.json   ./shared/

# Full workspace install — creates node_modules for every workspace,
# which is required so workspace-local .bin symlinks resolve correctly
RUN pnpm install --frozen-lockfile

# Generate Prisma client before source arrives (separate cache layer)
COPY backend/prisma ./backend/prisma
RUN pnpm --filter production-reflow db:generate

# Copy source for backend and the shared package it imports at runtime
COPY backend/. ./backend/
COPY shared/.  ./shared/

EXPOSE 3000

COPY backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
