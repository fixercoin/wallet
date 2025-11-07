This project now uses Cloudflare Pages for the frontend and Cloudflare Workers for the backend API.

Suggested setup:

1. Configure Cloudflare Pages for the frontend
   - Build command: pnpm build
   - Build output directory: dist
   - Set environment variable VITE_API_URL to your Worker domain (e.g. https://fixorium-api.khanbabusargodha.workers.dev)

2. Deploy Worker using wrangler
   - Install wrangler: npm i -g wrangler
   - Ensure wrangler.toml has your account_id and main entry
   - Deploy: wrangler deploy --env production

3. Set secrets/env vars for Worker
   - Use: wrangler secret put SOLANA_RPC
   - Use: wrangler secret put FIXORIUM_API_KEY

4. DNS / Custom domain
   - In Cloudflare dashboard, map your desired custom domain to the Worker (Workers → Add route) or configure a custom domain. If using the workers.dev deployment, the worker URL is https://fixorium-api.khanbabusargodha.workers.dev
   - For Pages, add your frontend domain in Pages settings

Testing:

- curl https://fixorium-api.khanbabusargodha.workers.dev/api/health
- From browser: fetch(`${import.meta.env.VITE_API_URL}/api/health`).then(r=>r.json()).then(console.log)
