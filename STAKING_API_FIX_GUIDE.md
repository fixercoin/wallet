# Staking API 500 Error Fix Guide

## Problem Analysis

The staking API endpoints are returning 500 errors:

- `/api/staking/list` - GET
- `/api/staking/rewards-status` - GET
- `/api/staking/create` - POST

### Root Cause

The application uses Cloudflare Pages Functions (`functions/api/staking/*.ts`) which require a KV (Key-Value) namespace binding called `STAKING_KV` to store stake data. The 500 errors indicate that either:

1. **KV Binding is not configured** in the Cloudflare Pages environment
2. **KV Binding is not properly passed** to the Functions
3. **KV Namespace doesn't exist** or has wrong ID

## Solutions

### Option 1: Fix Cloudflare Pages Deployment (Recommended for Production)

If you're deploying to Cloudflare Pages, follow these steps:

#### Step 1: Verify KV Namespace Exists

1. Go to Cloudflare Dashboard → KV
2. Look for a KV namespace named "STAKING_KV" or with ID `295bfeb238c344ccb5afdd2bb93e497f`
3. If not found, create a new KV namespace and note its ID

#### Step 2: Update wrangler.toml

The `wrangler.toml` file has been updated with proper KV bindings. Make sure it contains:

```toml
[[kv_namespaces]]
binding = "STAKING_KV"
id = "295bfeb238c344ccb5afdd2bb93e497f"
preview_id = "d7ce3f94e821495d8c93952fdc8868b6"
```

**Important:** Replace the `id` value with your actual KV namespace ID from Cloudflare.

#### Step 3: Redeploy to Cloudflare Pages

```bash
wrangler pages deploy dist
```

#### Step 4: Verify Binding in Cloudflare Dashboard

1. Go to Cloudflare Pages → Your Project → Settings
2. Go to "Functions" → "KV namespace bindings"
3. Verify that "STAKING_KV" is bound with the correct namespace ID
4. Check both Production and Preview environments

### Option 2: Use Local Express Server (For Local Development)

If you're testing locally, the Node.js Express server (`server/routes/staking.ts`) should be used instead. The dev server should be running with:

```bash
npm run dev
```

This uses in-memory storage for stakes, which is fine for development but will lose data on server restart.

## What Was Changed

### 1. Added Error Logging

Added `console.error()` statements to all staking functions to log actual error details when something fails. This will help identify the exact issue when deployed.

### 2. Added KV Binding Verification

Each function now checks if `env.STAKING_KV` is available and returns a clear error message if the binding is missing:

```typescript
if (!env.STAKING_KV) {
  return jsonResponse(500, {
    error: "KV storage not configured. Please verify wrangler.toml bindings.",
  });
}
```

### 3. Updated wrangler.toml

Added explicit KV namespace configuration for both development and production environments.

## Testing the Fix

### Test Locally

1. Start dev server: `npm run dev`
2. Test endpoint: `curl http://localhost:3000/api/staking/list?wallet=YOUR_WALLET_ADDRESS`
3. Should return: `{"success": true, "data": [], "count": 0}`

### Test in Production (Cloudflare Pages)

1. Deploy to Cloudflare: `wrangler pages deploy dist`
2. Test endpoint: `curl https://your-domain.com/api/staking/list?wallet=YOUR_WALLET_ADDRESS`
3. Should return: `{"success": true, "data": [], "count": 0}` (or error message if KV is misconfigured)

## Troubleshooting

### Still Getting 500 Errors?

1. Check browser Console (F12) for detailed error message
2. Check Cloudflare Pages deployment logs for errors
3. Verify KV namespace exists and has correct ID in wrangler.toml
4. Verify KV binding is set up in Cloudflare Pages project settings

### KV Binding Shows as Missing?

1. The error message should say: `"KV storage not configured. Please verify wrangler.toml bindings."`
2. Go to Cloudflare Dashboard → Pages → Your Project → Settings → Functions
3. Add the KV namespace binding if missing
4. Redeploy the application

### Data Loss on Server Restart (Local Dev)?

This is expected behavior. The local Express server uses in-memory storage which is not persistent. For production, use Cloudflare Pages with KV.

## Files Modified

- `wrangler.toml` - Added KV binding configuration
- `functions/api/staking/list.ts` - Added KV binding check and error logging
- `functions/api/staking/rewards-status.ts` - Added KV binding check and error logging
- `functions/api/staking/create.ts` - Added KV binding check and error logging
- `functions/api/staking/withdraw.ts` - Added KV binding check and error logging
- `server/routes/staking.ts` - Added console error logging

## Next Steps

1. **If deploying to Cloudflare Pages:**
   - Verify KV namespace ID in wrangler.toml matches your Cloudflare account
   - Redeploy with `wrangler pages deploy dist`
   - Check Cloudflare Pages logs for confirmation

2. **If running locally:**
   - Ensure `npm run dev` is running
   - Data is stored in-memory and will be lost on restart

3. **Monitor the errors:**
   - Check the error messages returned from the API
   - Use the console output to debug issues
