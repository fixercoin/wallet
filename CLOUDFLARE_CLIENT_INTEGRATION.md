# Client-Side Integration Guide

## Quick Start

### 1. Get a Swap Quote

```typescript
import axios from "axios";

const API_BASE = "https://wallet.fixorium.com.pk";

async function getSwapQuote(inputMint: string, outputMint: string, amount: string) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
  });

  const response = await axios.get(`${API_BASE}/api/quote?${params}`);
  const { source, quote } = response.data;

  console.log(`Quote from ${source}:`, quote);
  return { source, quote };
}

// Example
const quote = await getSwapQuote(
  "So11111111111111111111111111111111111111112", // SOL mint
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC mint
  "1000000", // 1 SOL in lamports
);
```

### 2. Build a Swap Transaction

```typescript
async function buildSwapTransaction(
  inputMint: string,
  outputMint: string,
  amount: string,
  walletAddress: string,
) {
  const response = await axios.post(`${API_BASE}/api/swap`, {
    provider: "meteora", // Use Meteora
    inputMint,
    outputMint,
    amount,
    wallet: walletAddress,
    slippageBps: 500, // 5% slippage
  });

  const { source, swap, signingRequired } = response.data;

  console.log(`Built swap from ${source}:`, swap);
  console.log(`Signing required: ${signingRequired}`);

  return { source, swap };
}

// Example
const { swap } = await buildSwapTransaction(
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "1000000",
  "your_wallet_address",
);
```

### 3. Sign Transaction Client-Side

```typescript
import { Connection, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { WalletAdapter } from "@solana/wallet-adapter-base";

async function executeSwap(
  swap: any,
  wallet: WalletAdapter,
  rpcUrl: string = "https://api.mainnet-beta.solana.com",
) {
  // Step 1: Decode transaction
  const transactionBuffer = Buffer.from(swap.swapTransaction, "base64");
  const transaction = Transaction.from(transactionBuffer);

  // Step 2: Sign with wallet
  console.log("Requesting wallet to sign transaction...");
  const signedTx = await wallet.signTransaction(transaction);

  // Step 3: Send to RPC
  const connection = new Connection(rpcUrl);
  console.log("Submitting signed transaction...");
  const signature = await connection.sendTransaction(signedTx);

  // Step 4: Confirm
  console.log("Confirming transaction...");
  const confirmation = await connection.confirmTransaction(signature);

  console.log("Transaction confirmed:", signature);
  return signature;
}

// Example
const signature = await executeSwap(swap, walletAdapter);
```

## Complete Example: Full Swap Flow

```typescript
import axios from "axios";
import { Connection, Transaction } from "@solana/web3.js";
import { WalletAdapter } from "@solana/wallet-adapter-base";

const API_BASE = "https://wallet.fixorium.com.pk";
const RPC_URL = "https://api.mainnet-beta.solana.com";

async function performSwap(
  wallet: WalletAdapter,
  inputMint: string,
  outputMint: string,
  amountInLamports: string,
) {
  try {
    // Step 1: Connect to wallet
    const walletAddress = wallet.publicKey?.toString();
    if (!walletAddress) throw new Error("Wallet not connected");

    console.log(`Connected wallet: ${walletAddress}`);

    // Step 2: Get quote
    console.log("Fetching quote from Meteora...");
    const quoteResponse = await axios.get(`${API_BASE}/api/quote`, {
      params: {
        inputMint,
        outputMint,
        amount: amountInLamports,
      },
    });

    const { source: quoteSource, quote } = quoteResponse.data;
    console.log(`Got quote from ${quoteSource}`);
    console.log(`Output amount: ${quote.outAmount}`);
    console.log(`Price impact: ${quote.priceImpact}%`);

    // Step 3: Build swap
    console.log("Building swap transaction...");
    const swapResponse = await axios.post(`${API_BASE}/api/swap`, {
      provider: "meteora",
      inputMint,
      outputMint,
      amount: amountInLamports,
      wallet: walletAddress,
      slippageBps: 500, // 5%
    });

    const { swap } = swapResponse.data;
    console.log("Transaction built successfully");

    // Step 4: Decode transaction
    const transactionBuffer = Buffer.from(swap.swapTransaction, "base64");
    const transaction = Transaction.from(transactionBuffer);

    // Step 5: Show confirmation to user
    console.log("Please sign the transaction in your wallet...");

    // Step 6: Sign with wallet
    const signedTx = await wallet.signTransaction(transaction);
    console.log("Transaction signed");

    // Step 7: Send to RPC
    const connection = new Connection(RPC_URL);
    console.log("Submitting transaction to RPC...");
    const signature = await connection.sendTransaction(signedTx);

    // Step 8: Wait for confirmation
    console.log(`Waiting for confirmation... (${signature})`);
    const confirmation = await connection.confirmTransaction(signature);

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    console.log("✅ Swap completed successfully!");
    return signature;
  } catch (error) {
    console.error("❌ Swap failed:", error);
    throw error;
  }
}

// Usage
const signature = await performSwap(
  walletAdapter,
  "So11111111111111111111111111111111111111112", // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "1000000", // 1 SOL
);
```

