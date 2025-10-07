export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const wallet = url.searchParams.get("wallet");
    if (!wallet)
      return new Response(JSON.stringify({ error: "Missing wallet address" }), { status: 400 });

    const rpcUrl = "https://api.mainnet-beta.solana.com";
    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [wallet, { limit: 20 }],
    };

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
