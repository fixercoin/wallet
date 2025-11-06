import { resolveApiUrl } from "@/lib/api-client";
import { jupiterAPI } from "@/lib/services/jupiter";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface BondingCurveStatus {
  isBondingCurveOpen: boolean;
  tokenMint: string;
  marketCapSOL?: number;
  progressPercent?: number;
}

export interface SwapResult {
  txid?: string;
  error?: string;
  source: "pump" | "jupiter";
}

/**
 * Check if a token's bonding curve is still open on Pump.fun
 * Returns true if curve is open, false if graduated to pool/closed
 */
export async function isBondingCurveOpen(tokenMint: string): Promise<boolean> {
  try {
    // Try to fetch bonding curve data from Pump.fun API
    const res = await fetch(
      `https://frontend-api.pump.fun/coin/${encodeURIComponent(tokenMint)}`,
      { method: "GET" },
    );

    if (!res.ok) {
      console.warn(
        `[Bonding Curve] Failed to fetch status for ${tokenMint}: ${res.status}`,
      );
      return false;
    }

    const data = await res.json();

    // If curve progress is undefined or < 100, bonding curve is still open
    // If progress >= 100 or graduated flag is set, curve is closed
    const curveProgress = data?.curveProgress ?? data?.curve_progress ?? 0;
    const isGraduated = data?.graduated ?? data?.is_graduated ?? false;
    const isClosed = curveProgress >= 100 || isGraduated;

    console.log(
      `[Bonding Curve] ${tokenMint}: progress=${curveProgress}%, graduated=${isGraduated}, closed=${isClosed}`,
    );

    return !isClosed;
  } catch (error) {
    console.warn(`[Bonding Curve] Error checking ${tokenMint}:`, error);
    // Default to false (assume curve is closed) on error
    return false;
  }
}

/**
 * Execute a Pump.fun BUY swap (SOL → Token)
 * Sends request to Pump.fun API for transaction building
 */
export async function pumpFunSwap(
  wallet: any,
  tokenMint: string,
  solAmount: number,
): Promise<string> {
  if (!wallet?.publicKey) {
    throw new Error("Wallet not connected");
  }

  try {
    // Convert SOL to lamports
    const solLamports = Math.floor(solAmount * 1e9);

    // Build request for Pump.fun API
    const requestBody = {
      tokenAddress: tokenMint,
      creator: wallet.publicKey,
      action: "buy",
      tokenAmount: solLamports,
      slippage: 10, // 10% slippage tolerance
      priorityFee: 0.0005,
    };

    // Call Pump.fun API to build transaction
    const res = await fetch("https://pumpportal.fun/api/trade-v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`Pump.fun API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();

    if (!data?.tx || !data.tx[0]?.txid) {
      throw new Error("No transaction returned from Pump.fun");
    }

    return data.tx[0].txid;
  } catch (error) {
    console.error("[Pump.fun Buy] Error:", error);
    throw error;
  }
}

/**
 * Execute a Pump.fun SELL swap (Token → SOL)
 * Sends request to Pump.fun API for transaction building
 */
export async function pumpFunSell(
  wallet: any,
  tokenMint: string,
  tokenAmountRaw: number, // amount in lamports (smallest unit)
): Promise<string> {
  if (!wallet?.publicKey) {
    throw new Error("Wallet not connected");
  }

  try {
    // Build request for Pump.fun API
    const requestBody = {
      tokenAddress: tokenMint,
      creator: wallet.publicKey,
      action: "sell",
      tokenAmount: tokenAmountRaw,
      slippage: 10, // 10% slippage tolerance
      priorityFee: 0.0005,
    };

    // Call Pump.fun API to build transaction
    const res = await fetch("https://pumpportal.fun/api/trade-v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`Pump.fun API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();

    if (!data?.tx || !data.tx[0]?.txid) {
      throw new Error("No transaction returned from Pump.fun");
    }

    return data.tx[0].txid;
  } catch (error) {
    console.error("[Pump.fun Sell] Error:", error);
    throw error;
  }
}

/**
 * Execute swap with automatic routing:
 * - If bonding curve is open → use Pump.fun
 * - If bonding curve is closed → use Jupiter
 */
export async function executeSmartSwap(
  wallet: any,
  inputMint: string,
  outputMint: string,
  amountInHuman: number,
): Promise<SwapResult> {
  if (!wallet?.publicKey) {
    return {
      error: "Wallet not connected",
      source: "jupiter",
    };
  }

  try {
    const isBuying = inputMint === SOL_MINT;
    const isSelling = outputMint === SOL_MINT;

    if (!isBuying && !isSelling) {
      return {
        error: "Swap must involve SOL",
        source: "jupiter",
      };
    }

    // Determine which token to check for bonding curve
    const tokenMint = isBuying ? outputMint : inputMint;

    // Check bonding curve status
    const curveOpen = await isBondingCurveOpen(tokenMint);

    if (curveOpen) {
      // ✅ Pump.fun BUY
      if (isBuying) {
        console.log(`[Smart Swap] Using Pump.fun for BUY of ${tokenMint}`);
        try {
          const txid = await pumpFunSwap(wallet, tokenMint, amountInHuman);
          return {
            txid,
            source: "pump",
          };
        } catch (pumpError) {
          console.warn(
            "[Smart Swap] Pump.fun buy failed, falling back to Jupiter:",
            pumpError,
          );
          // Fall through to Jupiter
        }
      }

      // ✅ Pump.fun SELL
      if (isSelling) {
        console.log(`[Smart Swap] Using Pump.fun for SELL of ${tokenMint}`);
        try {
          const tokenDecimals = 6; // Default to 6, should match actual token decimals
          const rawAmount = Math.floor(
            amountInHuman * Math.pow(10, tokenDecimals),
          );
          const txid = await pumpFunSell(wallet, tokenMint, rawAmount);
          return {
            txid,
            source: "pump",
          };
        } catch (pumpError) {
          console.warn(
            "[Smart Swap] Pump.fun sell failed, falling back to Jupiter:",
            pumpError,
          );
          // Fall through to Jupiter
        }
      }
    }

    // ✅ Use Jupiter (Curve Closed or Pump.fun failed)
    console.log(
      `[Smart Swap] Using Jupiter for swap (curve_open=${curveOpen})`,
    );

    const amountLamports = Math.floor(amountInHuman * 1e9);

    // Get quote from Jupiter
    const quoteResponse = await jupiterAPI.getQuote(
      inputMint,
      outputMint,
      amountLamports,
      500, // 5% slippage
    );

    if (!quoteResponse) {
      return {
        error: "No Jupiter route available",
        source: "jupiter",
      };
    }

    // Get swap transaction from Jupiter
    const swapRequest = {
      quoteResponse,
      userPublicKey: wallet.publicKey,
      wrapAndUnwrapSol: true,
    };

    const swapResult = await jupiterAPI.getSwapTransaction(swapRequest);

    if (!swapResult?.swapTransaction) {
      return {
        error: "Failed to build Jupiter swap transaction",
        source: "jupiter",
      };
    }

    // Return the transaction (caller must sign and send)
    return {
      txid: swapResult.swapTransaction,
      source: "jupiter",
    };
  } catch (error) {
    console.error("[Smart Swap] Unexpected error:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
      source: "jupiter",
    };
  }
}