## With React Hooks

```typescript
import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, Transaction } from "@solana/web3.js";
import axios from "axios";

const API_BASE = "https://wallet.fixorium.com.pk";

function useSwap() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const swap = useCallback(
    async (inputMint: string, outputMint: string, amount: string) => {
      if (!publicKey || !signTransaction) {
        setError("Wallet not connected");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Step 1: Get quote
        const quoteRes = await axios.get(`${API_BASE}/api/quote`, {
          params: { inputMint, outputMint, amount },
        });

        // Step 2: Build swap
        const swapRes = await axios.post(`${API_BASE}/api/swap`, {
          provider: "meteora",
          inputMint,
          outputMint,
          amount,
          wallet: publicKey.toString(),
          slippageBps: 500,
        });

        const { swap: swapData } = swapRes.data;

        // Step 3: Sign and send
        const txBuffer = Buffer.from(swapData.swapTransaction, "base64");
        const tx = Transaction.from(txBuffer);
        const signedTx = await signTransaction(tx);

        const signature = await connection.sendTransaction(signedTx);
        await connection.confirmTransaction(signature);

        setLoading(false);
        return signature;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setLoading(false);
        throw err;
      }
    },
    [publicKey, signTransaction, connection],
  );

  return { swap, loading, error };
}

// Usage in component
function SwapComponent() {
  const { swap, loading, error } = useSwap();

  const handleSwap = async () => {
    try {
      const signature = await swap(
        "So11111111111111111111111111111111111111112",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "1000000",
      );
      console.log("Swap successful:", signature);
    } catch (err) {
      console.error("Swap failed:", err);
    }
  };

  return (
    <div>
      <button onClick={handleSwap} disabled={loading}>
        {loading ? "Swapping..." : "Swap SOL for USDC"}
      </button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
}
```

## API Reference

### GET /api/quote

Get a swap quote from the best available DEX (Meteora preferred).

**Parameters:**
- `inputMint` (string, required): Token mint to sell
- `outputMint` (string, required): Token mint to buy
- `amount` (string, required): Amount in smallest units (lamports for SOL)
- `provider` (string, optional): Force specific provider ("meteora", "jupiter", "dexscreener", "auto")

**Response:**
```json
{
  "source": "meteora",
  "quote": {
    "inAmount": "1000000",
    "outAmount": "50000000",
    "priceImpact": "0.5",
    "fee": "0"
  }
}
```

### POST /api/swap

Execute a swap on the best available DEX (Meteora preferred).

**Request Body:**
```json
{
  "provider": "meteora",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": "1000000",
  "wallet": "your_wallet_address",
  "slippageBps": 500
}
```

**Response:**
```json
{
  "source": "meteora",
  "swap": {
    "swapTransaction": "base64_encoded_transaction",
    "inputAmount": "1000000",
    "outputAmount": "50000000"
  },
  "signingRequired": true,
  "hint": "The transaction must be signed by the wallet on the client-side"
}
```

### GET /api/birdeye/price

Get token price data.

