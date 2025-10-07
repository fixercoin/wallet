export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address");

  if (!address) {
    return new Response(
      JSON.stringify({ error: "Missing wallet address" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Example mock logic (replace with your blockchain call)
  const balance = Math.floor(Math.random() * 10000) / 100;
  return new Response(JSON.stringify({ address, balance }), {
    headers: { "Content-Type": "application/json" },
  });
}
