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

function parseRequestBody(event: any): any {
  try {
    let body = event.body;

    if (!body) {
      return {};
    }

    if (event.isBase64Encoded && typeof body === "string") {
      try {
        if (typeof Buffer !== "undefined") {
          body = Buffer.from(body, "base64").toString("utf8");
        } else {
          body = atob(body);
        }
      } catch (decodeError) {
        console.warn("[Netlify] Base64 decode failed, treating as plain text");
      }
    }

    if (typeof body === "string" && body.trim()) {
      return JSON.parse(body);
    }

    return {};
  } catch (e) {
    console.error("[Netlify] Failed to parse request body:", e);
    return null;
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Method not allowed. Use POST.",
      }),
    };
  }

  const body = parseRequestBody(event);
  if (body === null) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Invalid JSON in request body",
      }),
    };
  }

  const methodName = body?.method;
  const params = body?.params ?? [];
  const id = body?.id ?? Date.now();

  if (!methodName || typeof methodName !== "string") {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Missing RPC method",
      }),
    };
  }

  try {
    const result = await callRpc(methodName, params, id);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: result.body,
    };
  } catch (e: any) {
    console.error("[Solana RPC] Handler error:", e);
    return {
      statusCode: 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to call Solana RPC",
        details: e?.message || String(e),
        method: methodName,
      }),
    };
  }
};
