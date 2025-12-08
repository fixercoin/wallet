export const config = {
  runtime: "nodejs_esmsh",
};

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solflare.network",
  "https://solana-api.projectserum.com",
  "https://api.mainnet.solflare.com",
  "https://solana.publicnode.com",
  "https://solana-mainnet.g.alchemy.com/v2/T79j33bZKpxgKTLx-KDW5",
];

async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const url = new URL(request.url);
    const publicKey =
      url.searchParams.get("publicKey") ||
      url.searchParams.get("address") ||
      url.searchParams.get("wallet") ||
      url.searchParams.get("walletAddress");

    if (!publicKey) {
      return new Response(
        JSON.stringify({ error: "Missing 'publicKey' or 'address' parameter" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [
        publicKey,
        {
          programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        },
        {
          encoding: "jsonParsed",
        },
      ],
    };

    let lastError = "";

    // Try each RPC endpoint
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rpcBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.error) {
          lastError = data.error.message || "RPC error";
          continue;
        }

        const result = data.result || { value: [] };
        const tokens = result.value
          .map((item: any) => {
            const accountData = item.account?.data?.parsed?.info;
            if (!accountData) return null;

            return {
              mint: accountData.mint,
              address: item.pubkey,
              owner: accountData.owner,
              amount: accountData.tokenAmount?.amount || "0",
              decimals: accountData.tokenAmount?.decimals || 0,
              isNative: false,
            };
          })
          .filter(Boolean);

        return new Response(
          JSON.stringify({
            publicKey,
            tokens,
            total: tokens.length,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      } catch (error: any) {
        lastError =
          error?.name === "AbortError"
            ? "timeout"
            : error?.message || String(error);
      }
    }

    return new Response(
      JSON.stringify({
        error: "Failed to fetch wallet tokens",
        details: lastError || "All RPC endpoints failed",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Wallet tokens error",
        details: error?.message || String(error),
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export const onRequest = async ({ request }: { request: Request }) =>
  handler(request);
