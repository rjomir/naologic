#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL…"
until pnpm --filter production-reflow exec prisma db execute --stdin <<'SQL'
SELECT 1;
SQL
do
  echo "    postgres not ready, retrying in 2s…"
  sleep 2
done

echo "==> Pushing schema…"
pnpm --filter production-reflow exec prisma db push --accept-data-loss

echo "==> Seeding database…"
pnpm --filter production-reflow db:seed

echo "==> Starting API server…"
exec pnpm --filter production-reflow start
