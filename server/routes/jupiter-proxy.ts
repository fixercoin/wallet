import { RequestHandler } from "express";

interface JupiterPriceResponse {
  data: Record<string, { price: number }>;
}

// Jupiter endpoints
const JUPITER_PRICE_ENDPOINTS = [
  "https://price.jup.ag/v4",
  "https://api.jup.ag/price/v2",
];
const JUPITER_SWAP_BASE = "https://lite-api.jup.ag/swap/v1";

let currentEndpointIndex = 0;

const tryJupiterEndpoints = async (
  path: string,
  params: URLSearchParams,
): Promise<any> => {
  let lastError: Error | null = null;

  for (let i = 0; i < JUPITER_PRICE_ENDPOINTS.length; i++) {
    const endpointIndex =
      (currentEndpointIndex + i) % JUPITER_PRICE_ENDPOINTS.length;
    const endpoint = JUPITER_PRICE_ENDPOINTS[endpointIndex];
    const url = `${endpoint}${path}?${params.toString()}`;

    try {
      console.log(`Trying Jupiter API: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Rate limited on ${endpoint}, trying next...`);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      currentEndpointIndex = endpointIndex;
      console.log(`Jupiter API call successful via ${endpoint}`);
      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`Jupiter endpoint ${endpoint} failed:`, errorMsg);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < JUPITER_PRICE_ENDPOINTS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `All Jupiter endpoints failed. Last error: ${lastError?.message || "Unknown error"}`,
  );
};

export const handleJupiterPrice: RequestHandler = async (req, res) => {
  try {
    const { ids } = req.query;

    if (!ids || typeof ids !== "string") {
      return res.status(400).json({
        error:
          "Missing or invalid 'ids' parameter. Expected comma-separated token mints.",
      });
    }

    console.log(`Jupiter price request for tokens: ${ids}`);

    const params = new URLSearchParams({
      ids: ids,
    });

    const data = await tryJupiterEndpoints("/price", params);

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from Jupiter API");
    }

    console.log(
      `Jupiter price response: ${Object.keys(data.data || {}).length} tokens`,
    );
    res.json(data);
  } catch (error) {
    console.error("Jupiter price proxy error:", {
      ids: req.query.ids,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      data: {},
    });
  }
};

export const handleJupiterTokens: RequestHandler = async (req, res) => {
  try {
    const { type = "strict" } = req.query as { type?: string };

    console.log(`Jupiter tokens request: ${type}`);

    const typesToTry = [type || "strict", "all"]; // fallback to 'all' if 'strict' fails
    const baseEndpoints = (t: string) => [
      `https://token.jup.ag/${t}`,
      "https://cache.jup.ag/tokens",
    ];

    const fetchWithTimeout = (url: string, timeoutMs: number) => {
      const timeoutPromise = new Promise<Response>((resolve) => {
        setTimeout(
          () =>
            resolve(
              new Response("", { status: 504, statusText: "Gateway Timeout" }),
            ),
          timeoutMs,
        );
      });
      return Promise.race([
        fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
        }),
        timeoutPromise,
      ]) as Promise<Response>;
    };

    let lastError: string = "";

    for (const t of typesToTry) {
      const endpoints = baseEndpoints(t);
      for (let attempt = 1; attempt <= 3; attempt++) {
        for (const endpoint of endpoints) {
          try {
            const response = await fetchWithTimeout(endpoint, 15000);
            if (!response.ok) {
              lastError = `${endpoint} -> ${response.status} ${response.statusText}`;
              // retry on rate limiting / server errors
              if (response.status === 429 || response.status >= 500) continue;
              continue;
            }
            const data = await response.json();
            const count = Array.isArray(data) ? data.length : 0;
            console.log(
              `Jupiter tokens response (${t}) via ${endpoint}: ${count} tokens`,
            );
            return res.json(data);
          } catch (e: any) {
            lastError = `${endpoint} -> ${e?.message || String(e)}`;
            console.warn(`Jupiter tokens fetch failed: ${lastError}`);
          }
        }
        await new Promise((r) => setTimeout(r, attempt * 500));
      }
    }

    return res.status(502).json({
      error: {
        message: "All Jupiter token endpoints failed",
        details: lastError || "Unknown error",
      },
      data: [],
    });
  } catch (error) {
    console.error("Jupiter tokens proxy error:", {
      type: req.query.type,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal error",
        details: String(error),
      },
      data: [],
    });
  }
};

export const handleJupiterQuote: RequestHandler = async (req, res) => {
  try {
    const { inputMint, outputMint, amount, slippageBps, asLegacyTransaction } =
      req.query;

    if (
      !inputMint ||
      !outputMint ||
      !amount ||
      typeof inputMint !== "string" ||
      typeof outputMint !== "string" ||
      typeof amount !== "string"
    ) {
      return res.status(400).json({
        error: "Missing required query params: inputMint, outputMint, amount",
      });
    }

    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: typeof slippageBps === "string" ? slippageBps : "50",
      onlyDirectRoutes: "false",
      asLegacyTransaction:
        typeof asLegacyTransaction === "string" ? asLegacyTransaction : "false",
    });

    const url = `${JUPITER_SWAP_BASE}/quote?${params.toString()}`;

    const fetchWithTimeout = (timeoutMs: number) => {
      const timeoutPromise = new Promise<Response>((resolve) => {
        setTimeout(
          () =>
            resolve(
              new Response("", { status: 504, statusText: "Gateway Timeout" }),
            ),
          timeoutMs,
        );
      });
      const fetchPromise = fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
      });
      return Promise.race([fetchPromise, timeoutPromise]) as Promise<Response>;
    };

    // Try up to 3 attempts with small backoff on 5xx/429
    let lastStatus = 0;
    let lastText = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetchWithTimeout(15000);
      lastStatus = response.status;
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      lastText = await response.text().catch(() => "");

      // If 404 or 400, likely means no route exists for this pair
      if (response.status === 404 || response.status === 400) {
        console.warn(
          `Jupiter quote returned ${response.status} - likely no route for this pair`,
          { inputMint: req.query.inputMint, outputMint: req.query.outputMint },
        );
        return res.status(response.status).json({
          error: `No swap route found for this pair`,
          details: lastText,
          code: response.status === 404 ? "NO_ROUTE_FOUND" : "INVALID_PARAMS",
        });
      }

      // Retry on rate limit or server errors
      if (response.status === 429 || response.status >= 500) {
        console.warn(
          `Jupiter API returned ${response.status}, retrying... (attempt ${attempt}/3)`,
        );
        await new Promise((r) => setTimeout(r, attempt * 500));
        continue;
      }
      break;
    }

    return res.status(lastStatus || 500).json({
      error: `Quote API error`,
      details: lastText,
      code: lastStatus === 504 ? "TIMEOUT" : "API_ERROR",
    });
  } catch (error) {
    console.error("Jupiter quote proxy error:", {
      params: req.query,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
};

export const handleJupiterSwap: RequestHandler = async (req, res) => {
  try {
    const body = req.body || {};
    console.log(
      "handleJupiterSwap received body keys:",
      Object.keys(body || {}),
    );

    if (!body || !body.quoteResponse || !body.userPublicKey) {
      console.warn(
        "handleJupiterSwap missing fields, body:",
        JSON.stringify(body),
      );
      return res.status(400).json({
        error:
          "Missing required body: { quoteResponse, userPublicKey, ...options }",
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${JUPITER_SWAP_BASE}/swap`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return res
        .status(response.status)
        .json({ error: `Swap failed: ${response.statusText}`, details: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Jupiter swap proxy error:", {
      body: req.body,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
};
