export async function onRequestGet() {
  return new Response(JSON.stringify({ status: "ok", message: "pong" }), {
    headers: { "Content-Type": "application/json" },
  });
}