**Parameters:**
- `address` (string, required): Token mint address

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    "value": 0.000089,
    "priceChange24h": 2.5,
    "updateUnixTime": 1234567890
  }
}
```

## Error Handling

### Handling Quote Failures

```typescript
async function getQuoteWithFallback(
  inputMint: string,
  outputMint: string,
  amount: string,
) {
  try {
    const res = await axios.get(`${API_BASE}/api/quote`, {
      params: { inputMint, outputMint, amount },
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 502) {
      console.error("All DEX providers failed. Please try again later.");
    } else {
      console.error("Quote error:", err);
    }
    throw err;
  }
}
```

### Handling Swap Failures

```typescript
async function swapWithErrorHandling(payload: any) {
  try {
    const res = await axios.post(`${API_BASE}/api/swap`, payload);
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;

      if (status === 400) {
        // Missing required fields
        console.error("Invalid swap parameters:", data.message);
        console.error("Supported providers:", data.supported_providers);
      } else if (status === 502) {
        // Provider error
        console.error("Swap provider failed:", data.details);
      } else {
        console.error("Swap error:", data);
      }
    }
    throw err;
  }
}
```

## Best Practices

### 1. Always Check Slippage

```typescript
const MAX_SLIPPAGE_PERCENT = 5; // 5%
const slippageBps = Math.round(MAX_SLIPPAGE_PERCENT * 100); // 500 bps

const swapResponse = await axios.post(`${API_BASE}/api/swap`, {
  slippageBps,
  // ... other params
});
```

### 2. Validate Token Mints

```typescript
function isValidMint(mint: string): boolean {
  if (!mint || typeof mint !== "string") return false;
  if (mint.length !== 44) return false; // Solana mints are 44 chars
  try {
    // Try to decode as base58
    return true;
  } catch {
    return false;
  }
}
```

### 3. Display Transaction Preview

```typescript
async function showSwapPreview(
  inputMint: string,
  outputMint: string,
  inputAmount: string,
) {
  const { quote } = await getSwapQuote(inputMint, outputMint, inputAmount);

  const outputAmount = quote.outAmount;
  const priceImpact = quote.priceImpact || 0;

  console.log(`
    You will send: ${inputAmount} (input token)
    You will receive: ${outputAmount} (output token)
    Price Impact: ${priceImpact}%
  `);

  if (priceImpact > 5) {
    console.warn("⚠️  High price impact! Consider reducing amount.");
  }
}
```

### 4. Handle Network Changes

```typescript
function useSwapWithNetworkCheck() {
  const { network } = useConnection();

  const swap = useCallback(async (payload: any) => {
    // Only support mainnet
    if (network.toJSON().url !== "https://api.mainnet-beta.solana.com") {
      throw new Error("Only mainnet is supported");
    }

    return axios.post(`${API_BASE}/api/swap`, payload);
  }, []);

  return { swap };
}
```

## Security Notes ⚠️

### ❌ Never Do This:

```typescript
// DON'T: Send private key to server
const response = await axios.post(`${API_BASE}/api/sign/transaction`, {
  transaction: txBuffer,
  signerKeypair: privateKey, // ❌ WRONG!
});

// DON'T: Store private keys in browser
localStorage.setItem("privateKey", privateKey); // ❌ WRONG!

// DON'T: Pass private key in URL
fetch(`${API_BASE}/api/sign?key=${privateKey}`); // ❌ WRONG!
```

### ✅ Always Do This:

```typescript
// ✅ CORRECT: Sign on client-side
const signedTx = await wallet.signTransaction(transaction);

// ✅ CORRECT: Use wallet adapters for key management
const { wallet } = useWallet();

// ✅ CORRECT: Keep keys in secure wallet extension
// Let the wallet extension handle signing
```

## Troubleshooting

### Issue: "Wallet not connected"

**Solution:** Check wallet is connected before calling swap
```typescript
if (!wallet.publicKey) {
  throw new Error("Please connect your wallet first");
}
```

### Issue: "Invalid transaction"

**Solution:** Ensure base64 decoding is correct
```typescript
const txBuffer = Buffer.from(swap.swapTransaction, "base64");
// Verify buffer is not empty
if (txBuffer.length === 0) {
  throw new Error("Invalid transaction data");
}
```

### Issue: "Transaction failed"

**Solution:** Check for sufficient balance
```typescript
const balance = await connection.getBalance(publicKey);
if (balance < amount) {
  throw new Error("Insufficient balance");
}
```

## Resources

- [Solana Web3.js Docs](https://solana-labs.github.io/solana-web3.js/)
- [Wallet Adapter Guide](https://github.com/solana-labs/wallet-adapter)
- [Meteora Documentation](https://docs.meteora.ag/)
- [Solana Transaction Format](https://docs.solana.com/developing/programming-model/transactions)
