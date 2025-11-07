export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const rpc = "https://api.mainnet-beta.solana.com";

    const response = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return new Response(await response.text(), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
