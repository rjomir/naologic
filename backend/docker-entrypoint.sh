#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL…"
until npx prisma db execute --stdin <<'SQL'
SELECT 1;
SQL
do
  echo "    postgres not ready, retrying in 2s…"
  sleep 2
done

echo "==> Pushing schema…"
npx prisma db push --accept-data-loss

echo "==> Seeding database…"
pnpm db:seed

echo "==> Starting API server…"
exec pnpm start
