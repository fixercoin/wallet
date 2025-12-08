# Helius Token Balances - Quick Reference

## 🚀 New Endpoint

### Get All Token Balances (SOL + SPL Tokens)

**Dev Server:**
```
GET http://localhost:3000/api/wallet/all-balances?publicKey=<WALLET_ADDRESS>
```

**Production (Cloudflare):**
```
GET https://your-domain.com/api/wallet/all-balances?publicKey=<WALLET_ADDRESS>
```

## 📋 Parameters

| Parameter | Required | Example |
|-----------|----------|---------|
| publicKey | Yes* | `8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV` |
| wallet | Yes* | `8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV` |
| address | Yes* | `8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV` |

*One of these three is required

## 🧪 Quick Test

```bash
# Replace WALLET_ADDRESS with a real Solana address
curl "http://localhost:3000/api/wallet/all-balances?publicKey=WALLET_ADDRESS"
```

## 📊 Response Fields

```json
{
  "publicKey": "wallet_address",
  "tokens": [
    {
      "mint": "token_mint_address",
      "symbol": "SOL",        // Token symbol
      "name": "Solana",       // Token name
      "decimals": 9,          // Token decimals
      "balance": 5.234,       // Human readable balance
      "uiAmount": 5.234,      // Same as balance
      "rawAmount": "5234000000", // Raw balance
      "address": "token_account_address" // (optional, only for SPL)
    }
  ],
  "totalTokens": 5,           // Number of tokens
  "solBalance": 5.234,        // Native SOL balance
  "source": "https://mainnet.helius-rpc.com",
  "timestamp": 1702500000000
}
```

## 💻 JavaScript Usage

```javascript
// Fetch all balances
const response = await fetch(
  `/api/wallet/all-balances?publicKey=8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV`
);
const data = await response.json();

// Access SOL balance
console.log(`SOL: ${data.solBalance}`);

// Access token balances
data.tokens.forEach(token => {
  console.log(`${token.symbol}: ${token.balance}`);
});
```

## 🌐 RPC Endpoint

**API Key:** `aedd2b62-4cf6-4b84-b260-579fa67d1e8e`

**Endpoint:** `https://mainnet.helius-rpc.com/?api-key=aedd2b62-4cf6-4b84-b260-579fa67d1e8e`

## ✅ Supported Tokens

| Symbol | Automatically Detected |
|--------|------------------------|
| SOL | ✅ Yes |
| USDC | ✅ Yes |
| USDT | ✅ Yes |
| FIXERCOIN | ✅ Yes |
| LOCKER | ✅ Yes |
| FXM | ✅ Yes |
| Others | ✅ Yes (unknown tokens included) |

## ⚙️ Features

- ✅ Parallel requests (faster performance)
- ✅ SOL + all SPL tokens in one call
- ✅ Automatic token metadata enrichment
- ✅ Zero-balance filtering
- ✅ 15-second timeout protection
- ✅ Full CORS support
- ✅ Comprehensive error handling

## 🔄 Alternative Endpoints (Still Available)

```bash
# Get only SOL balance
curl "http://localhost:3000/api/wallet/balance?publicKey=ADDRESS"

# Get token accounts (SOL + SPL)
curl "http://localhost:3000/api/wallet/token-accounts?publicKey=ADDRESS"

# Get specific token balance
curl "http://localhost:3000/api/wallet/token-balance?publicKey=ADDRESS&mint=MINT_ADDRESS"
```

## ❌ Error Response

```json
{
  "error": "Invalid Solana address format",
  "details": {
    "received": "invalid_address",
    "expected": "8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV"
  }
}
```

## 📝 Example Wallets

- `11111111111111111111111111111111` - Invalid
- `8dHKLScV3nMF6mKvwJPGn5Nqfnc1k28tNHakN7z3JMEV` - Valid format

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| 400 Bad Request | Verify you're passing `publicKey`, `wallet`, or `address` parameter |
| Invalid address | Ensure wallet address is valid Solana address (43-44 chars, base58) |
| No tokens returned | Wallet might be empty or on different network (not mainnet) |
| RPC error | Check HELIUS_API_KEY is set and valid |

## 📚 Full Documentation

See `HELIUS_TOKEN_BALANCES_GUIDE.md` for detailed usage examples and troubleshooting.

## 🎯 Key Points

1. **One endpoint to rule them all:** Get SOL + all SPL tokens in a single request
2. **Fast responses:** Parallel requests mean ~2-3 second response times
3. **Automatic metadata:** Recognizes known tokens automatically
4. **Production ready:** Same endpoint works on dev server and Cloudflare Pages
5. **Flexible parameters:** Use `publicKey`, `wallet`, or `address` - they all work
