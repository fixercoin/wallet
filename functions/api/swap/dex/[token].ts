export const onRequest: PagesFunction = async ({ params, env }) => {
  const token = params.token;
  if (!token) return Response.json({ error: "token required" }, { status: 400 });

  try {
    const res = await fetch(`${env.DEXSCREENER}/${token}`);
    const json = await res.json();
    return Response.json(json);
  } catch (e: any) {
    return Response.json({ error: "dexscreener_error", details: String(e?.message || e) }, { status: 502 });
  }
};
