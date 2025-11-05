import { json } from "./utils";

export interface Env {
  SOLANA_RPC?: string;
}

const TIMEOUT_MS = 20000;
const BRIDGE_TOKENS = [
  "So11111111111111111111111111111111111111112", // SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns", // USDT
];

interface SwapAttempt {
  provider: string;
  status: "success" | "failed";
  reason?: string;
  error?: string;
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
        console.log(
          `[Swap] Trying Jupiter quote: ${inputMint} -> ${outputMint}`,
        );

        const response = await fetchWithTimeout(url);
        if (!response.ok) {
          if (response.status === 404 || response.status === 400) {
            console.warn(
              `[Swap] Jupiter returned ${response.status} - no route`,
            );
            continue;
          }
          if (response.status === 429 || response.status >= 500) {
            console.warn(
              `[Swap] Jupiter API error ${response.status}, trying next`,
            );
            continue;
          }
          return null;
        }

        const data = await response.json();
        if (!data.outAmount || data.outAmount === "0") {
          console.warn(`[Swap] Jupiter returned empty quote`);
          continue;
        }

        console.log(`[Swap] ✅ Jupiter quote success`);
        return data;
      } catch (e: any) {
        console.warn(`[Swap] Jupiter endpoint error: ${e?.message}`);
        continue;
      }
    }

    return null;
  } catch (e: any) {
    console.warn(`[Swap] Jupiter quote error: ${e?.message}`);
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
        console.warn(`[Swap] Meteora returned ${response.status}`);
        return null;
      }
      if (response.status === 429 || response.status >= 500) {
        console.warn(`[Swap] Meteora API error ${response.status}`);
        return null;
      }
      console.warn(`[Swap] Meteora quote failed with ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data || (!data.estimatedOut && !data.outAmount && !data.minReceived)) {
      console.warn(`[Swap] Meteora returned invalid quote`);
      return null;
    }

    console.log(`[Swap] ✅ Meteora quote success`);
    return data;
  } catch (e: any) {
    console.warn(`[Swap] Meteora quote error: ${e?.message}`);
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
    for (const bridge of BRIDGE_TOKENS) {
      if (bridge === inputMint || bridge === outputMint) continue;

      try {
        console.log(
          `[Swap] Trying bridged route: ${inputMint} -> ${bridge} -> ${outputMint}`,
        );

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
    console.warn(`[Swap] Bridged quote error: ${e?.message}`);
    return null;
  }
}

export async function handleSwapQuote(
  request: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const inputMint = url.searchParams.get("inputMint") || "";
    const outputMint = url.searchParams.get("outputMint") || "";
    const amount = url.searchParams.get("amount") || "";
    const slippageBps = parseInt(
      url.searchParams.get("slippageBps") || "50",
      10,
    );

    if (!inputMint || !outputMint || !amount) {
      return json(
        {
          error: "Missing required params: inputMint, outputMint, amount",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    if (isNaN(slippageBps) || slippageBps < 0 || slippageBps > 10000) {
      return json(
        {
          error: "Invalid slippageBps (must be 0-10000)",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    try {
      const amountNum = BigInt(amount);
      if (amountNum <= 0n) {
        return json(
          {
            error: "Amount must be greater than 0",
          },
          { status: 400, headers: corsHeaders },
        );
      }
    } catch {
      return json(
        {
          error: "Invalid amount",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const attempts: SwapAttempt[] = [];

    console.log(
      `[Swap Quote] Requesting: ${inputMint} -> ${outputMint} (${amount})`,
    );

    // Try Jupiter first
    let quote = await getJupiterQuote(
      inputMint,
      outputMint,
      amount,
      slippageBps,
    );
    if (quote && quote.outAmount && quote.outAmount !== "0") {
      attempts.push({ provider: "jupiter", status: "success" });
      console.log(`[Swap Quote] ✅ Jupiter route found`);
      return json(
        {
          quote,
          source: "jupiter",
          inputMint,
          outputMint,
          amount,
          slippageBps,
          attempts,
        },
        { headers: corsHeaders },
      );
    }
    attempts.push({
      provider: "jupiter",
      status: "failed",
      reason: "No liquidity or route found",
    });

    // Try Meteora
    console.log(`[Swap Quote] Jupiter failed, trying Meteora...`);
    quote = await getMeteOraQuote(inputMint, outputMint, amount);
    if (quote && (quote.outAmount || quote.estimatedOut || quote.minReceived)) {
      attempts.push({ provider: "meteora", status: "success" });
      console.log(`[Swap Quote] ✅ Meteora route found`);
      return json(
        {
          quote,
          source: "meteora",
          inputMint,
          outputMint,
          amount,
          attempts,
        },
        { headers: corsHeaders },
      );
    }
    attempts.push({
      provider: "meteora",
      status: "failed",
      reason: "No liquidity or route found",
    });

    // Try bridged routes
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
      console.log(`[Swap Quote] ✅ Bridged route found`);
      return json(
        {
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
        },
        { headers: corsHeaders },
      );
    }
    attempts.push({
      provider: "bridged",
      status: "failed",
      reason: "No bridge routes available",
    });

    console.warn(`[Swap Quote] ❌ No routes found`);
    return json(
      {
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
      },
      { status: 404, headers: corsHeaders },
    );
  } catch (e: any) {
    console.error("[Swap Quote] Handler error:", e);
    return json(
      {
        error: "Quote handler error",
        details: e?.message || String(e),
        code: "QUOTE_HANDLER_ERROR",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function handleSwapExecute(
  request: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));

    const { quoteResponse, userPublicKey, swapMode } = body as any;

    if (!quoteResponse) {
      return json(
        {
          error: "Missing required field: quoteResponse",
          details: "quoteResponse should be the result from /api/swap/quote",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!userPublicKey) {
      return json(
        {
          error: "Missing required field: userPublicKey",
          details: "userPublicKey should be a valid Solana address",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    if (typeof userPublicKey !== "string" || userPublicKey.length < 32) {
      return json(
        {
          error: "Invalid userPublicKey format",
          details: "Public key must be a valid Solana address",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    console.log(
      `[Swap Execute] Building transaction for ${userPublicKey.slice(0, 10)}...`,
    );

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
            return json(
              {
                error: "Failed to build swap transaction",
                details: errorText || response.statusText,
                code:
                  response.status === 404
                    ? "ROUTE_NOT_FOUND"
                    : "INVALID_REQUEST",
              },
              { status: response.status, headers: corsHeaders },
            );
          }

          if (url === urls[0]) {
            console.log(`[Swap Execute] Trying fallback endpoint...`);
            continue;
          }

          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const swapData = await response.json();

        if (swapData.error) {
          return json(
            {
              error: "Swap transaction error",
              details: swapData.error,
              code: swapData.code,
            },
            { status: 400, headers: corsHeaders },
          );
        }

        if (!swapData.swapTransaction) {
          return json(
            {
              error: "Invalid response from swap API",
              details: "Missing swapTransaction in response",
            },
            { status: 500, headers: corsHeaders },
          );
        }

        console.log(`[Swap Execute] ✅ Transaction built successfully`);
        return json(swapData, { headers: corsHeaders });
      } catch (e: any) {
        console.warn(`[Swap Execute] Error with ${url}: ${e?.message}`);

        if (url === urls[urls.length - 1]) {
          throw e;
        }

        continue;
      }
    }

    throw new Error("All swap endpoints failed");
  } catch (e: any) {
    console.error("[Swap Execute] Handler error:", e);
    return json(
      {
        error: "Failed to build swap transaction",
        details: e?.message || String(e),
        code: "EXECUTION_ERROR",
      },
      { status: 502, headers: corsHeaders },
    );
  }
}
