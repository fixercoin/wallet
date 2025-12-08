const RPC_ENDPOINTS = [
  // Prefer environment-configured Helius RPC
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : null,
  process.env.SOLANA_RPC_URL,
  process.env.HELIUS_RPC_URL,
  // Public fallbacks (in order of reliability)
  "https://solana.publicnode.com",
  "https://api.solflare.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
  "https://api.marinade.finance/rpc",
].filter(Boolean) as string[];

function cors(h: Headers = new Headers()) {
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Content-Type", "application/json");
  return h;
}

export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: cors(),
    });
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: cors(),
      });
    }

    const transaction: string | undefined =
      body?.transaction || body?.signedBase64 || body?.signedTx || body?.tx;

    if (!transaction || typeof transaction !== "string") {
      return new Response(
        JSON.stringify({
          error: "Missing signed transaction (base64)",
          expected: ["transaction", "signedBase64", "signedTx", "tx"],
        }),
        { status: 400, headers: cors() },
      );
    }

    const makePayloads = (tx: string) => [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "sendRawTransaction",
        params: [
          tx,
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            encoding: "base64",
          },
        ],
      },
      {
        jsonrpc: "2.0",
        id: 1,
        method: "sendTransaction",
        params: [
          tx,
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            encoding: "base64",
          },
        ],
      },
    ];

    const payloads = makePayloads(transaction);

    let lastError = "";

    for (const endpoint of RPC_ENDPOINTS) {
      for (const rpcBody of payloads) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rpcBody),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const text = await response.text();
          let data: any = {};
          try {
            data = JSON.parse(text);
          } catch {
            data = { raw: text };
          }

          if (data && data.result) {
            return new Response(
              JSON.stringify({
                success: true,
                signature: data.result,
                timestamp: Date.now(),
              }),
              { status: 200, headers: cors() },
            );
          }

          if (data && data.error) {
            const msg = String(data.error.message || "RPC error");
            lastError = msg;
            if (
              response.status === 429 ||
              response.status >= 500 ||
              /limit|rate/i.test(msg)
            ) {
              break; // try next endpoint
            }
            continue; // try next payload style
          }

          lastError = `Unexpected response from ${endpoint}`;
        } catch (error: any) {
          lastError =
            error?.name === "AbortError"
              ? "timeout"
              : error?.message || String(error);
          break; // try next endpoint on network error
        }
      }
    }

    return new Response(
      JSON.stringify({
        error: "Failed to send transaction",
        details: lastError || "All RPC endpoints failed",
      }),
      { status: 502, headers: cors() },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Solana send error",
        details: error?.message || String(error),
      }),
      { status: 502, headers: cors() },
    );
  }
};
