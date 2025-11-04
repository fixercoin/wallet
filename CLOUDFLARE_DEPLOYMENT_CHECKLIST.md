# Cloudflare Worker Deployment & Verification Checklist

## Pre-Deployment Checklist

### Code Review
- [x] All changes committed to `cloudflare/src/worker.ts`
- [x] Helper functions added (transaction encoding/decoding)
- [x] Meteora quote endpoint prioritized
- [x] Meteora swap endpoint updated
- [x] Unified `/api/swap` endpoint updated
- [x] Error messages enhanced
- [x] Security warnings added
- [x] Server-side signing endpoint disabled

### Dependencies
- [x] No new npm dependencies required
- [x] All required APIs are external (Meteora, Jupiter, DexScreener)
- [x] Cloudflare Workers compatibility verified
- [x] TypeScript compilation will generate worker.js

### Configuration
- [x] wrangler.toml is correctly configured
- [x] Environment variables are set (SOLANA_RPC)
- [x] Production environment configured
- [x] Timeout settings are appropriate

## Deployment Steps

### Step 1: Pre-Deployment Verification

```bash
# Navigate to cloudflare directory
cd cloudflare

# Check TypeScript syntax
npx tsc --noEmit src/worker.ts

# Verify wrangler.toml
cat wrangler.toml
# Expected output:
# main = "./src/worker.js"
# compatibility_date = "2024-12-01"
```

### Step 2: Deploy to Cloudflare

```bash
# Option 1: Deploy to production environment
wrangler deploy --config ./wrangler.toml --env production

# Option 2: Deploy to staging first (if available)
wrangler deploy --config ./wrangler.toml --env staging

# Option 3: Deploy with custom name
wrangler deploy --config ./wrangler.toml --name wallet-c36-prod
```

### Step 3: Wait for Deployment

Expected time: 30-60 seconds

**Monitor deployment:**
```bash
# View deployment logs
wrangler tail

# Or check Cloudflare dashboard
# https://dash.cloudflare.com -> Workers -> wallet-c36
```

### Step 4: Basic Connectivity Test

```bash
# Test if worker is responding
curl -X GET https://wallet.fixorium.com.pk/api/ping

# Expected response:
# {"status":"ok","timestamp":"2024-..."}
```

## Post-Deployment Verification

### Test 1: Price Fetching (DexScreener) ✅

```bash
# Test 1a: Birdeye price endpoint
curl "https://wallet.fixorium.com.pk/api/birdeye/price?address=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Expected: Success response with USDC price ≈ $1.00
# {
#   "success": true,
#   "data": {
#     "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
#     "value": 1.0,
#     ...
#   }
# }

# Test 1b: DexScreener tokens endpoint
curl "https://wallet.fixorium.com.pk/api/dexscreener/tokens?mints=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

# Expected: Response with token pairs and prices
# {
#   "schemaVersion": "1.0.0",
#   "pairs": [...]
# }

# Test 1c: SOL price endpoint
curl "https://wallet.fixorium.com.pk/api/sol/price"

# Expected: SOL price data
# {
#   "token": "SOL",
#   "price": 180.5,
#   "priceChange24h": 2.5,
#   ...
# }
```

**✓ Pass Criteria:** All endpoints return valid price data

### Test 2: Swap Quotes (Meteora Prioritized) ✅

```bash
# Test 2a: Unified quote endpoint - should use Meteora
curl "https://wallet.fixorium.com.pk/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000"

# Expected: Meteora quote
# {
#   "source": "meteora",
#   "quote": {
#     "inAmount": "1000000",
#     "outAmount": "50000000",
#     ...
#   }
# }

# Test 2b: Force specific provider (Meteora)
curl "https://wallet.fixorium.com.pk/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&provider=meteora"

# Expected: Same Meteora response

# Test 2c: Fallback to Jupiter if Meteora fails
curl "https://wallet.fixorium.com.pk/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&provider=jupiter"

# Expected: Jupiter quote response
# {
#   "source": "jupiter",
#   "quote": {...}
# }
```

**✓ Pass Criteria:** 
- Default provider is Meteora
- Can force Jupiter fallback
- Responses have correct "source" field

### Test 3: Swap Execution (Meteora with Client-Side Signing) ✅

