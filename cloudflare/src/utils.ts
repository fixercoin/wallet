export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type"))
    headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function parseJSON(req: Request): Promise<any> {
  const text = await req.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function requireAdmin(
  req: Request,
  env: { ADMIN_TOKEN: string },
): Promise<void> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
}
