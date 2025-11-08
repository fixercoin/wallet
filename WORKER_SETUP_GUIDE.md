# Cloudflare Workers Setup Guide

This guide shows you how to use the provided files to set up and deploy your Fixorium Wallet API worker.

---

## Files Provided

You have 3 reference files:

1. **`WORKER_JS_COMPLETE_TEMPLATE.js`** - Ready-to-use complete worker.js
   - Copy this entire file to use as your worker
   - All endpoints pre-configured
   - Just deploy as-is

2. **`API_ENDPOINTS_REFERENCE.md`** - Detailed documentation
   - Each endpoint with request/response examples
   - Complete handler code for each endpoint
   - Best for understanding how to implement custom endpoints

3. **`API_ENDPOINTS_QUICK_REFERENCE.md`** - Quick lookup guide
   - Curl examples for all endpoints
   - Parameter reference
   - Common use cases

---

## Quick Start (3 Steps)

### Step 1: Copy the Complete Template

Copy the entire content of `WORKER_JS_COMPLETE_TEMPLATE.js` into your Cloudflare Workers script.

### Step 2: Deploy

Deploy using Cloudflare Workers CLI:

```bash
# Install Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy from your project directory
wrangler deploy
```

Or deploy directly via Cloudflare Dashboard:

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Create a new Worker or edit existing one
4. Paste the worker code
5. Click "Deploy"

### Step 3: Test

Test your endpoints:

```bash
# Health check
curl https://your-worker-name.workers.dev/api/health

# Wallet balance
curl "https://your-worker-name.workers.dev/api/wallet/balance?publicKey=YOUR_PUBLIC_KEY"

# Price check
curl "https://your-worker-name.workers.dev/api/jupiter/price?ids=So11111111111111111111111111111111111111112"
```

---

## File Structure Explained

### WORKER_JS_COMPLETE_TEMPLATE.js Structure

```
1. CONFIGURATION
   - API endpoints (DexScreener, Jupiter, RPC)
   - Fallback endpoints
   - Batch limits

2. UTILITY FUNCTIONS
   - corsHeaders() - CORS setup
   - timeoutFetch() - Request with timeout
   - normalizeBase() - URL normalization
   - tryDexscreener() - DexScreener wrapper
   - tryJupiter() - Jupiter wrapper

3. ROUTE HANDLERS
   - handleHealth() - Health check
   - handleWalletBalance() - Get SOL balance
   - handleDexTokens() - Token data
   - handleDexPrice() - Token price
   - handleDexSearch() - Search tokens
   - handleJupiterPrice() - Token prices
   - handleJupiterQuote() - Swap quote
   - handleJupiterSwap() - Execute swap
   - handleSolanaRpc() - Direct RPC proxy
   - etc.

4. MAIN HANDLER
   - fetch() - Routes requests to handlers
   - CORS preflight handling
   - 404 fallback

```

---

## Customization Guide

### Add a Custom Endpoint

To add a new endpoint:

```javascript
// 1. Create handler function
async function handleMyEndpoint(reqUrl, env) {
  try {
    // Your logic here
    return new Response(JSON.stringify({ status: "ok", data: result }), {
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  }
}

// 2. Add routing in fetch() handler
if (pathname === "api/my/endpoint") return handleMyEndpoint(url, env);
```

### Configure Environment Variables

Set in Cloudflare Workers settings:

```
SOLANA_RPC_URL = https://solana.publicnode.com
HELIUS_API_KEY = your-key-here
```

Access in code:

```javascript
if (env && env.HELIUS_API_KEY) {
  // Use the API key
}
```

### Modify Timeouts

Change timeout values in handler calls:

```javascript
// Current: 8000ms timeout
await timeoutFetch(url, options, 8000);

// Custom: 15 second timeout
await timeoutFetch(url, options, 15000);
```

### Add Custom RPC Endpoints

In `handleWalletBalance()`:

```javascript
const rpcCandidates = [];
if (env && env.SOLANA_RPC_URL) rpcCandidates.push(env.SOLANA_RPC_URL);
if (env && env.MY_CUSTOM_RPC) rpcCandidates.push(env.MY_CUSTOM_RPC);
if (env && env.ALCHEMY_RPC_URL) rpcCandidates.push(env.ALCHEMY_RPC_URL);
// Add more...
```

---

## Common Patterns

### Adding Query Parameter Support

```javascript
async function handleMyEndpoint(reqUrl, env) {
  // Get required param
  const param1 = reqUrl.searchParams.get("param1");
  if (!param1) {
    return new Response(JSON.stringify({ error: "Missing param1" }), {
      status: 400,
      headers: { ...corsHeaders() },
    });
  }

  // Get optional param with default
  const param2 = reqUrl.searchParams.get("param2") || "default_value";

  // Get multiple values
  const ids = (reqUrl.searchParams.get("ids") || "").split(",").filter(Boolean);

  // Proceed with logic...
}
```

### Adding POST Body Support

```javascript
async function handleMyEndpoint(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders() },
    });
  }

  // Validate required fields
  if (!body.requiredField) {
    return new Response(JSON.stringify({ error: "Missing requiredField" }), {
      status: 400,
      headers: { ...corsHeaders() },
    });
  }

  // Proceed...
}
```

### Error Handling Pattern

```javascript
async function handleMyEndpoint(reqUrl, env) {
  try {
    // Primary logic
    const result = await fetch("https://api.example.com/data");
    if (!result.ok) {
      throw new Error(`API returned ${result.status}`);
    }
    const data = await result.json();

    return new Response(JSON.stringify(data), {
      headers: { "content-type": "application/json", ...corsHeaders() },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "Operation failed",
        details: e.message,
      }),
      {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders() },
      },
    );
  }
}
```

