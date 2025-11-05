import { RequestHandler } from "express";
import { TOKEN_MINTS } from "../../client/lib/constants/token-mints";

const TIMEOUT_MS = 20000;
const BRIDGE_TOKENS = [TOKEN_MINTS.USDC, TOKEN_MINTS.USDT, TOKEN_MINTS.SOL];

interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: string;
  source: "jupiter" | "meteora" | "bridged";
  bridgeToken?: string;
  routePlan?: any[];
}

interface SwapAttempt {
  provider: string;
  status: "success" | "failed";
  reason?: string;
  error?: string;
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50,
): Promise<any | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: "false",
      asLegacyTransaction: "false",
    });

    const urls = [
      `https://quote-api.jup.ag/v6/quote?${params.toString()}`,
      `https://lite-api.jup.ag/swap/v1/quote?${params.toString()}`,
    ];

    for (const url of urls) {
      // Retry logic for transient failures
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(
            `[Swap] Trying Jupiter quote (attempt ${attempt}/2): ${inputMint} -> ${outputMint}`,
          );

          const response = await fetchWithTimeout(url);
          if (!response.ok) {
            const text = await response.text().catch(() => "");

            // For 404/400, skip to next endpoint (may be a token Jupiter doesn't support)
            if (response.status === 404 || response.status === 400) {
              console.warn(
                `[Swap] Jupiter returned ${response.status} - likely unsupported pair or invalid params`,
                { inputMint, outputMint, text: text.substring(0, 100) },
              );
              break; // Move to next URL
            }

            // For rate limit or server errors, retry
            if (response.status === 429 || response.status >= 500) {
              console.warn(
                `[Swap] Jupiter API error ${response.status}, retrying... (attempt ${attempt}/2)`,
              );
              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, attempt * 1000));
                continue; // Retry same URL
              }
              break; // Move to next URL
            }

            return null;
          }

          const data = await response.json();
          if (!data.outAmount || data.outAmount === "0") {
            console.warn(
              `[Swap] Jupiter returned zero/empty quote for ${inputMint} -> ${outputMint}`,
            );
            break; // Move to next URL
          }

          console.log(
            `[Swap] ✅ Jupiter quote success: ${inputMint} -> ${outputMint}: ${data.outAmount}`,
          );
          return data;
        } catch (e: any) {
          const msg = e?.message || String(e);
          if (attempt < 2 && (msg.includes("timeout") || msg.includes("ECONNREFUSED"))) {
            console.warn(
              `[Swap] Jupiter transient error, retrying... (attempt ${attempt}/2): ${msg}`,
            );
            await new Promise((r) => setTimeout(r, attempt * 500));
            continue;
          }
          console.warn(`[Swap] Jupiter endpoint error (attempt ${attempt}/2): ${msg}`);
          break;
        }
      }
    }

    console.warn(
      `[Swap] All Jupiter endpoints exhausted for ${inputMint} -> ${outputMint}`,
    );
    return null;
  } catch (e: any) {
    console.warn(`[Swap] Jupiter quote error: ${e?.message || e}`);
    return null;
  }
}

async function getMeteOraQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
): Promise<any | null> {
  // Retry logic for transient failures
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
      });

      const url = `https://api.meteora.ag/swap/v3/quote?${params.toString()}`;
      console.log(
        `[Swap] Trying Meteora quote (attempt ${attempt}/2): ${inputMint} -> ${outputMint}`,
      );

      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        const text = await response.text().catch(() => "");

        // For 404/400, skip retries (token pair not supported)
        if (response.status === 404 || response.status === 400) {
          console.warn(
            `[Swap] Meteora returned ${response.status} - no route for ${inputMint} -> ${outputMint}`,
          );
          return null;
        }

        // For rate limit or server errors, retry
        if (response.status === 429 || response.status >= 500) {
          console.warn(
            `[Swap] Meteora API error ${response.status} (attempt ${attempt}/2)`,
          );
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, attempt * 1000));
            continue;
          }
          return null;
        }

        console.warn(
          `[Swap] Meteora quote failed with ${response.status} for ${inputMint} -> ${outputMint}`,
        );
        return null;
      }

      const data = await response.json();

      // Validate Meteora response has expected fields
      const outAmount = data?.estimatedOut || data?.outAmount || data?.minReceived;
      if (!data || !outAmount || outAmount === "0") {
        console.warn(
          `[Swap] Meteora returned invalid/empty quote for ${inputMint} -> ${outputMint}`,
        );
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }
        return null;
      }

      console.log(
        `[Swap] ✅ Meteora quote success (attempt ${attempt}): ${inputMint} -> ${outputMint}: ${outAmount}`,
      );
      return data;
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (attempt < 2 && (msg.includes("timeout") || msg.includes("ECONNREFUSED"))) {
        console.warn(
          `[Swap] Meteora transient error (attempt ${attempt}/2), retrying: ${msg}`,
        );
        await new Promise((r) => setTimeout(r, attempt * 500));
        continue;
      }
      console.warn(
        `[Swap] Meteora quote error (attempt ${attempt}): ${msg}`,
      );
      if (attempt === 2) return null;
    }
  }

  return null;
}

