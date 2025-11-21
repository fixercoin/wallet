# Wallet-c36 Cloudflare Pages Serverless Setup

This project is configured for Cloudflare Pages with serverless functions.
Frontend builds to `dist` and serverless functions are in `netlify/functions/`.

## Key endpoints

- POST /api/solana-rpc -> Proxy JSON-RPC to Solana
- GET /api/wallet/balance?publicKey=<address> -> Get SOL balance
- GET /api/wallet/tokens?publicKey=<address> -> Get token accounts
- GET /api/dexscreener/price?tokenAddress=<mint> -> Get token price
- POST /api/jupiter/swap -> Execute Jupiter swap
- POST /api/pumpfun/buy -> Buy on Pump.fun
- POST /api/pumpfun/sell -> Sell on Pump.fun

## Local Development

1. Install packages: `npm install`
2. Run dev server: `npm run dev` (starts both frontend on 5173 and backend on 3000)
3. Frontend will proxy `/api` requests to the local Express backend

## Deploy to Cloudflare Pages

1. Connect your repository to Cloudflare Pages:
   - Go to https://netlify.com
   - Click "New site from Git"
   - Select your repository

2. Configure build settings:
   - Build command: `pnpm build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`

3. Set environment variables in Cloudflare Pages dashboard:

   **Required:**
   - `SOLANA_RPC` - Solana RPC endpoint (e.g., https://api.mainnet-beta.solana.com)
     - Or use Helius: https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
     - Or use Ankr: https://rpc.ankr.com/solana

   **Optional:**
   - `COINMARKETCAP_API_KEY` - Get from https://coinmarketcap.com/api/ (for better price data)
   - `BIRDEYE_API_KEY` - Get from https://birdeye.so/

4. Deploy:
   - Cloudflare Pages will auto-build and deploy when you push to your repository
   - Or use Cloudflare Pages CLI: `netlify deploy --prod`

## Project Structure

```
├── client/                 # React frontend
│   ├── components/        # UI components
│   ├── pages/             # Page routes
│   └── lib/               # Utilities and hooks
├── netlify/functions/     # Cloudflare Pages serverless functions
│   ├── api.ts            # Main API handler
│   └── api/              # Nested API routes
├── server/               # Express backend for local development
├── vite.config.mjs      # Vite configuration
├── wrangler.toml         # Cloudflare Pages configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies
```

## How it works

**Local Development:**

- Frontend runs on http://localhost:5173 (Vite)
- Backend runs on http://localhost:3000 (Express)
- Frontend proxies `/api/*` to backend via vite.config.mjs

**Production (Cloudflare Pages):**

- Frontend builds to `dist/` directory
- API requests to `/api/*` are redirected to `/.netlify/functions/api/:splat`
- Cloudflare Pages serverless functions handle all API requests
- Frontend is served with SPA fallback for client-side routing

## Troubleshooting

**API requests failing locally:**

- Make sure `npm run dev` is running (both frontend and backend)
- Check that backend is on port 3000
- Check vite.config.mjs proxy configuration

**Build failing:**

- Run `pnpm build` locally to test
- Check that `dist` directory is created
- Verify all TypeScript errors are fixed

**Functions not working in production:**

- Check Cloudflare Pages function logs in dashboard
- Verify environment variables are set in Cloudflare Pages settings
- Ensure RPC endpoint is accessible from Cloudflare Pages servers
