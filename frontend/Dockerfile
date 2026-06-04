FROM node:20-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

# Copy workspace manifest and root lockfile first (maximises layer cache reuse)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/

# Install only the frontend workspace (and its local dependency @naologic/shared)
RUN pnpm install --frozen-lockfile --filter timeline-frontend --filter @naologic/shared

# Copy source for both the frontend and the shared package it imports
COPY frontend/. ./frontend/
COPY shared/. ./shared/

WORKDIR /app/frontend

EXPOSE 4200

CMD ["pnpm", "exec", "ng", "serve", "--host", "0.0.0.0", "--poll", "500"]
