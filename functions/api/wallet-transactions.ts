export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet");

  if (!wallet)
    return new Response(JSON.stringify({ error: "Missing wallet address" }), {
      status: 400,
    });

  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getSignaturesForAddress",
    params: [wallet, { limit: 10 }],
  };

  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
