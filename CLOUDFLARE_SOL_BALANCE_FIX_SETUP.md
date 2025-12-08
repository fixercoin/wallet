# Cloudflare SOL Balance Fix - Setup Guide

## Problem Identified

Your SOL balance shows correctly in dev but **0.000 SOL on Cloudflare** because **RPC environment variables are not being passed to your Express server**.

## Root Cause

- The `wrangler.toml` had RPC variables commented out
- Cloudflare Pages server couldn't access `process.env.SOLANA_RPC_URL`, `HELIUS_API_KEY`, etc.
- Server fell back to public rate-limited endpoints that fail silently

## Solution: Set Environment Variables in Cloudflare

You need to configure your RPC endpoint **in the Cloudflare Pages dashboard** (NOT in your code).

### Step 1: Get Your RPC Endpoint

Choose ONE of these options:

**Option A: Use Helius (Recommended)**

- Go to https://helius.dev
- Sign up and create an API key
- Your RPC URL will be: `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`

**Option B: Use Public Solana RPC**

- `https://solana.publicnode.com` (free, may be rate-limited)
- `https://rpc.ankr.com/solana` (free)
- `https://api.mainnet-beta.solana.com` (free)

**Option C: Use Alchemy**

- Go to https://www.alchemy.com/
- Create account and app
- Copy your RPC URL

### Step 2: Set Environment Variables in Cloudflare Pages

1. Go to your **Cloudflare Pages project**
2. Click **Settings → Environment variables**
3. Click **Production** tab (for live deployments)
4. Add these variables:

   **Option A (Helius - Recommended):**

   ```
   Variable name: HELIUS_API_KEY
   Value: your-api-key-here
   ```

   **Option B (Any RPC endpoint):**

   ```
   Variable name: SOLANA_RPC_URL
   Value: https://your-rpc-endpoint.com
   ```

5. Click **Save**
6. **Redeploy** your site (trigger a new deployment)

### Step 3: Verify It Works

1. Go to your Cloudflare deployment
2. Open your wallet dashboard
3. Check the SOL balance - it should now show the correct amount
4. Check browser console (F12) for logs showing which RPC endpoint is being used

## How It Works

When you set environment variables in Cloudflare Pages:

1. They're passed to your server at runtime
2. The wallet-balance endpoint checks for `HELIUS_API_KEY` or `SOLANA_RPC_URL`
3. It uses your configured endpoint instead of public rate-limited ones
4. SOL balance fetching becomes reliable

## Troubleshooting

**Still showing 0.000 SOL?**

1. Check you set the variable in **Production** (not Preview)
2. Verify you **redeployed** after setting variables
3. Check browser console logs to see which RPC endpoint is being used
4. Test your RPC endpoint directly:
   ```bash
   curl -X POST https://your-rpc-endpoint.com \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["YOUR_WALLET_ADDRESS"]}'
   ```

**RPC endpoint is returning errors?**

- Try a different endpoint from the options above
- Check if your API key is valid
- Ensure there are no extra spaces in the endpoint URL

## Local Development

For testing locally:

1. Create a `.env.local` file in your project root
2. Add your RPC endpoint:
   ```
   SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
   # OR
   HELIUS_API_KEY=YOUR_KEY
   ```
3. Run `npm run dev`
4. The local dev server will use these variables

## Code Changes Made

✅ Updated `wrangler.toml` to support RPC environment variables
✅ Enhanced `server/routes/wallet-balance.ts` to safely handle Cloudflare env vars
✅ Server now properly checks for empty strings in environment variables

## Next Steps

After setting up your RPC endpoint in Cloudflare:

1. Push your code changes
2. Trigger a new deployment
3. Test your wallet dashboard
4. Verify SOL balance displays correctly