---

## Routing Explained

The main `fetch()` handler routes requests:

```javascript
export default {
  async fetch(request, env, ctx) {
    // 1. CORS preflight (always first)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // 2. Get path
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$|^\/+/, "");

    try {
      // 3. Route to handler
      if (pathname === "api/health") return handleHealth();
      if (pathname === "api/ping") return handlePing();
      if (pathname === "api/wallet/balance")
        return handleWalletBalance(url, env);
      // ... more routes

      // 4. Not found
      if (pathname.startsWith("api")) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: corsHeaders(),
        });
      }

      // 5. Fallback HTML
      return new Response(html, {
        headers: { "content-type": "text/html" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Internal error", details: err.message }),
        { status: 500, headers: corsHeaders() },
      );
    }
  },
};
```

---

## Testing Your Worker

### Test Health

```bash
curl https://your-worker.workers.dev/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Test with Parameters

```bash
curl "https://your-worker.workers.dev/api/wallet/balance?publicKey=YOUR_KEY"
```

### Test POST Request

```bash
curl -X POST https://your-worker.workers.dev/api/solana-rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["YOUR_KEY"]}'
```

### Test CORS

```bash
curl -i -X OPTIONS https://your-worker.workers.dev/api/health
```

You should see:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization
```

---

## Deployment Checklist

- [ ] Copy `WORKER_JS_COMPLETE_TEMPLATE.js` into your worker
- [ ] Update any custom endpoints you need
- [ ] Configure environment variables (if using custom RPC)
- [ ] Test health endpoint: `/api/health`
- [ ] Test wallet endpoint: `/api/wallet/balance?publicKey=TEST_KEY`
- [ ] Test another endpoint (e.g., `/api/sol/price`)
- [ ] Verify CORS headers in OPTIONS request
- [ ] Check error handling with invalid parameters
- [ ] Deploy to production

---

## Environment Setup

### Using Wrangler Config

Create `wrangler.toml`:

```toml
name = "fixorium-wallet-api"
type = "javascript"
account_id = "your-account-id"
workers_dev = true
route = "your-domain.com/api/*"
zone_id = "your-zone-id"

[env.production]
name = "fixorium-wallet-api-prod"
vars = { ENVIRONMENT = "production" }
secrets = ["SOLANA_RPC_URL", "HELIUS_API_KEY"]

[env.staging]
name = "fixorium-wallet-api-staging"
vars = { ENVIRONMENT = "staging" }
secrets = ["SOLANA_RPC_URL"]
```

Deploy to environment:

```bash
wrangler deploy --env production
```

### Setting Secrets

```bash
# Set via CLI
wrangler secret put SOLANA_RPC_URL
# Paste: https://solana.publicnode.com

wrangler secret put HELIUS_API_KEY
# Paste: your-api-key

# Deploy after setting secrets
wrangler deploy
```

---

## Monitoring

### View Logs

```bash
wrangler tail
```

### Monitor with Real API Calls

```bash
# Check if endpoint is up
watch -n 5 'curl -s https://your-worker.workers.dev/api/health | jq'

# Monitor wallet balance
watch -n 10 'curl -s "https://your-worker.workers.dev/api/wallet/balance?publicKey=YOUR_KEY" | jq'
```

---

## Troubleshooting

### Endpoint Returns 404

Check routing in fetch handler:

```javascript
// Make sure path matches exactly
if (pathname === "api/health") return handleHealth();
```

### Timeout Errors

Increase timeout for slow operations:

```javascript
// Change from 8000 to 15000ms
const result = await timeoutFetch(url, options, 15000);
```

### CORS Issues

Verify corsHeaders() is included in response:

```javascript
return new Response(data, {
  headers: { "content-type": "application/json", ...corsHeaders() },
});
```

### Invalid JSON Response

Make sure to stringify objects:

```javascript
// Correct
JSON.stringify({ status: "ok" });

// Wrong
("{ status: 'ok' }");
```

### RPC Connection Failed

Check environment variables and fallback endpoints are configured:

```javascript
const rpcCandidates = [];
if (env && env.SOLANA_RPC_URL) rpcCandidates.push(env.SOLANA_RPC_URL);
rpcCandidates.push(...DEFAULT_RPC_FALLBACKS); // Fallback!
```

---

## Performance Tips

1. **Batch Requests**: Use `/api/dexscreener/tokens?mints=m1,m2,m3` instead of individual requests
2. **Cache Results**: Consider adding caching headers for stable data
3. **Reduce Timeouts**: Lower timeouts for faster failure detection
4. **Use Fallback Endpoints**: More endpoints = better reliability
5. **Parallel Requests**: Use Promise.all() for independent requests

---

## Security Considerations

✅ **Done in this template:**

- CORS properly configured
- No secrets in code
- Error details don't expose system info
- Input validation on parameters
- Timeout protection against hanging requests

✅ **Consider adding:**

- Rate limiting (use Cloudflare rules)
- API key authentication (if private)
- Request signing (for sensitive operations)
- Logging/monitoring (use Sentry, DataDog)

---

## Next Steps

1. Copy `WORKER_JS_COMPLETE_TEMPLATE.js` to your worker
2. Update environment variables as needed
3. Deploy and test
4. Refer to `API_ENDPOINTS_QUICK_REFERENCE.md` for all available endpoints
5. Use `API_ENDPOINTS_REFERENCE.md` to customize or add endpoints

You're ready to go!
