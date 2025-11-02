#!/usr/bin/env bash
set -euo pipefail

# Helper script to publish Cloudflare worker locally (needs wrangler CLI installed)
# Usage:
#   HELIUS_API_KEY=xxx COINMARKETCAP_API_KEY=yyy CF_ACCOUNT_ID=zzz wrangler publish --config ./cloudflare/wrangler.toml

if ! command -v wrangler >/dev/null 2>&1; then
  echo "wrangler CLI not found. Install it: npm install -g wrangler@3"
  exit 1
fi

echo "Building frontend..."
npm run build

echo "Publishing Cloudflare worker (using ./cloudflare/wrangler.toml)..."
# Ensure env vars are provided in the environment or via wrangler.toml
wrangler publish --config ./cloudflare/wrangler.toml --env production

echo "Published."
