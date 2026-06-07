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
# which is required so workspace-local .bin symlinks resolve correctly.
# --ignore-scripts skips backend's postinstall (prisma generate) which
# requires schema files not present in this image.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source for frontend and the shared package it imports at runtime
COPY frontend/. ./frontend/
COPY shared/.   ./shared/

EXPOSE 4200

# pnpm --filter runs the script from inside the workspace directory,
# so ng can be resolved via /app/frontend/node_modules/.bin/ng
CMD ["pnpm", "--filter", "timeline-frontend", "start"]
