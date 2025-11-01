# Wallet-c36 Cloudflare Pages + Functions Setup

This project is configured for Cloudflare Pages with Functions.
Functions are under `functions/api/*` and the frontend builds to `dist/spa`.

## Key endpoints
- POST /api/solana-rpc   -> Proxy JSON-RPC to Alchemy
- POST /api/wallet-balance -> { walletAddress }
- POST /api/wallet-token-accounts -> { walletAddress }
- POST /api/wallet-transactions -> { walletAddress, limit }

## Deploy
1. Add environment variable `ALCHEMY_RPC_URL` in Cloudflare Pages settings
2. `git add . && git commit -m "Add CF functions" && git push`
3. Cloudflare Pages will auto-build (ensure Build command: `npm run build`, Output dir: `dist/spa`)

## Local dev
- Install packages: `npm install`
- Run dev server: `npm run dev` (functions won't run locally via Pages; use local mocks or `wrangler pages dev`)

