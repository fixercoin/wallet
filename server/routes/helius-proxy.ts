export async function handleHelius(req: Request): Promise<Response> {
  const api = "https://api.helius.xyz/v0/addresses";
  const url = new URL(req.url);
  const target = `${api}${url.pathname}${url.search}`;

  const res = await fetch(target, { headers: { "Content-Type": "application/json" } });
  const data = await res.text();
  return new Response(data, { headers: { "Content-Type": "application/json" } });
}
