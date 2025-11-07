import type { Handler } from "@netlify/functions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
  "https://solana-rpc.publicnode.com",
];

async function callRpc(
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

  for (const endpoint of RPC_ENDPOINTS) {
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

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Method not allowed. Use GET.",
      }),
    };
  }

  try {
    const pk = (
      event.queryStringParameters?.publicKey ||
      event.queryStringParameters?.wallet ||
      event.queryStringParameters?.address ||
      ""
    ).trim();

    if (!pk) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Missing 'publicKey' parameter",
        }),
      };
    }

    const rpc = await callRpc("getBalance", [pk], Date.now());
    const j = JSON.parse(String(rpc?.body || "{}"));
    const lamports =
      typeof j.result === "number" ? j.result : (j?.result?.value ?? null);

    if (typeof lamports === "number" && isFinite(lamports)) {
      const balance = lamports / 1_000_000_000;
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          publicKey: pk,
          balance,
          balanceLamports: lamports,
        }),
      };
    }

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Invalid RPC response",
      }),
    };
  } catch (error: any) {
    console.error("Wallet BALANCE endpoint error:", error);

    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to fetch balance",
        details: error?.message || String(error),
      }),
    };
  }
};
