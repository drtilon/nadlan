#!/usr/bin/env bash
# Deploy nadlan in production mode (static frontend + nginx). Run on the server from repo root.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "Stopping any running stack..."
$COMPOSE down --remove-orphans || true

echo "Building production images (frontend may take a few minutes)..."
$COMPOSE build --no-cache frontend backend

echo "Starting services..."
$COMPOSE up -d

echo "Waiting for MySQL..."
sleep 15

echo "Service status:"
$COMPOSE ps

echo ""
echo "Done. Open https://old.shefaug.com/tenants (or your configured host)."
echo "If you still see a Vite error overlay, the server is not using this compose file — re-run this script."