async function getBridgedQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number = 50,
): Promise<{ bridge: string; q1: any; q2: any } | null> {
  try {
    // Try each bridge token
    for (const bridge of BRIDGE_TOKENS) {
      if (bridge === inputMint || bridge === outputMint) continue;

      try {
        console.log(
          `[Swap] Trying bridged route via ${bridge}: ${inputMint} -> ${bridge} -> ${outputMint}`,
        );

        // First leg: inputMint -> bridge
        const q1 = await getJupiterQuote(
          inputMint,
          bridge,
          amount,
          slippageBps,
        );
        if (!q1 || !q1.outAmount || q1.outAmount === "0") {
          console.warn(
            `[Swap] Leg 1 failed for bridge ${bridge}: no quote or zero output`,
          );
          continue;
        }

        // Second leg: bridge -> outputMint
        const q2 = await getJupiterQuote(
          bridge,
          outputMint,
          q1.outAmount,
          slippageBps,
        );
        if (!q2 || !q2.outAmount || q2.outAmount === "0") {
          console.warn(
            `[Swap] Leg 2 failed for bridge ${bridge}: no quote or zero output`,
          );
          continue;
        }

        console.log(
          `[Swap] ✅ Bridged route successful via ${bridge}: ${q1.outAmount} -> ${q2.outAmount}`,
        );
        return { bridge, q1, q2 };
      } catch (e) {
        console.warn(`[Swap] Bridge ${bridge} error: ${e}`);
        continue;
      }
    }

    console.warn(
      `[Swap] No bridged routes available for ${inputMint} -> ${outputMint}`,
    );
    return null;
  } catch (e: any) {
    console.warn(`[Swap] Bridged quote error: ${e?.message || e}`);
    return null;
  }
}

/**
 * GET /api/swap/quote
 * Unified quote endpoint with fallback chain
 * Returns quotes from Jupiter, Meteora, or bridged routes
 */
export const handleSwapQuoteV2: RequestHandler = async (req, res) => {
  try {
    const inputMint = String(req.query.inputMint || "");
    const outputMint = String(req.query.outputMint || "");
    const amount = String(req.query.amount || "");
    const slippageBps = parseInt(String(req.query.slippageBps || "50"), 10);

    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: "Missing required params: inputMint, outputMint, amount",
      });
    }

    if (isNaN(slippageBps) || slippageBps < 0 || slippageBps > 10000) {
      return res.status(400).json({
        error: "Invalid slippageBps (must be 0-10000)",
      });
    }

    // Validate amount is a valid number
    const amountNum = BigInt(amount);
    if (amountNum <= 0n) {
      return res.status(400).json({
        error: "Amount must be greater than 0",
      });
    }

    const attempts: SwapAttempt[] = [];

    // Try Jupiter direct quote first
    console.log(
      `[Swap Quote] Requesting: ${inputMint} -> ${outputMint} (amount: ${amount})`,
    );

    let quote = await getJupiterQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps,
    );
    if (quote && quote.outAmount && quote.outAmount !== "0") {
      attempts.push({ provider: "jupiter", status: "success" });
      console.log(
        `[Swap Quote] ✅ Jupiter route: ${quote.outAmount} output tokens`,
      );
      return res.json({
        quote,
        source: "jupiter",
        inputMint,
        outputMint,
        amount,
        slippageBps,
        attempts,
      });
    }
    attempts.push({
      provider: "jupiter",
      status: "failed",
      reason: "No liquidity or route found",
    });

    // Try Meteora quote as secondary option
    console.log(`[Swap Quote] Jupiter failed, trying Meteora...`);
    quote = await getMeteOraQuote(inputMint, outputMint, amount);
    if (quote && (quote.outAmount || quote.estimatedOut || quote.minReceived)) {
      attempts.push({ provider: "meteora", status: "success" });
      console.log(
        `[Swap Quote] ✅ Meteora route: ${quote.outAmount || quote.estimatedOut || quote.minReceived} output`,
      );
      return res.json({
        quote,
        source: "meteora",
        inputMint,
        outputMint,
        amount,
        attempts,
      });
    }
    attempts.push({
      provider: "meteora",
      status: "failed",
      reason: "No liquidity or route found",
    });

    // Try bridged routes as last resort
    console.log(`[Swap Quote] Meteora failed, trying bridged routes...`);
    const bridged = await getBridgedQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps,
    );
    if (bridged && bridged.q1 && bridged.q2) {
      attempts.push({
        provider: "bridged",
        status: "success",
        reason: `via ${bridged.bridge}`,
      });
      console.log(
        `[Swap Quote] ✅ Bridged route via ${bridged.bridge}: ${bridged.q2.outAmount} output`,
      );
      return res.json({
        quote: bridged.q2,
        source: "bridged",
        bridgeToken: bridged.bridge,
        leg1: bridged.q1,
        leg2: bridged.q2,
        inputMint,
        outputMint,
        amount,
        slippageBps,
        attempts,
      });
    }
    attempts.push({
      provider: "bridged",
      status: "failed",
      reason: "No bridge routes available",
    });

    // All routes exhausted
    console.warn(
      `[Swap Quote] ❌ No routes found for ${inputMint} -> ${outputMint}`,
    );
    return res.status(404).json({
      error: "No swap route found - no liquidity available for this pair",
      inputMint,
      outputMint,
      amount,
      slippageBps,
      attempts,
      suggestions: [
        "Verify token pair has liquidity on supported exchanges",
        "Try swapping through an intermediate token (e.g., USDC)",
        "Check that both tokens are supported on Jupiter/Meteora",
        "Increase slippage tolerance if using low liquidity pair",
      ],
    });
  } catch (e: any) {
    console.error("[Swap Quote] Handler error:", e);
    return res.status(500).json({
      error: "Quote handler error",
      details: e?.message || String(e),
      code: "QUOTE_HANDLER_ERROR",
    });
  }
};

