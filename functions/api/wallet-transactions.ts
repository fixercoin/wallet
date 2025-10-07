export async function onRequestPost({ request }) {
  try {
    const { walletAddress, limit = 10 } = await request.json();

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [walletAddress, { limit }],
    };

    const response = await fetch(
      "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcBody),
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch transactions", details: err.message }),
      { status: 500 }
    );
  }
}