```bash
# Test 3a: Build Meteora swap transaction
curl -X POST https://wallet.fixorium.com.pk/api/swap \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "meteora",
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000",
    "wallet": "8ewjHKMuBVEMaVFPb8Gkz7X5wh1KxVZhzGLCBqAhQaT3",
    "slippageBps": 500
  }'

# Expected: Unsigned transaction ready for client-side signing
# {
#   "source": "meteora",
#   "swap": {
#     "swapTransaction": "base64_encoded_transaction",
#     ...
#   },
#   "signingRequired": true,
#   "hint": "The transaction must be signed by the wallet on the client-side"
# }

# Test 3b: Meteora-specific endpoint
curl -X POST https://wallet.fixorium.com.pk/api/swap/meteora/swap \
  -H "Content-Type: application/json" \
  -d '{
    "userPublicKey": "8ewjHKMuBVEMaVFPb8Gkz7X5wh1KxVZhzGLCBqAhQaT3",
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "inputAmount": "1000000",
    "slippageBps": 500
  }'

# Expected: Same structure with _source: "meteora"
# {
#   "swapTransaction": "base64_encoded_transaction",
#   "signed": false,
#   "_source": "meteora"
# }

# Test 3c: Auto provider selection (should use Meteora)
curl -X POST https://wallet.fixorium.com.pk/api/swap \
  -H "Content-Type: application/json" \
  -d '{
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000",
    "wallet": "8ewjHKMuBVEMaVFPb8Gkz7X5wh1KxVZhzGLCBqAhQaT3"
  }'

# Expected: Should automatically select Meteora
# {
#   "source": "meteora",
#   "swap": {...}
# }
```

**✓ Pass Criteria:**
- Returns unsigned transactions
- All responses include `signingRequired: true`
- No private key processing
- Clear security warnings present

### Test 4: Security Verification ✅

```bash
# Test 4a: Server-side signing endpoint is disabled
curl -X POST https://wallet.fixorium.com.pk/api/sign/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": "base64_transaction",
    "signerKeypair": "private_key_attempt"
  }'

# Expected: HTTP 403 Forbidden
# {
#   "error": "Server-side transaction signing is disabled for security reasons",
#   "message": "Please sign transactions on the client-side using your wallet...",
#   "documentation": "Use @solana/web3.js with your wallet adapter..."
# }

# Test 4b: Verify no private keys are processed
# This is just a verification - don't actually send real keys
curl -X POST https://wallet.fixorium.com.pk/api/swap/meteora/swap \
  -H "Content-Type: application/json" \
  -d '{
    "userPublicKey": "8ewjHKMuBVEMaVFPb8Gkz7X5wh1KxVZhzGLCBqAhQaT3",
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "inputAmount": "1000000",
    "signerKeypair": "test_keypair",
    "sign": true
  }'

# Expected: Returns unsigned transaction with warning
# {
#   "swapTransaction": "...",
#   "signed": false,
#   "warning": "Server-side signing is disabled for security..."
# }
```

**✓ Pass Criteria:**
- Signing endpoint returns HTTP 403
- Signing keypair parameter is ignored
- Security warnings are present in responses

### Test 5: Error Handling ✅

```bash
# Test 5a: Missing required parameters
curl -X POST https://wallet.fixorium.com.pk/api/swap \
  -H "Content-Type: application/json" \
  -d '{"provider": "meteora"}'

# Expected: HTTP 400 with helpful error message
# {
#   "error": "Unable to execute swap - missing required fields",
#   "message": "...",
#   "supported_providers": {
#     "meteora": {...},
#     "jupiter": {...},
#     "pumpfun": {...}
#   },
#   "received": {...}
# }

# Test 5b: Invalid token mint
curl "https://wallet.fixorium.com.pk/api/quote?inputMint=invalid&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000"

# Expected: Either error or fallback response from Jupiter/DexScreener

# Test 5c: Invalid JSON in POST
curl -X POST https://wallet.fixorium.com.pk/api/swap \
  -H "Content-Type: application/json" \
  -d 'invalid json'

# Expected: HTTP 400 with error message about invalid JSON
```

**✓ Pass Criteria:**
- Error messages are helpful
- Status codes are correct (400 for bad request, 502 for provider error)
- No sensitive information leaked in errors

## Performance Testing

### Test Response Times

```bash
# Run 10 requests and measure time
for i in {1..10}; do
  time curl "https://wallet.fixorium.com.pk/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000" > /dev/null
done

# Expected: Most requests complete in < 2 seconds
# Acceptable max: 10 seconds (Meteora timeout is set to 10s for quotes)
```

