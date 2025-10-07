// Netlify Functions entry to handle /api/* routes
// Currently implements /api/solana-rpc for wallet balances & SPL token accounts

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
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
      return { ok: true, body: data };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(lastError?.message || "All RPC endpoints failed");
}

function jsonResponse(
  statusCode: number,
  body: any,
  headers: Record<string, string> = {},
) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  } as const;
}

export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, "");
  }

  const path =
    (event.path || "").replace(/^\/.netlify\/functions\/api/, "") || "/";

  try {
    if (path === "/solana-rpc" && event.httpMethod === "POST") {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {}

      const method = body?.method;
      const params = body?.params ?? [];
      const id = body?.id ?? Date.now();

      if (!method || typeof method !== "string") {
        return jsonResponse(400, { error: "Missing RPC method" });
      }

      const result = await callRpc(method, params, id);
      return jsonResponse(200, result.body);
    }

    // Unknown API route
    return jsonResponse(404, { error: `No handler for ${path}` });
  } catch (error) {
    return jsonResponse(502, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
