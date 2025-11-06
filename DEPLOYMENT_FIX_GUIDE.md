# Cloudflare Pages API Routes - Deployment Fix

## Issue

When accessing `https://wallet.fixorium.com.pk/api/pumpfun/buy`, you get:

```json
{ "error": "Not found", "pathname": "/api/pumpfun/buy" }
```

## Root Cause

Your Cloudflare Pages deployment is missing the API function routes. The functions are defined in `functions/api/[[path]].ts` but may not be properly deployed.

## Fix Steps

### 1. Verify Git Repository Connection

1. Go to **Cloudflare Dashboard**
2. Navigate to **Pages** > **wallet-c26**
3. Go to **Settings** > **Builds & deployments**
4. Check that:
   - **Framework preset**: `None` (or Custom)
   - **Build command**: `pnpm build` (or your build command)
   - **Build output directory**: `dist`
   - **Root directory**: `/` (or blank)

### 2. Update Cloudflare Pages Configuration

Your `wrangler.toml` should look like this:

```toml
name = "wallet-c36"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# Cloudflare Pages configuration
pages_build_output_dir = "dist"

[vars]
SOLANA_RPC = "https://rpc.shyft.to?api_key=3hAwrhOAmJG82eC7"
BIRDEYE_API_KEY = "cecae2ad38d7461eaf382f533726d9bb"
```

### 3. Verify \_routes.json

Your `_routes.json` includes `/api/*` routes to functions - this is correct:

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```

### 4. Deploy to Cloudflare Pages

#### Option A: Push to Git (Automatic)

1. Commit your code to the git repository
2. Push to the branch connected to Cloudflare Pages
3. Cloudflare will automatically build and deploy

```bash
git add .
git commit -m "Fix: Update API routes"
git push origin main
```

#### Option B: Deploy via Wrangler (Manual)

```bash
# Install wrangler if not already installed
npm install -g wrangler@latest

# Authenticate with Cloudflare
wrangler login

# Deploy to Pages
wrangler pages deploy dist --project-name wallet-c36
```

### 5. Configure Custom Domain

1. Go to **Cloudflare Dashboard** > **Pages** > **wallet-c26**
2. Go to **Custom domains**
3. Add `wallet.fixorium.com.pk`
4. If you have a separate Worker (fixorium-proxy), **do not** point the domain to it
5. Point only to the Pages deployment

### 6. Verify Deployment

After deployment, test the endpoint:

```bash
curl -X POST https://wallet.fixorium.com.pk/api/pumpfun/buy \
  -H "Content-Type: application/json" \
  -d '{
    "mint": "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    "amount": 1000,
    "buyer": "YourWalletAddress"
  }'
```

Expected response should NOT be "Not found".

### 7. Check Cloudflare Pages Logs

1. Go to **Cloudflare Dashboard** > **Pages** > **wallet-c26**
2. Go to **Deployments**
3. Click on the latest deployment
4. Check **Build logs** for errors
5. Check **Functions** tab to see if functions are listed

## Troubleshooting

### If endpoints still return "Not found"

1. **Verify functions folder exists** in git: `functions/api/` should be in your repo root
2. **Check build output**: Run `pnpm build` locally and verify `dist/` is created
3. **Clear cache**: Wait a few minutes or manually purge Cloudflare cache
4. **Check Pages logs** for build errors

### If you have both Cloudflare Pages AND a Worker

- **Option 1**: Use only Cloudflare Pages (recommended for simplicity)
- **Option 2**: Configure the Worker to handle only specific routes and route the rest to Pages
- **Do NOT** point the domain to the Worker if Pages is supposed to handle `/api/*` routes

## Files to Verify

- ✅ `functions/api/[[path]].ts` - Catch-all function handler
- ✅ `functions/api/pumpfun/buy.ts` - Buy endpoint
- ✅ `functions/api/pumpfun/sell.ts` - Sell endpoint
- ✅ `functions/api/pumpfun/trade.ts` - Trade endpoint
- ✅ `_routes.json` - Routes configuration
- ✅ `wrangler.toml` - Worker/Pages configuration
- ✅ `package.json` - Build scripts

## Next Steps

1. **Test locally** (optional):

   ```bash
   wrangler pages dev dist --local
   ```

2. **Monitor deployment** in Cloudflare Dashboard

3. **Test API endpoints** after deployment:

   ```bash
   # Test health check
   curl https://wallet.fixorium.com.pk/api/health

   # Test pumpfun/buy
   curl -X POST https://wallet.fixorium.com.pk/api/pumpfun/buy \
     -H "Content-Type: application/json" \
     -d '{"mint":"...","amount":1000,"buyer":"..."}'
   ```

---

**Need Help?**

- Check Cloudflare Pages documentation: https://developers.cloudflare.com/pages/
- Check Cloudflare Workers documentation: https://developers.cloudflare.com/workers/
- Review build logs in Cloudflare Dashboard
