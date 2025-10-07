export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // ✅ Use your private Alchemy endpoint here
    const ALCHEMY_RPC = "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX";

    const response = await fetch(ALCHEMY_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.text();
    return new Response(data, {
      headers: { "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
