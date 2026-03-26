#!/bin/bash
set -e

ENV="${1:-prod}"
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DEPLOY_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "Building with OpenNext for Cloudflare..."
npx opennextjs-cloudflare build

if [ "$ENV" = "dev" ]; then
  echo "Deploying to DEV (masterbranch-dev.workers.dev)..."
  npx wrangler deploy --env dev --var GIT_SHA:"$GIT_SHA" --var DEPLOY_TIME:"$DEPLOY_TIME"
  echo "Done! Preview at: https://masterbranch-dev.natnaelme4.workers.dev"
elif [ "$ENV" = "canary" ]; then
  echo "Deploying to CANARY (masterbranch-canary.workers.dev)..."
  npx wrangler deploy --env canary --var GIT_SHA:"$GIT_SHA" --var DEPLOY_TIME:"$DEPLOY_TIME"
  echo "Done! Preview at: https://masterbranch-canary.natnaelme4.workers.dev"
  echo "When ready, run: ./deploy.sh prod"
else
  echo "Deploying to PRODUCTION (masterbranch.club)..."
  npx wrangler deploy --var GIT_SHA:"$GIT_SHA" --var DEPLOY_TIME:"$DEPLOY_TIME"
  echo "Done!"
fi
