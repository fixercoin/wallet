import { DurableRoom } from "./durable_room";
import { json, parseJSON, requireAdmin } from "./utils";
import { ensureSchema, createLock, listLocks, getLock, listEvents, withdrawFromLock } from "./locks";

export interface Env {
  ROOM: DurableObjectNamespace;
  ADMIN_TOKEN: string; // set via wrangler secret put ADMIN_TOKEN
  ALLOWED_PAYMENT: string; // e.g. "easypaisa"
  DB: D1Database; // Cloudflare D1 binding for locks/events
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

    // Locks API (Cloudflare D1)
    if (pathname === "/api/locks") {
      await ensureSchema(env.DB);
      if (req.method === "GET") {
        const wallet = searchParams.get("wallet") || undefined;
        const token_mint = searchParams.get("token_mint") || undefined;
        const status = (searchParams.get("status") as any) || undefined;
        const locks = await listLocks(env.DB, { wallet, token_mint, status });
        return json({ locks }, { headers: corsHeaders });
      }
      if (req.method === "POST") {
        const body = await parseJSON(req);
        if (!body || typeof body !== "object")
          return json({ error: "Invalid body" }, { status: 400, headers: corsHeaders });
        try {
          const lock = await createLock(env.DB, {
            id: body.id,
            wallet: String(body.wallet),
            token_mint: String(body.tokenMint || body.token_mint),
            amount_total: String(body.amount || body.amount_total),
            decimals: typeof body.decimals === "number" ? body.decimals : undefined,
            tx_signature: body.txSignature || body.tx_signature,
            network: body.network || "solana",
            note: body.note,
          });
          return json(lock, { status: 201, headers: corsHeaders });
        } catch (e: any) {
          return json({ error: e?.message || "Failed to create lock" }, { status: 400, headers: corsHeaders });
        }
      }
      return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    const lockMatch = pathname.match(/^\/api\/locks\/([^\/]+)(?:\/(events|withdraw))?$/);
    if (lockMatch) {
      await ensureSchema(env.DB);
      const lockId = decodeURIComponent(lockMatch[1]);
      const action = lockMatch[2];
      if (!action && req.method === "GET") {
        try {
          const lock = await getLock(env.DB, lockId);
          return json(lock, { headers: corsHeaders });
        } catch (e: any) {
          return json({ error: "Not found" }, { status: 404, headers: corsHeaders });
        }
      }
      if (action === "events" && req.method === "GET") {
        const events = await listEvents(env.DB, lockId);
        return json({ events }, { headers: corsHeaders });
      }
      if (action === "withdraw" && req.method === "POST") {
        const body = await parseJSON(req);
        if (!body || typeof body !== "object")
          return json({ error: "Invalid body" }, { status: 400, headers: corsHeaders });
        try {
          const updated = await withdrawFromLock(env.DB, lockId, {
            amount: String(body.amount),
            tx_signature: body.txSignature || body.tx_signature,
            note: body.note,
          });
          return json(updated, { headers: corsHeaders });
        } catch (e: any) {
          return json({ error: e?.message || "Failed to withdraw" }, { status: 400, headers: corsHeaders });
        }
      }
      return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
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
