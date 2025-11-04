import { RequestHandler } from "express";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";

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
      try {
        console.log(`[Swap] Trying Jupiter quote: ${inputMint} -> ${outputMint}`);

        const response = await fetchWithTimeout(url);
        if (!response.ok) {
          if (response.status === 404 || response.status === 400) {
            console.warn(
              `[Swap] Jupiter quote returned ${response.status} - no route for ${inputMint} -> ${outputMint}`,
            );
            continue;
          }
          if (response.status === 429 || response.status >= 500) {
            console.warn(
              `[Swap] Jupiter API error ${response.status}, trying next endpoint`,
            );
            continue;
          }
          return null;
        }

        const data = await response.json();
        if (!data.outAmount || data.outAmount === "0") {
          console.warn(
            `[Swap] Jupiter returned empty quote for ${inputMint} -> ${outputMint}`,
          );
          continue;
        }

        console.log(
          `[Swap] ✅ Jupiter quote success: ${inputMint} -> ${outputMint}`,
        );
        return data;
      } catch (e: any) {
        console.warn(`[Swap] Jupiter endpoint error: ${e?.message || e}`);
        continue;
      }
    }

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
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
    });

    const url = `https://api.meteora.ag/swap/v3/quote?${params.toString()}`;
    console.log(`[Swap] Trying Meteora quote: ${inputMint} -> ${outputMint}`);

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      if (response.status === 404 || response.status === 400) {
        console.warn(
          `[Swap] Meteora quote returned ${response.status} - no route for ${inputMint} -> ${outputMint}`,
        );
        return null;
      }
      if (response.status === 429 || response.status >= 500) {
        console.warn(
          `[Swap] Meteora API error ${response.status}, trying fallback`,
        );
        return null;
      }
      console.warn(
        `[Swap] Meteora quote failed with ${response.status} for ${inputMint} -> ${outputMint}`,
      );
      return null;
    }

    const data = await response.json();

    // Validate Meteora response has expected fields
    if (!data || (!data.estimatedOut && !data.outAmount && !data.minReceived)) {
      console.warn(
        `[Swap] Meteora returned invalid quote for ${inputMint} -> ${outputMint}`,
      );
      return null;
    }

    console.log(
      `[Swap] ✅ Meteora quote success: ${inputMint} -> ${outputMint}`,
    );
    return data;
  } catch (e: any) {
    console.warn(`[Swap] Meteora quote error: ${e?.message || e}`);
    return null;
  }
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
        if (!q1 || !q1.outAmount) {
          console.warn(`[Swap] Leg 1 failed for bridge ${bridge}`);
          continue;
        }

        // Second leg: bridge -> outputMint
        const q2 = await getJupiterQuote(
          bridge,
          outputMint,
          q1.outAmount,
          slippageBps,
        );
        if (!q2 || !q2.outAmount) {
          console.warn(`[Swap] Leg 2 failed for bridge ${bridge}`);
          continue;
        }

        console.log(`[Swap] ✅ Bridged route successful via ${bridge}`);
        return { bridge, q1, q2 };
      } catch (e) {
        console.warn(`[Swap] Bridge ${bridge} error: ${e}`);
        continue;
      }
    }

    console.warn(`[Swap] No bridged routes available`);
    return null;
  } catch (e: any) {
    console.warn(`[Swap] Bridged quote error: ${e?.message || e}`);
    return null;
  }
}

/**
 * GET /api/swap/quote
 * Unified quote endpoint with fallback chain
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

    if (isNaN(slippageBps) || slippageBps < 0) {
      return res.status(400).json({
        error: "Invalid slippageBps",
      });
    }

    const attempts: SwapAttempt[] = [];

    // Try Jupiter direct quote first
    console.log(`[Swap Quote] ${inputMint} -> ${outputMint} (${amount})`);
    let quote = await getJupiterQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps,
    );
    if (quote && quote.outAmount && quote.outAmount !== "0") {
      attempts.push({ provider: "jupiter", status: "success" });
      return res.json({
        quote,
        source: "jupiter",
        attempts,
      });
    }
    attempts.push({
      provider: "jupiter",
      status: "failed",
      reason: "No liquidity or route",
    });

    // Try Meteora quote
    quote = await getMeteOraQuote(inputMint, outputMint, amount);
    if (quote && quote.outAmount && quote.outAmount !== "0") {
      attempts.push({ provider: "meteora", status: "success" });
      return res.json({
        quote,
        source: "meteora",
        attempts,
      });
    }
    attempts.push({
      provider: "meteora",
      status: "failed",
      reason: "No liquidity or route",
    });

    // Try bridged routes
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
      return res.json({
        quote: bridged.q2, // Return final quote
        source: "bridged",
        bridgeToken: bridged.bridge,
        leg1: bridged.q1,
        leg2: bridged.q2,
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
      `[Swap Quote] No routes found for ${inputMint} -> ${outputMint}`,
    );
    return res.status(404).json({
      error: "No swap route found",
      inputMint,
      outputMint,
      amount,
      attempts,
      suggestions: [
        "Check token pair liquidity",
        "Try different slippage tolerance",
        "Check token is bridged/supported",
      ],
    });
  } catch (e: any) {
    console.error("[Swap Quote] Handler error:", e);
    return res.status(500).json({
      error: "Quote handler error",
      details: e?.message || String(e),
    });
  }
};

/**
 * POST /api/swap/execute
 * Execute a swap transaction (unsigned)
 */
export const handleSwapExecuteV2: RequestHandler = async (req, res) => {
  try {
    const body = req.body || {};
    const { quoteResponse, userPublicKey, swapMode } = body;

    if (!quoteResponse || !userPublicKey) {
      return res.status(400).json({
        error: "Missing required fields: quoteResponse, userPublicKey",
      });
    }

    console.log(`[Swap Execute] Building transaction for ${userPublicKey}`);

    // Build Jupiter swap transaction
    const swapPayload = {
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      ...(swapMode && { swapMode }),
    };

    const response = await fetchWithTimeout(
      "https://quote-api.jup.ag/v6/swap",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(swapPayload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[Swap Execute] Jupiter swap failed: ${response.status}`);
      return res.status(response.status).json({
        error: "Failed to build swap transaction",
        details: errorText,
      });
    }

    const swapData = await response.json();

    if (swapData.error) {
      return res.status(400).json({
        error: swapData.error,
        code: swapData.code,
      });
    }

    console.log(`[Swap Execute] ✅ Transaction built successfully`);
    return res.json(swapData);
  } catch (e: any) {
    console.error("[Swap Execute] Error:", e);
    return res.status(502).json({
      error: "Failed to execute swap",
      details: e?.message || String(e),
    });
  }
};