/**
 * POST /api/swap/execute
 * Builds an unsigned swap transaction from a quote
 *
 * Request body:
 * {
 *   quoteResponse: object (quote from /api/swap/quote),
 *   userPublicKey: string (wallet address),
 *   swapMode?: string (optional: ExactIn, ExactOut),
 *   wrapAndUnwrapSol?: boolean (optional, default: true),
 *   slippageBps?: number (optional)
 * }
 */
export const handleSwapExecuteV2: RequestHandler = async (req, res) => {
  try {
    const body = req.body || {};
    const { quoteResponse, userPublicKey, swapMode } = body;

    if (!quoteResponse) {
      return res.status(400).json({
        error: "Missing required field: quoteResponse",
        details: "quoteResponse should be the result from /api/swap/quote",
      });
    }

    if (!userPublicKey) {
      return res.status(400).json({
        error: "Missing required field: userPublicKey",
        details: "userPublicKey should be a valid Solana address",
      });
    }

    // Validate public key format (base58, ~34-44 chars)
    if (typeof userPublicKey !== "string" || userPublicKey.length < 32) {
      return res.status(400).json({
        error: "Invalid userPublicKey format",
        details: "Public key must be a valid Solana address",
      });
    }

    console.log(
      `[Swap Execute] Building transaction for wallet: ${userPublicKey.slice(0, 10)}...`,
    );
    console.log(
      `[Swap Execute] Quote source: ${quoteResponse.source || "unknown"}`,
    );

    // Build Jupiter swap transaction
    const swapPayload = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      ...(swapMode && { swapMode }),
    };

    const urls = [
      "https://quote-api.jup.ag/v6/swap",
      "https://lite-api.jup.ag/swap/v1/swap",
    ];

    for (const url of urls) {
      try {
        console.log(`[Swap Execute] Attempting: ${url}`);

        const response = await fetchWithTimeout(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(swapPayload),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.warn(
            `[Swap Execute] Endpoint ${url} failed with ${response.status}`,
          );

          if (response.status === 400 || response.status === 404) {
            // Client error - don't retry other endpoints
            return res.status(response.status).json({
              error: "Failed to build swap transaction",
              details: errorText || response.statusText,
              code:
                response.status === 404 ? "ROUTE_NOT_FOUND" : "INVALID_REQUEST",
            });
          }

          // Server error - try next endpoint
          if (url === urls[0]) {
            console.log(`[Swap Execute] Trying fallback endpoint...`);
            continue;
          }

          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const swapData = await response.json();

        if (swapData.error) {
          return res.status(400).json({
            error: "Swap transaction error",
            details: swapData.error,
            code: swapData.code,
          });
        }

        if (!swapData.swapTransaction) {
          return res.status(500).json({
            error: "Invalid response from swap API",
            details: "Missing swapTransaction in response",
          });
        }

        console.log(
          `[Swap Execute] ✅ Transaction built successfully (${swapData.swapTransaction.length} bytes base64)`,
        );
        return res.json(swapData);
      } catch (e: any) {
        console.warn(
          `[Swap Execute] Error with ${url}:`,
          e instanceof Error ? e.message : String(e),
        );

        // If this is the last URL, throw
        if (url === urls[urls.length - 1]) {
          throw e;
        }

        // Otherwise continue to next
        continue;
      }
    }

    throw new Error("All swap endpoints failed");
  } catch (e: any) {
    console.error("[Swap Execute] Handler error:", e);
    return res.status(502).json({
      error: "Failed to build swap transaction",
      details: e instanceof Error ? e.message : String(e),
      code: "EXECUTION_ERROR",
    });
  }
};
