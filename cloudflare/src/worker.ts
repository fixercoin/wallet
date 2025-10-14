import { DurableRoom } from "./durable_room";
import { json, parseJSON, requireAdmin } from "./utils";

export interface Env {
  ROOM: DurableObjectNamespace;
  ADMIN_TOKEN: string; // set via wrangler secret put ADMIN_TOKEN
  ALLOWED_PAYMENT: string; // e.g. "easypaisa"
}

function getRoomStub(env: Env, roomId: string) {
  const id = env.ROOM.idFromName(roomId);
  return env.ROOM.get(id);
}

export default {
  async fetch(
    req: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;

    // CORS for browser fetch; restrict to same origin by default
    const corsHeaders = {
      "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    } as const;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Healthcheck
    if (pathname === "/" || pathname === "/api/health") {
      return json({ ok: true, ts: Date.now() }, { headers: corsHeaders });
    }

    // WebSocket upgrade: /ws/:roomId
    const wsMatch = pathname.match(/^\/ws\/(.+)$/);
    if (req.method === "GET" && wsMatch) {
      const roomId = decodeURIComponent(wsMatch[1]);
      const stub = getRoomStub(env, roomId);
      return stub.fetch(
        new Request(`https://do/ws?${searchParams.toString()}`, req),
      );
    }

    // Orders collection (admin create, anyone list)
    if (pathname === "/api/orders") {
      if (req.method === "GET") {
        const roomId = searchParams.get("roomId") ?? "global";
        const stub = getRoomStub(env, roomId);
        return stub.fetch(new Request("https://do/orders", req));
      }
      if (req.method === "POST") {
        await requireAdmin(req, env);
        const body = await parseJSON(req);
        if (!body || typeof body !== "object")
          return json({ error: "Invalid body" }, { status: 400 });
        if (
          String(body.paymentMethod).toLowerCase() !==
          String(env.ALLOWED_PAYMENT || "easypaisa")
        ) {
          return json(
            { error: `Only ${env.ALLOWED_PAYMENT || "easypaisa"} is allowed` },
            { status: 400 },
          );
        }
        const roomId = String(body.roomId || "global");
        const stub = getRoomStub(env, roomId);
        return stub.fetch(
          new Request("https://do/orders", {
            method: "POST",
            headers: req.headers,
            body: JSON.stringify(body),
          }),
        );
      }
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Order item routes: /api/orders/:id
    const orderIdMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (orderIdMatch) {
      const id = decodeURIComponent(orderIdMatch[1]);
      if (req.method === "GET") {
        const roomId = searchParams.get("roomId") ?? "global";
        const stub = getRoomStub(env, roomId);
        return stub.fetch(new Request(`https://do/orders/${id}`, req));
      }
      if (req.method === "PUT") {
        await requireAdmin(req, env);
        const roomId = searchParams.get("roomId") ?? "global";
        const stub = getRoomStub(env, roomId);
        const body = await parseJSON(req);
        return stub.fetch(
          new Request(`https://do/orders/${id}`, {
            method: "PUT",
            headers: req.headers,
            body: JSON.stringify(body || {}),
          }),
        );
      }
      if (req.method === "DELETE") {
        await requireAdmin(req, env);
        const roomId = searchParams.get("roomId") ?? "global";
        const stub = getRoomStub(env, roomId);
        return stub.fetch(
          new Request(`https://do/orders/${id}`, {
            method: "DELETE",
            headers: req.headers,
          }),
        );
      }
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Room-scoped REST helpers proxied to DO
    const roomMatch = pathname.match(/^\/api\/rooms\/(.+)/);
    if (roomMatch) {
      const roomId = decodeURIComponent(roomMatch[1]);
      const stub = getRoomStub(env, roomId);
      return stub.fetch(new Request("https://do" + pathname, req));
    }

    return json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },
};

export { DurableRoom };