**✓ Pass Criteria:**
- Quote responses: < 2s (usually faster)
- Swap responses: < 5s (Meteora has 20s timeout)
- No timeout errors unless provider is slow

## Monitoring & Logs

### View Worker Logs

```bash
# Real-time logs
wrangler tail

# With filters
wrangler tail --status ok
wrangler tail --status error

# JSON format
wrangler tail --format json
```

### Expected Log Entries

**For successful quote:**
```
[/api/quote] Attempting Meteora swap for So11... -> EPj...
✅ Got quote from meteora
```

**For successful swap:**
```
[/api/swap] Request - provider: meteora, inputMint: So11..., amount: 1000000
[/api/swap] Attempting Meteora swap for So11... -> EPj...
```

**For disabled signing:**
```
[Transaction Signing] ⚠️  Private key received for server-side signing. This is not recommended!
[Meteora Swap] ⚠️  Server-side signing requested. This is not recommended for security reasons.
```

## Rollback Plan

If issues occur after deployment:

### Option 1: Rollback to Previous Version

```bash
# View deployment history
wrangler rollback

# Rollback to previous version
wrangler rollback --message "Rollback to previous version"
```

### Option 2: Quick Fix Deployment

```bash
# If only minor issues, update and redeploy quickly
# Edit cloudflare/src/worker.ts
# Test locally
# Redeploy
wrangler deploy --config ./wrangler.toml --env production
```

### Option 3: Full Revert

If major issues:
1. Restore last known-good version from git
2. Deploy: `wrangler deploy --config ./wrangler.toml --env production`

## Post-Deployment Tasks

### 1. Update Client Code
- [ ] Update frontend to use new Meteora endpoints
- [ ] Add client-side wallet signing logic
- [ ] Test with real wallets

### 2. Documentation
- [ ] Review all documentation is accurate
- [ ] Update API docs with new endpoints
- [ ] Share implementation guide with team

### 3. Monitoring
- [ ] Set up error alerts in Cloudflare
- [ ] Monitor error rates
- [ ] Track performance metrics

### 4. Communication
- [ ] Notify stakeholders of deployment
- [ ] Share changelog with team
- [ ] Update status page if applicable

## Troubleshooting Guide

### Issue: Deployment fails with "error: invalid module"

**Cause:** TypeScript syntax error

**Solution:**
```bash
# Check for syntax errors
npx tsc --noEmit src/worker.ts

# Fix errors and redeploy
wrangler deploy --config ./wrangler.toml --env production
```

### Issue: Endpoint returns 502 Bad Gateway

**Cause:** Upstream provider error or timeout

**Solution:**
```bash
# Check if provider is up
curl https://api.meteora.ag/swap/v3/quote -I

# Check Cloudflare logs
wrangler tail

# May be temporary - retry after a few minutes
```

### Issue: Swap returns "All providers failed"

**Cause:** All DEX providers are down or rates limited

**Solution:**
```bash
# Check provider status
curl https://api.meteora.ag/health 2>/dev/null || echo "Meteora down"
curl https://quote-api.jup.ag/health 2>/dev/null || echo "Jupiter down"

# Wait for provider recovery
# Or manually specify working provider
```

### Issue: High error rate in logs

**Cause:** Invalid requests or provider issues

**Solution:**
1. Check error patterns in logs
2. Verify client is sending correct format
3. Check with specific test cases
4. Review provider documentation

## Sign-Off Checklist

- [ ] All tests passed locally
- [ ] Deployment completed successfully
- [ ] All 5 test sections verified
- [ ] Security verification passed
- [ ] Performance acceptable
- [ ] Error handling working
- [ ] Logs look healthy
- [ ] Client code updated
- [ ] Team notified
- [ ] Documentation complete

## Contact & Support

For issues:
1. Check Cloudflare Worker logs: `wrangler tail`
2. Review error messages in response
3. Test specific endpoints with curl
4. Check provider status pages
5. Contact platform support if needed

## Appendix: Useful Commands

```bash
# View current deployment
wrangler deployments list

# View worker info
wrangler info

# Test specific endpoint
curl -v https://wallet.fixorium.com.pk/api/ping

# View environment variables
wrangler secret list

# Delete worker (if needed)
wrangler delete

# Local development
wrangler dev
```
