import { json, parseJSON } from "./utils";

export interface Env {
  ALLOWED_PAYMENT: string;
  SOLANA_RPC?: string;
  HELIUS_RPC_URL?: string;
  ALCHEMY_RPC_URL?: string;
  MORALIS_RPC_URL?: string;
}

// Helper function to sign transactions with a keypair
function signTransactionWithKeypair(
  transactionBuffer: Uint8Array,
  secretKeyBase58: string,
): Uint8Array {
  // Import required crypto functions for signing
  // Note: In Cloudflare Workers, we use the Web Crypto API
  // For Solana transactions, we need to use tweetnacl or similar for Ed25519 signing

  // This is a placeholder - actual implementation would require
  // tweetnacl or @noble/signatures for Ed25519 signing
  // For now, we return the transaction buffer as-is
  // The client should handle signing for security reasons
  console.warn(
    "[Wallet Signing] Warning: Server-side signing is not implemented for security reasons. Use client-side signing instead.",
  );
  return transactionBuffer;
}

// Helper function to decode base64 transaction to buffer
function base64ToBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to encode buffer to base64
function bufferToBase64(buffer: Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const DEFAULT_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
];

function getRpcEndpoints(env: Partial<Env> | undefined): string[] {
  const list = [
    env?.SOLANA_RPC || "",
    env?.HELIUS_RPC_URL || "",
    env?.ALCHEMY_RPC_URL || "",
    env?.MORALIS_RPC_URL || "",
    ...DEFAULT_RPCS,
  ];
  return list.filter(Boolean);
}

