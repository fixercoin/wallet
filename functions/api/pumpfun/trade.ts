export const onRequest: PagesFunction = async ({ request, env }) => {
  const body = await request.json();
  const res = await fetch(env.PUMPFUN_TRADE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return new Response(text, { headers: { "Content-Type": "application/json" } });
};
