# Netlify API Routing Fix

## Issues Found & Fixed

### 1. ✅ Missing Dependency
- **Issue**: `@netlify/functions` package was not installed
- **Fix**: Added `@netlify/functions` to devDependencies
- **Impact**: Netlify functions can now be properly typed and built

### 2. ✅ API Router Path Handling
- **Issue**: The API router wasn't correctly handling paths after Netlify's rewrite
- **Fix**: Updated `netlify/functions/api.ts` to handle both:
  - Original paths: `/api/solana-rpc`
  - Rewritten paths: `/.netlify/functions/api/...`
- **Impact**: API calls will now correctly route to the appropriate handlers

### 3. ✅ Better Error Diagnostics
- **Issue**: When external APIs returned errors, responses were not being validated for content-type
- **Fix**: Added content-type validation in:
  - `netlify/functions/api/sol/price.ts`
  - `netlify/functions/api/dexscreener/tokens.ts`
- **Impact**: Errors are now logged with more context, making debugging easier

## Root Cause Analysis

The 404 errors and HTML responses were happening because:

1. The API router in `api.ts` wasn't properly handling the rewritten path from netlify.toml
2. The code tried to extract `/api/` prefix from a path that might be `/.netlify/functions/api/...`
3. When path extraction failed, the route lookup failed, returning a 404

The HTML responses (with `<!doctype`) were the Netlify 404 error page being returned instead of the API response.

## Deployment Instructions

To apply these fixes:

1. **Push the code** to your Netlify-connected repository
2. **Netlify will automatically**:
   - Re-build the frontend (`pnpm build`)
   - Compile the TypeScript functions
   - Deploy everything
3. **Monitor the deployment** in Netlify dashboard
4. **Test the API** by refreshing your app

## What Changed

### Modified Files
- `netlify.toml` - Clarified API routing configuration
- `netlify/functions/api.ts` - Improved path handling
- `netlify/functions/api/sol/price.ts` - Added content-type validation
- `netlify/functions/api/dexscreener/tokens.ts` - Added content-type validation
- `package.json` - Added `@netlify/functions` dependency

### How It Works Now

```
Browser Request: GET /api/solana-rpc
        ↓
Netlify Rewrite: /api/* → /.netlify/functions/api
        ↓
Function Receives: event.path = /api/solana-rpc (or /.netlify/functions/api depending on configuration)
        ↓
api.ts Router: Extracts "solana-rpc" from path
        ↓
Routes to: handlers["solana-rpc"] → solana-rpc.ts handler
        ↓
Returns: JSON response with proper CORS headers
```

## Testing

After deployment, test with:
```
GET https://fixoriumpk.netlify.app/api/health
GET https://fixoriumpk.netlify.app/api/sol/price
GET https://fixoriumpk.netlify.app/api/solana-rpc (POST)
```

All should return JSON responses with `application/json` content-type, not HTML error pages.

## Next Steps

1. ✅ Commit these changes
2. ✅ Push to your Netlify-connected branch
3. ✅ Monitor build at https://app.netlify.com
4. ✅ Test the endpoints in browser DevTools (Network tab)

If you still see HTML responses:
- Check Netlify function logs in the dashboard
- Verify `pnpm build` completes successfully
- Ensure all environment variables are set if needed