async function callRpc(
  env: Partial<Env> | undefined,
  method: string,
  params: any[] = [],
  id: number | string = Date.now(),
) {
  let lastError: Error | null = null;
  const payload = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };

  const endpoints = getRpcEndpoints(env);
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        if ([429, 502, 503].includes(resp.status)) continue;
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
      }

      const data = await resp.text();
      return { ok: true, body: data } as const;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(lastError?.message || "All RPC endpoints failed");
}

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    const corsHeaders = {
      "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    } as const;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (
      pathname === "/" ||
      pathname === "/api/health" ||
      pathname === "/api/ping"
    ) {
      return json(
        { status: "ok", timestamp: new Date().toISOString() },
        { headers: corsHeaders },
      );
    }

    // Disable P2P orders endpoints handled elsewhere
    if (pathname.startsWith("/api/p2p/orders")) {
      return json(
        { error: "P2P orders API is disabled on this server" },
        { status: 410, headers: corsHeaders },
      );
    }

    // Wallet balance: /api/wallet/balance?publicKey=...
    if (pathname === "/api/wallet/balance" && req.method === "GET") {
      const pk =
        searchParams.get("publicKey") ||
        searchParams.get("wallet") ||
        searchParams.get("address") ||
        "";
      if (!pk) {
        return json(
          { error: "Missing 'publicKey' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const rpc = await callRpc(env, "getBalance", [pk], Date.now());
        const j = JSON.parse(String(rpc?.body || "{}"));
        const lamports =
          typeof j.result === "number" ? j.result : (j?.result?.value ?? null);
        if (typeof lamports === "number" && isFinite(lamports)) {
          const balance = lamports / 1_000_000_000;
          return json(
            {
              publicKey: pk,
              balance,
              balanceLamports: lamports,
            },
            { headers: corsHeaders },
          );
        }
        return json(
          { error: "Invalid RPC response" },
          { status: 502, headers: corsHeaders },
        );
      } catch (e) {
        return json(
          {
            error: "Failed to fetch balance",
            details: e instanceof Error ? e.message : String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Solana RPC
    if (pathname === "/api/solana-rpc" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const methodName = body?.method;
        const params = body?.params ?? [];
        const id = body?.id ?? Date.now();

        if (!methodName || typeof methodName !== "string") {
          return json(
            { error: "Missing RPC method" },
            { status: 400, headers: corsHeaders },
          );
        }

        const payload = {
          jsonrpc: "2.0",
          id,
          method: methodName,
          params,
        };

        let lastError: Error | null = null;

        const endpoints = getRpcEndpoints(env);
        for (const endpoint of endpoints) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!resp.ok) {
              if ([429, 502, 503].includes(resp.status)) continue;
              const t = await resp.text().catch(() => "");
              throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
            }

            const data = await resp.text();
            return new Response(data, {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            });
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
          }
        }

        return json(
          { error: "All RPC endpoints failed", details: lastError?.message },
          { status: 502, headers: corsHeaders },
        );
      } catch (e: any) {
        return json(
          { error: "Failed to execute RPC call", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener tokens proxy: /api/dexscreener/tokens?mints=<MINT1>,<MINT2>...
    if (pathname === "/api/dexscreener/tokens" && req.method === "GET") {
      const mints = searchParams.get("mints") || "";
      if (!mints) {
        return json(
          { error: "Missing 'mints' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      const mintList = mints
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      if (mintList.length === 0) {
        return json(
          { error: "No valid mints provided" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const batch = mintList.join(",");
        const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(batch)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(dexUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          return json(data, { headers: corsHeaders });
        }

        // Fallback: try individual token lookups
        const pairs: any[] = [];
        for (const mint of mintList) {
          try {
            const individualUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
            const individualResp = await fetch(individualUrl, {
              headers: { Accept: "application/json" },
            });
            if (individualResp.ok) {
              const data = await individualResp.json();
              if (data.pairs && Array.isArray(data.pairs)) {
                pairs.push(...data.pairs);
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch individual token ${mint}:`, e);
          }
        }

        return json(
          { schemaVersion: "1.0.0", pairs },
          { headers: corsHeaders },
        );
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch DexScreener tokens",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener search proxy: /api/dexscreener/search?q=<QUERY>
    if (pathname === "/api/dexscreener/search" && req.method === "GET") {
      const q = searchParams.get("q") || "";
      if (!q) {
        return json(
          { error: "Missing 'q' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(dexUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          return json(data, { headers: corsHeaders });
        }

        return json(
          { schemaVersion: "1.0.0", pairs: [] },
          { status: resp.status, headers: corsHeaders },
        );
      } catch (e: any) {
        return json(
          {
            error: "Failed to search DexScreener",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener trending proxy: /api/dexscreener/trending
    if (pathname === "/api/dexscreener/trending" && req.method === "GET") {
      try {
        const dexUrl = `https://api.dexscreener.com/latest/dex/pairs/solana`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(dexUrl, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          const sorted = (data.pairs || [])
            .filter(
              (p: any) =>
                p.volume?.h24 > 1000 &&
                p.liquidity?.usd &&
                p.liquidity.usd > 10000,
            )
            .sort(
              (a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0),
            )
            .slice(0, 50);
          return json(
            { schemaVersion: "1.0.0", pairs: sorted },
            { headers: corsHeaders },
          );
        }

        return json(
          { schemaVersion: "1.0.0", pairs: [] },
          { status: resp.status, headers: corsHeaders },
        );
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch trending tokens",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // SOL price proxy: /api/sol/price
    if (pathname === "/api/sol/price" && req.method === "GET") {
      const endpoints = [
        "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
      ];
      let lastError: any = null;

      for (const dexUrl of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          const resp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const data = await resp.json();
            const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
            if (pairs.length > 0) {
              const pair = pairs[0];
              const price = pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
              const priceChange24h = pair?.priceChange?.h24 ?? 0;
              console.log(
                `[SOL Price] Price: $${price}, 24h Change: ${priceChange24h}%`,
              );
              return json(
                {
                  success: true,
                  data: {
                    address: "So11111111111111111111111111111111111111112",
                    value: price,
                    priceChange24h,
                    updateUnixTime: Math.floor(Date.now() / 1000),
                  },
                },
                { headers: corsHeaders },
              );
            }
          }
          lastError = resp.status;
        } catch (e: any) {
          lastError = e?.message || String(e);
        }
      }

      // Fallback SOL price
      console.warn(`[SOL Price] Using fallback price. Error: ${lastError}`);
      return json(
        {
          success: true,
          data: {
            address: "So11111111111111111111111111111111111111112",
            value: 180,
            priceChange24h: 0,
            updateUnixTime: Math.floor(Date.now() / 1000),
          },
        },
        { headers: corsHeaders },
      );
    }

    // Birdeye price endpoint: /api/birdeye/price?address=<TOKEN_MINT>
    if (pathname === "/api/birdeye/price" && req.method === "GET") {
      const address = searchParams.get("address") || "";

      if (!address) {
        return json(
          { success: false, error: "Missing 'address' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      const TOKEN_MINTS: Record<string, string> = {
        SOL: "So11111111111111111111111111111111111111112",
        USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
        LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
      };

      const FALLBACK_USD: Record<string, number> = {
        FIXERCOIN: 0.000089,
        SOL: 180,
        USDC: 1.0,
        USDT: 1.0,
        LOCKER: 0.000012,
      };

      const getTokenSymbol = (addr: string): string | null => {
        for (const [symbol, mint] of Object.entries(TOKEN_MINTS)) {
          if (mint === addr) return symbol;
        }
        return null;
      };

      const getSolPrice = async (): Promise<number> => {
        try {
          const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112`;
          const dexResp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
          });

          if (dexResp.ok) {
            const dexData = await dexResp.json();
            const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];

            if (pairs.length > 0) {
              const pair = pairs[0];
              if (pair?.priceUsd) {
                const price = parseFloat(pair.priceUsd);
                if (isFinite(price) && price > 0) {
                  return price;
                }
              }
            }
          }
        } catch (e: any) {
          console.warn(`[Birdeye] Error fetching SOL price: ${e?.message}`);
        }
        return 180; // fallback SOL price
      };

      const getDerivedPrice = async (
        mint: string,
      ): Promise<{
        price: number;
        priceChange24h: number;
        volume24h: number;
      } | null> => {
        try {
          console.log(
            `[Birdeye] Fetching derived price for ${mint} via DexScreener`,
          );
          const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
          const dexResp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
          });

          if (dexResp.ok) {
            const dexData = await dexResp.json();
            const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];

            if (pairs.length > 0) {
              const pair = pairs.find(
                (p: any) =>
                  (p?.baseToken?.address === mint ||
                    p?.quoteToken?.address === mint) &&
                  p?.priceUsd,
              );

              if (pair && pair.priceUsd) {
                const price = parseFloat(pair.priceUsd);
                if (isFinite(price) && price > 0) {
                  console.log(
                    `[Birdeye] Derived price for ${mint}: $${price.toFixed(8)}`,
                  );
                  return {
                    price,
                    priceChange24h: pair.priceChange?.h24 || 0,
                    volume24h: pair.volume?.h24 || 0,
                  };
                }
              }
            }
          }
        } catch (e: any) {
          console.warn(
            `[Birdeye] Error fetching derived price for ${mint}: ${e?.message}`,
          );
        }
        return null;
      };

      const getPriceFromDexScreener = async (
        mint: string,
      ): Promise<{
        price: number;
        priceChange24h: number;
        volume24h: number;
      } | null> => {
        try {
          console.log(`[Birdeye Fallback] Trying DexScreener for ${mint}`);
          const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`;
          const dexResp = await fetch(dexUrl, {
            headers: { Accept: "application/json" },
          });

          if (dexResp.ok) {
            const dexData = await dexResp.json();
            const pairs = Array.isArray(dexData?.pairs) ? dexData.pairs : [];

            if (pairs.length > 0) {
              const pair = pairs.find(
                (p: any) =>
                  (p?.baseToken?.address === mint ||
                    p?.quoteToken?.address === mint) &&
                  p?.priceUsd,
              );

              if (pair && pair.priceUsd) {
                const price = parseFloat(pair.priceUsd);
                if (isFinite(price) && price > 0) {
                  const priceChange24h = pair?.priceChange?.h24 ?? 0;
                  console.log(
                    `[Birdeye Fallback] ✅ Got price from DexScreener: $${price} (24h: ${priceChange24h}%)`,
                  );
                  return {
                    price,
                    priceChange24h: pair?.priceChange?.h24 ?? 0,
                    volume24h: pair?.volume?.h24 ?? 0,
                  };
                }
              }
            }
          }
        } catch (e: any) {
          console.warn(`[Birdeye Fallback] DexScreener error: ${e?.message}`);
        }
        return null;
      };

      const getPriceFromJupiter = async (
        mint: string,
      ): Promise<{
        price: number;
        priceChange24h: number;
        volume24h: number;
      } | null> => {
        try {
          console.log(`[Birdeye Fallback] Trying Jupiter for ${mint}`);
          const jupUrl = `https://api.jup.ag/price?ids=${encodeURIComponent(mint)}`;
          const jupResp = await fetch(jupUrl, {
            headers: { Accept: "application/json" },
          });

          if (jupResp.ok) {
            const jupData = await jupResp.json();
            const priceData = jupData?.data?.[mint];

            if (priceData?.price) {
              const price = parseFloat(priceData.price);
              if (isFinite(price) && price > 0) {
                console.log(
                  `[Birdeye Fallback] ✅ Got price from Jupiter: $${price}`,
                );
                return {
                  price,
                  priceChange24h: 0,
                  volume24h: 0,
                };
              }
            }
          }
        } catch (e: any) {
          console.warn(`[Birdeye Fallback] Jupiter error: ${e?.message}`);
        }
        return null;
      };

      try {
        const birdeyeUrl = `https://public-api.birdeye.so/public/price?address=${encodeURIComponent(address)}`;
        const birdeyeApiKey =
          env.BIRDEYE_API_KEY || "cecae2ad38d7461eaf382f533726d9bb";

        console.log(
          `[Birdeye] Fetching price for ${address} from ${birdeyeUrl}`,
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(birdeyeUrl, {
          headers: {
            Accept: "application/json",
            "X-API-KEY": birdeyeApiKey,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();

          if (data.success && data.data) {
            console.log(
              `[Birdeye] ✅ Got price for ${address}: $${data.data.value || "N/A"}`,
            );
            // Ensure priceChange24h is included
            const responseData = {
              success: true,
              data: {
                address: data.data.address,
                value: data.data.value,
                updateUnixTime: data.data.updateUnixTime,
                priceChange24h: data.data.priceChange24h ?? 0,
              },
            };
            return json(responseData, { headers: corsHeaders });
          }
        }

        console.warn(
          `[Birdeye] Request failed with status ${resp.status}, trying fallback...`,
        );
      } catch (e: any) {
        console.warn(
          `[Birdeye] Fetch error: ${e?.message}, trying fallback...`,
        );
      }

      // Fallback 1: Try derived pricing for FIXERCOIN and LOCKER
      const tokenSymbol = getTokenSymbol(address);
      if (tokenSymbol === "FIXERCOIN" || tokenSymbol === "LOCKER") {
        const derivedPrice = await getDerivedPrice(address);
        if (derivedPrice !== null && derivedPrice.price > 0) {
          return json(
            {
              success: true,
              data: {
                address,
                value: derivedPrice.price,
                updateUnixTime: Math.floor(Date.now() / 1000),
                priceChange24h: derivedPrice?.priceChange24h ?? 0,
                volume24h: derivedPrice?.volume24h ?? 0,
              },
              _source: "derived",
            },
            { headers: corsHeaders },
          );
        }
      }

      // Fallback 2: Try DexScreener
      const dexscreenerPrice = await getPriceFromDexScreener(address);
      if (dexscreenerPrice !== null) {
        return json(
          {
            success: true,
            data: {
              address,
              value: dexscreenerPrice.price,
              updateUnixTime: Math.floor(Date.now() / 1000),
              priceChange24h: dexscreenerPrice.priceChange24h,
              volume24h: dexscreenerPrice?.volume24h ?? 0,
            },
            _source: "dexscreener",
          },
          { headers: corsHeaders },
        );
      }

      // Fallback 3: Try Jupiter
      const jupiterPrice = await getPriceFromJupiter(address);
      if (jupiterPrice !== null) {
        return json(
          {
            success: true,
            data: {
              address,
              value: jupiterPrice.price,
              updateUnixTime: Math.floor(Date.now() / 1000),
              priceChange24h: jupiterPrice?.priceChange24h ?? 0,
              volume24h: jupiterPrice?.volume24h ?? 0,
            },
            _source: "jupiter",
          },
          { headers: corsHeaders },
        );
      }

      // Fallback 4: Check hardcoded fallback prices
      if (tokenSymbol && FALLBACK_USD[tokenSymbol]) {
        console.log(
          `[Birdeye] Using hardcoded fallback price for ${tokenSymbol}: $${FALLBACK_USD[tokenSymbol]}`,
        );
        return json(
          {
            success: true,
            data: {
              address,
              value: FALLBACK_USD[tokenSymbol],
              updateUnixTime: Math.floor(Date.now() / 1000),
              priceChange24h: 0,
            },
            _source: "fallback",
          },
          { headers: corsHeaders },
        );
      }

      console.warn(`[Birdeye] No price available for ${address}`);
      return json(
        {
          success: false,
          error: "No price data available for this token",
        },
        { status: 404, headers: corsHeaders },
      );
    }

    // SOL price endpoint: /api/sol/price
    if (pathname === "/api/sol/price" && req.method === "GET") {
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      try {
        const dexUrl = `https://api.dexscreener.com/latest/dex/tokens/${SOL_MINT}`;
        const dexResp = await fetch(dexUrl, {
          headers: { Accept: "application/json" },
        });

        if (dexResp.ok) {
          const dexData = await dexResp.json();
          const pair =
            Array.isArray(dexData?.pairs) && dexData.pairs.length > 0
              ? dexData.pairs[0]
              : null;

          if (pair && pair.priceUsd) {
            const priceUsd = parseFloat(pair.priceUsd);
            if (isFinite(priceUsd) && priceUsd > 0) {
              return json(
                {
                  token: "SOL",
                  price: priceUsd,
                  priceUsd,
                  priceChange24h: pair.priceChange?.h24 || 0,
                  volume24h: pair.volume?.h24 || 0,
                  marketCap: pair.marketCap || 0,
                },
                { headers: corsHeaders },
              );
            }
          }
        }

        // Fallback to hardcoded price
        return json(
          {
            token: "SOL",
            price: 180,
            priceUsd: 180,
            priceChange24h: 0,
            volume24h: 0,
            marketCap: 0,
          },
          { headers: corsHeaders },
        );
      } catch (e: any) {
        console.error(`[SOL Price] Error:`, e?.message);
        return json(
          {
            token: "SOL",
            price: 180,
            priceUsd: 180,
            priceChange24h: 0,
            volume24h: 0,
            marketCap: 0,
          },
          { headers: corsHeaders },
        );
      }
    }

    // Dedicated token price endpoint: /api/token/price
    if (pathname === "/api/token/price" && req.method === "GET") {
      try {
        const tokenParam = (
          url.searchParams.get("token") ||
          url.searchParams.get("symbol") ||
          "FIXERCOIN"
        ).toUpperCase();
        const mintParam = url.searchParams.get("mint") || "";

        const TOKEN_MINTS: Record<string, string> = {
          SOL: "So11111111111111111111111111111111111111112",
          USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
          FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
          LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
        };

        const MINT_TO_PAIR_ADDRESS_EX: Record<string, string> = {
          H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump:
            "5CgLEWq9VJUEQ8my8UaxEovuSWArGoXCvaftpbX4RQMy",
        };

        const MINT_TO_SEARCH_SYMBOL: Record<string, string> = {
          H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: "FIXERCOIN",
          EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: "LOCKER",
        };

        const FALLBACK_USD: Record<string, number> = {
          FIXERCOIN: 0.000089,
          SOL: 180,
          USDC: 1.0,
          USDT: 1.0,
          LOCKER: 0.000012,
        };

        const PKR_PER_USD = 280; // base FX
        const MARKUP = 1.0425; // 4.25%

        // Determine token symbol and mint to query
        let token = tokenParam;
        let mint = mintParam || TOKEN_MINTS[token] || "";

        // If tokenParam looks like a mint (long base58), use it as mint and try to resolve symbol
        if (!mint && tokenParam && tokenParam.length > 40) {
          mint = tokenParam;
          const inv = Object.entries(TOKEN_MINTS).find(([, m]) => m === mint);
          if (inv) token = inv[0];
        }

        let priceUsd: number | null = null;
        let priceChange24h: number = 0;
        let volume24h: number = 0;

        // Stablecoins -> 1
        if (token === "USDC" || token === "USDT") {
          priceUsd = 1.0;
          priceChange24h = 0;
          volume24h = 0;
        } else if (token === "FIXERCOIN" || token === "LOCKER") {
          // Try to fetch derived price for FIXERCOIN and LOCKER
          const derivedPrice = await getDerivedPrice(mint);
          if (derivedPrice !== null && derivedPrice.price > 0) {
            priceUsd = derivedPrice.price;
            priceChange24h = derivedPrice.priceChange24h;
            volume24h = derivedPrice.volume24h;
          } else {
            priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
            priceChange24h = 0;
            volume24h = 0;
          }
        } else {
          // Use fallback prices for other non-stablecoins
          priceUsd = FALLBACK_USD[token] ?? FALLBACK_USD.FIXERCOIN;
          priceChange24h = 0;
          volume24h = 0;
        }

        const rateInPKR = priceUsd * PKR_PER_USD * MARKUP;
        return json(
          {
            token,
            priceUsd,
            priceInPKR: rateInPKR,
            rate: rateInPKR,
            pkrPerUsd: PKR_PER_USD,
            markup: MARKUP,
            priceChange24h,
            volume24h,
            source:
              token === "FIXERCOIN" || token === "LOCKER"
                ? "derived"
                : "fallback",
          },
          { headers: corsHeaders },
        );
      } catch (e: any) {
        return json(
          { error: "Failed to get token price", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun swap quote: /api/swap/quote: /api/swap/quote?mint=...
    if (pathname === "/api/swap/quote" && req.method === "GET") {
      const mint = url.searchParams.get("mint") || "";

      if (!mint) {
        return json(
          { error: "Missing 'mint' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(
          `https://pumpportal.fun/api/quote?mint=${encodeURIComponent(mint)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Pump.fun API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch swap quote", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun swap execution: /api/swap/execute (POST)
    if (pathname === "/api/swap/execute" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const {
          mint,
          amount,
          decimals,
          slippage,
          txVersion,
          priorityFee,
          wallet,
        } = body as any;

        if (!mint || !amount) {
          return json(
            { error: "Missing required fields: mint, amount" },
            { status: 400, headers: corsHeaders },
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const swapPayload = {
          mint,
          amount: String(amount),
          decimals: decimals || 6,
          slippage: slippage || 10,
          txVersion: txVersion || "V0",
          priorityFee: priorityFee || 0.0005,
          wallet: wallet,
        };

        const resp = await fetch("https://pumpportal.fun/api/trade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(swapPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text();
          return json(
            {
              error: `Pump.fun API returned ${resp.status}`,
              details: errorText,
            },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to execute swap",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Meteora swap quote: /api/swap/meteora/quote?inputMint=...&outputMint=...&amount=...
    if (pathname === "/api/swap/meteora/quote" && req.method === "GET") {
      const inputMint = url.searchParams.get("inputMint") || "";
      const outputMint = url.searchParams.get("outputMint") || "";
      const amount = url.searchParams.get("amount") || "";

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const meteoraUrl = new URL("https://api.meteora.ag/swap/v3/quote");
        meteoraUrl.searchParams.set("inputMint", inputMint);
        meteoraUrl.searchParams.set("outputMint", outputMint);
        meteoraUrl.searchParams.set("amount", amount);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(meteoraUrl.toString(), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Meteora API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch Meteora swap quote", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Meteora swap build: /api/swap/meteora/swap (POST) - builds unsigned/base64 transaction
    if (pathname === "/api/swap/meteora/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const resp = await fetch("https://api.meteora.ag/swap/v3/swap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          return json(
            { error: `Meteora swap build returned ${resp.status}`, details: t },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to build Meteora swap", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter swap quote: /api/swap/jupiter/quote?inputMint=...&outputMint=...&amount=...
    if (pathname === "/api/swap/jupiter/quote" && req.method === "GET") {
      const inputMint = url.searchParams.get("inputMint") || "";
      const outputMint = url.searchParams.get("outputMint") || "";
      const amount = url.searchParams.get("amount") || "";

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const jupiterUrl = new URL("https://quote-api.jup.ag/v6/quote");
        jupiterUrl.searchParams.set("inputMint", inputMint);
        jupiterUrl.searchParams.set("outputMint", outputMint);
        jupiterUrl.searchParams.set("amount", amount);
        jupiterUrl.searchParams.set("slippageBps", "500");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(jupiterUrl.toString(), {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Jupiter API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Jupiter swap quote",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter price: /api/jupiter/price?ids=...
    if (pathname === "/api/jupiter/price" && req.method === "GET") {
      const ids = searchParams.get("ids") || "";
      if (!ids) {
        return json(
          { error: "Missing 'ids' query parameter" },
          { status: 400, headers: corsHeaders },
        );
      }
      try {
        const url_str = `https://price.jup.ag/v4/price?ids=${encodeURIComponent(ids)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url_str, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
          return json(
            { error: "Jupiter API error" },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Jupiter prices",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter quote: /api/jupiter/quote?inputMint=...&outputMint=...&amount=...
    if (pathname === "/api/jupiter/quote" && req.method === "GET") {
      const inputMint = searchParams.get("inputMint") || "";
      const outputMint = searchParams.get("outputMint") || "";
      const amount = searchParams.get("amount") || "";
      const slippageBps = searchParams.get("slippageBps") || "50";

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      const endpoints = [
        `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`,
        `https://lite-api.jup.ag/swap/v1/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=${encodeURIComponent(slippageBps)}`,
      ];
      let lastError: any = null;

      for (const url_str of endpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);
          const resp = await fetch(url_str, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            lastError = `${resp.status} ${resp.statusText}`;
            continue;
          }
          const data = await resp.json();
          return json(data, { headers: corsHeaders });
        } catch (e: any) {
          lastError = e?.message || String(e);
        }
      }

      return json(
        {
          error: "Failed to fetch Jupiter quote",
          details: lastError,
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // Jupiter swap: /api/jupiter/swap (POST)
    if (pathname === "/api/jupiter/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          return json(
            { error: "Jupiter swap failed" },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to execute Jupiter swap",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter tokens: /api/jupiter/tokens?type=strict|all
    if (pathname === "/api/jupiter/tokens" && req.method === "GET") {
      const type = searchParams.get("type") || "strict";
      const endpoints = [
        `https://token.jup.ag/${type}`,
        `https://cache.jup.ag/tokens`,
      ];
      let lastError: any = null;

      for (const url_str of endpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000);
          const resp = await fetch(url_str, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            lastError = resp.status;
            continue;
          }
          const data = await resp.json();
          return json(data, { headers: corsHeaders });
        } catch (e: any) {
          lastError = e?.message || String(e);
        }
      }

      return json(
        {
          error: "Failed to fetch Jupiter tokens",
          details: lastError,
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // Pumpfun quote: /api/pumpfun/quote (POST or GET)
    if (pathname === "/api/pumpfun/quote") {
      if (req.method === "POST" || req.method === "GET") {
        let inputMint = "";
        let outputMint = "";
        let amount = "";

        if (req.method === "POST") {
          const body = await parseJSON(req);
          inputMint = body?.inputMint || "";
          outputMint = body?.outputMint || "";
          amount = body?.amount || "";
        } else {
          inputMint = searchParams.get("inputMint") || "";
          outputMint = searchParams.get("outputMint") || "";
          amount = searchParams.get("amount") || "";
        }

        if (!inputMint || !outputMint || !amount) {
          return json(
            {
              error:
                "Missing required parameters: inputMint, outputMint, amount",
            },
            { status: 400, headers: corsHeaders },
          );
        }

        try {
          const url_str = `https://api.pumpfun.com/api/v1/quote?input_mint=${encodeURIComponent(inputMint)}&output_mint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(url_str, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            return json(
              { error: "Pumpfun API error" },
              { status: resp.status, headers: corsHeaders },
            );
          }
          const data = await resp.json();
          return json(data, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            {
              error: "Failed to fetch Pumpfun quote",
              details: e?.message || String(e),
            },
            { status: 502, headers: corsHeaders },
          );
        }
      }
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders },
      );
    }

    // Pumpfun swap: /api/pumpfun/swap (POST)
    if (pathname === "/api/pumpfun/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const resp = await fetch("https://api.pumpfun.com/api/v1/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          return json(
            { error: "Pumpfun swap failed" },
            { status: resp.status, headers: corsHeaders },
          );
        }
        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to execute Pumpfun swap",
            details: e?.message || String(e),
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Forex rate proxy: /api/forex/rate?base=USD&symbols=PKR
    if (pathname === "/api/forex/rate" && req.method === "GET") {
      const base = (searchParams.get("base") || "USD").toUpperCase();
      const symbols = (searchParams.get("symbols") || "PKR").toUpperCase();
      const firstSymbol = symbols.split(",")[0];
      const providers: Array<{
        url: string;
        parse: (j: any) => number | null;
      }> = [
        {
          url: `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(firstSymbol)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          url: `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(firstSymbol)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          url: `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
          parse: (j) =>
            j && j.rates && typeof j.rates[firstSymbol] === "number"
              ? j.rates[firstSymbol]
              : null,
        },
        {
          url: `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${base.toLowerCase()}/${firstSymbol.toLowerCase()}.json`,
          parse: (j) =>
            j && typeof j[firstSymbol.toLowerCase()] === "number"
              ? j[firstSymbol.toLowerCase()]
              : null,
        },
      ];
      let lastErr = "";
      for (const p of providers) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          const resp = await fetch(p.url, { signal: controller.signal });
          clearTimeout(timeout);
          if (!resp.ok) {
            lastErr = `${resp.status} ${resp.statusText}`;
            continue;
          }
          const apiJson = await resp.json();
          const rate = p.parse(apiJson);
          if (typeof rate === "number" && isFinite(rate) && rate > 0) {
            return json(
              {
                base,
                symbols: [firstSymbol],
                rates: { [firstSymbol]: rate },
              },
              { headers: corsHeaders },
            );
          }
          lastErr = "invalid response";
        } catch (e: any) {
          lastErr = e?.message || String(e);
        }
      }
      return json(
        {
          error: "Failed to fetch forex rate",
          details: lastErr,
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // Stablecoin 24h change: /api/stable-24h?symbols=USDC,USDT
    if (pathname === "/api/stable-24h" && req.method === "GET") {
      const symbolsParam = (
        searchParams.get("symbols") || "USDC,USDT"
      ).toUpperCase();
      const symbols = Array.from(
        new Set(
          String(symbolsParam)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      );

      const COINGECKO_IDS: Record<string, { id: string; mint: string }> = {
        SOL: {
          id: "solana",
          mint: "So11111111111111111111111111111111111111112",
        },
        USDC: {
          id: "usd-coin",
          mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        },
        USDT: {
          id: "tether",
          mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
        },
      };

      const ids = symbols
        .map((s) => COINGECKO_IDS[s]?.id)
        .filter(Boolean)
        .join(",");
      if (!ids) {
        return json(
          { error: "No supported symbols provided" },
          { status: 400, headers: corsHeaders },
        );
      }

      const url_str = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;
      let result: Record<
        string,
        { priceUsd: number; change24h: number; mint: string }
      > = {};
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const resp = await fetch(url_str, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const apiJson = await resp.json();
          symbols.forEach((sym) => {
            const meta = COINGECKO_IDS[sym];
            if (!meta) return;
            const d = apiJson?.[meta.id];
            const price = typeof d?.usd === "number" ? d.usd : 1;
            const change =
              typeof d?.usd_24h_change === "number" ? d.usd_24h_change : 0;
            result[sym] = {
              priceUsd: price,
              change24h: change,
              mint: meta.mint,
            };
          });
        } else {
          symbols.forEach((sym) => {
            const meta = COINGECKO_IDS[sym];
            if (!meta) return;
            result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
          });
        }
      } catch {
        symbols.forEach((sym) => {
          const meta = COINGECKO_IDS[sym];
          if (!meta) return;
          result[sym] = { priceUsd: 1, change24h: 0, mint: meta.mint };
        });
      }

      return json({ data: result }, { headers: corsHeaders });
    }

    // Get transaction details: /api/transaction?signature=...
    if (pathname === "/api/transaction" && req.method === "GET") {
      const signature = searchParams.get("signature") || "";

      if (!signature) {
        return json(
          { error: "Missing 'signature' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const rpcUrl = "https://api.mainnet-beta.solana.com";
        const payload = {
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            signature,
            { encoding: "json", maxSupportedTransactionVersion: 0 },
          ],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await resp.json();
        return json(data, { status: resp.status, headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch transaction", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Get account information: /api/account?publicKey=...
    if (pathname === "/api/account" && req.method === "GET") {
      const publicKey = searchParams.get("publicKey") || "";

      if (!publicKey) {
        return json(
          { error: "Missing 'publicKey' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const rpcUrl = "https://api.mainnet-beta.solana.com";
        const payload = {
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [publicKey, { encoding: "jsonParsed" }],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await resp.json();
        return json(data, { status: resp.status, headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch account", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Unified quote endpoint: /api/quote?inputMint=...&outputMint=...&amount=...
    // Tries multiple DEX providers in order (Jupiter -> Meteora -> DexScreener)
    if (pathname === "/api/quote" && req.method === "GET") {
      const inputMint = searchParams.get("inputMint") || "";
      const outputMint = searchParams.get("outputMint") || "";
      const amount = searchParams.get("amount") || "";
      const provider = (searchParams.get("provider") || "auto").toLowerCase();

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      const providers = [
        {
          name: "jupiter",
          url: `https://quote-api.jup.ag/v6/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}&slippageBps=500`,
        },
        {
          name: "meteora",
          url: `https://api.meteora.ag/swap/v3/quote?inputMint=${encodeURIComponent(inputMint)}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(amount)}`,
        },
        {
          name: "dexscreener",
          url: `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(inputMint)}`,
        },
      ];

      let lastErrors: string[] = [];

      for (const p of providers) {
        if (provider !== "auto" && provider !== p.name) continue;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const resp = await fetch(p.url, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (resp.ok) {
            const data = await resp.json();

            // For DexScreener, transform the response to match quote format
            if (p.name === "dexscreener" && data.pairs) {
              const pair = data.pairs.find(
                (p: any) => p.baseToken?.address === inputMint && p.priceUsd,
              );
              if (pair) {
                return json(
                  {
                    source: "dexscreener",
                    quote: {
                      inAmount: amount,
                      outAmount: pair.priceUsd,
                      priceImpact: 0,
                    },
                  },
                  { headers: corsHeaders },
                );
              }
            } else if (p.name !== "dexscreener") {
              return json(
                { source: p.name, quote: data },
                { headers: corsHeaders },
              );
            }
          }

          lastErrors.push(`${p.name}: ${resp.status}`);
        } catch (e: any) {
          lastErrors.push(`${p.name}: ${e?.message || String(e)}`);
        }
      }

      console.warn(`[/api/quote] All providers failed:`, lastErrors);

      return json(
        {
          error: "Failed to fetch quote from any provider",
          details: lastErrors.join(" | ") || "All providers failed",
          providers_attempted: ["jupiter", "meteora", "dexscreener"],
        },
        { status: 502, headers: corsHeaders },
      );
    }

    // Unified swap execution endpoint: /api/swap (POST)
    // Handles swap execution for multiple DEX providers
    if (pathname === "/api/swap" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            {
              error: "Invalid request body",
              message: "POST body must be valid JSON",
            },
            { status: 400, headers: corsHeaders },
          );
        }

        const provider = (body.provider || "auto").toLowerCase();
        const { inputMint, outputMint, amount, mint, wallet, routePlan } =
          body as any;

        console.log(
          `[/api/swap] Request - provider: ${provider}, mint: ${mint}, inputMint: ${inputMint}, amount: ${amount}`,
        );

        // Try Jupiter swap if inputMint is provided (Jupiter specific)
        if (
          (provider === "jupiter" || provider === "auto") &&
          inputMint &&
          routePlan
        ) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const resp = await fetch("https://quote-api.jup.ag/v6/swap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (resp.ok) {
              const data = await resp.json();
              return json(
                { source: "jupiter", swap: data },
                { headers: corsHeaders },
              );
            } else {
              console.warn(`[/api/swap] Jupiter swap returned ${resp.status}`);
            }
          } catch (e: any) {
            console.warn(`[/api/swap] Jupiter swap error:`, e?.message);
            if (provider === "jupiter") {
              return json(
                {
                  error: "Jupiter swap failed",
                  details: e?.message,
                  hint: "Ensure routePlan is provided from the quote endpoint",
                },
                { status: 502, headers: corsHeaders },
              );
            }
          }
        }

        // Try Pumpfun swap if mint is provided (Pumpfun specific)
        if ((provider === "pumpfun" || provider === "auto") && mint && amount) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const swapPayload = {
              mint,
              amount: String(amount),
              decimals: body.decimals || 6,
              slippage: body.slippage || 10,
              txVersion: body.txVersion || "V0",
              priorityFee: body.priorityFee || 0.0005,
              wallet,
            };

            const resp = await fetch("https://api.pumpfun.com/api/v1/swap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(swapPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (resp.ok) {
              const data = await resp.json();
              return json(
                { source: "pumpfun", swap: data },
                { headers: corsHeaders },
              );
            } else {
              console.warn(`[/api/swap] Pumpfun swap returned ${resp.status}`);
            }
          } catch (e: any) {
            console.warn(`[/api/swap] Pumpfun swap error:`, e?.message);
            if (provider === "pumpfun") {
              return json(
                { error: "Pumpfun swap failed", details: e?.message },
                { status: 502, headers: corsHeaders },
              );
            }
          }
        }

        // Provide helpful error message with examples
        const hasInputMint = !!inputMint;
        const hasMint = !!mint;
        const hasAmount = !!amount;

        let helpText = "Missing required fields for swap. ";
        if (hasInputMint) {
          helpText +=
            "For Jupiter swaps, you need: inputMint, outputMint, amount, and routePlan (from /api/quote). ";
        }
        if (hasMint) {
          helpText +=
            "For Pumpfun swaps, you need: mint, amount, wallet, and optionally decimals, slippage. ";
        }
        if (!hasInputMint && !hasMint) {
          helpText +=
            "Provide either mint (for Pumpfun) or inputMint + outputMint (for Jupiter). ";
        }

        return json(
          {
            error: "Unable to execute swap - missing required fields",
            message: helpText,
            supported_providers: {
              jupiter: {
                required: ["inputMint", "amount", "routePlan"],
                optional: ["wallet", "slippageBps"],
              },
              pumpfun: {
                required: ["mint", "amount"],
                optional: [
                  "wallet",
                  "decimals",
                  "slippage",
                  "txVersion",
                  "priorityFee",
                ],
              },
            },
            received: {
              provider,
              has_inputMint: hasInputMint,
              has_mint: hasMint,
              has_amount: hasAmount,
              has_routePlan: !!routePlan,
            },
          },
          { status: 400, headers: corsHeaders },
        );
      } catch (e: any) {
        return json(
          {
            error: "Failed to execute swap",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // 404 for unknown routes
    return json(
      { error: "API endpoint not found", path: pathname },
      { status: 404, headers: corsHeaders },
    );
  },
};
