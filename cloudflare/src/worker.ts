import { DurableRoom } from "./durable_room";
import { json, parseJSON, requireAdmin } from "./utils";
import {
  ensureSchema,
  createLock,
  listLocks,
  getLock,
  listEvents,
  withdrawFromLock,
} from "./locks";
import {
  ensureP2PSchema,
  createP2POrder,
  getP2POrder,
  listP2POrders,
  updateP2POrder,
  deleteP2POrder,
  createTradeRoom,
  getTradeRoom,
  listTradeRooms,
  updateTradeRoom,
  addTradeMessage,
  listTradeMessages,
} from "./p2p-orders";

export interface Env {
  ROOM: DurableObjectNamespace;
  ADMIN_TOKEN: string; // set via wrangler secret put ADMIN_TOKEN
  ALLOWED_PAYMENT: string; // e.g. "easypaisa"
  DB: D1Database; // Cloudflare D1 binding for locks/events and P2P
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
          return json(
            { error: "Invalid body" },
            { status: 400, headers: corsHeaders },
          );
        try {
          const lock = await createLock(env.DB, {
            id: body.id,
            wallet: String(body.wallet),
            token_mint: String(body.tokenMint || body.token_mint),
            amount_total: String(body.amount || body.amount_total),
            decimals:
              typeof body.decimals === "number" ? body.decimals : undefined,
            tx_signature: body.txSignature || body.tx_signature,
            network: body.network || "solana",
            note: body.note,
          });
          return json(lock, { status: 201, headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to create lock" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders },
      );
    }

    const lockMatch = pathname.match(
      /^\/api\/locks\/([^\/]+)(?:\/(events|withdraw))?$/,
    );
    if (lockMatch) {
      await ensureSchema(env.DB);
      const lockId = decodeURIComponent(lockMatch[1]);
      const action = lockMatch[2];
      if (!action && req.method === "GET") {
        try {
          const lock = await getLock(env.DB, lockId);
          return json(lock, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: "Not found" },
            { status: 404, headers: corsHeaders },
          );
        }
      }
      if (action === "events" && req.method === "GET") {
        const events = await listEvents(env.DB, lockId);
        return json({ events }, { headers: corsHeaders });
      }
      if (action === "withdraw" && req.method === "POST") {
        const body = await parseJSON(req);
        if (!body || typeof body !== "object")
          return json(
            { error: "Invalid body" },
            { status: 400, headers: corsHeaders },
          );
        try {
          const updated = await withdrawFromLock(env.DB, lockId, {
            amount: String(body.amount),
            tx_signature: body.txSignature || body.tx_signature,
            note: body.note,
          });
          return json(updated, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to withdraw" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders },
      );
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

    // P2P Orders API (using D1)
    if (pathname === "/api/p2p/orders") {
      await ensureP2PSchema(env.DB);
      if (req.method === "GET") {
        try {
          const type = searchParams.get("type") as any;
          const status = searchParams.get("status") as any;
          const token = searchParams.get("token") as any;
          const online = searchParams.get("online") === "true" ? true : undefined;

          const orders = await listP2POrders(env.DB, { type, status, token, online });
          return json({ orders }, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to list orders" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
      if (req.method === "POST") {
        try {
          const body = await parseJSON(req);
          if (!body || typeof body !== "object")
            return json({ error: "Invalid body" }, { status: 400, headers: corsHeaders });

          const order = await createP2POrder(env.DB, {
            type: body.type,
            creator_wallet: body.creator_wallet,
            token: body.token,
            token_amount: String(body.token_amount),
            pkr_amount: Number(body.pkr_amount),
            payment_method: body.payment_method,
            status: "active",
            online: Boolean(body.online),
            account_name: body.account_name,
            account_number: body.account_number,
            wallet_address: body.wallet_address,
          });
          return json(order, { status: 201, headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to create order" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
      return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    // Single P2P Order routes
    const p2pOrderMatch = pathname.match(/^\/api\/p2p\/orders\/([^/]+)$/);
    if (p2pOrderMatch) {
      await ensureP2PSchema(env.DB);
      const orderId = decodeURIComponent(p2pOrderMatch[1]);

      if (req.method === "GET") {
        try {
          const order = await getP2POrder(env.DB, orderId);
          return json({ order }, { headers: corsHeaders });
        } catch (e: any) {
          return json({ error: "Order not found" }, { status: 404, headers: corsHeaders });
        }
      }
      if (req.method === "PUT") {
        try {
          const body = await parseJSON(req);
          const order = await updateP2POrder(env.DB, orderId, body || {});
          return json({ order }, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to update order" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
      if (req.method === "DELETE") {
        try {
          await deleteP2POrder(env.DB, orderId);
          return json({ ok: true }, { headers: corsHeaders });
        } catch (e: any) {
          return json({ error: "Order not found" }, { status: 404, headers: corsHeaders });
        }
      }
      return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    // Trade Rooms API
    if (pathname === "/api/p2p/rooms") {
      await ensureP2PSchema(env.DB);
      if (req.method === "GET") {
        try {
          const wallet = searchParams.get("wallet");
          const rooms = await listTradeRooms(env.DB, wallet || undefined);
          return json({ rooms }, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to list rooms" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
      if (req.method === "POST") {
        try {
          const body = await parseJSON(req);
          const room = await createTradeRoom(env.DB, {
            buyer_wallet: body.buyer_wallet,
            seller_wallet: body.seller_wallet,
            order_id: body.order_id,
            status: "pending",
          });
          return json({ room }, { status: 201, headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to create room" },
            { status: 400, headers: corsHeaders },
          );
        }
      }
      return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    // Single Trade Room routes
    const roomMatch = pathname.match(/^\/api\/p2p\/rooms\/([^/]+)(?:\/(messages|status))?$/);
    if (roomMatch) {
      await ensureP2PSchema(env.DB);
      const roomId = decodeURIComponent(roomMatch[1]);
      const action = roomMatch[2];

      if (!action && req.method === "GET") {
        try {
          const room = await getTradeRoom(env.DB, roomId);
          return json({ room }, { headers: corsHeaders });
        } catch (e: any) {
          return json({ error: "Room not found" }, { status: 404, headers: corsHeaders });
        }
      }

      if (!action && req.method === "PUT") {
        try {
          const body = await parseJSON(req);
          const room = await updateTradeRoom(env.DB, roomId, body.status);
          return json({ room }, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to update room" },
            { status: 400, headers: corsHeaders },
          );
        }
      }

      if (action === "messages" && req.method === "GET") {
        try {
          const messages = await listTradeMessages(env.DB, roomId);
          return json({ messages }, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to list messages" },
            { status: 400, headers: corsHeaders },
          );
        }
      }

      if (action === "messages" && req.method === "POST") {
        try {
          const body = await parseJSON(req);
          const message = await addTradeMessage(env.DB, {
            room_id: roomId,
            sender_wallet: body.sender_wallet,
            message: body.message,
            attachment_url: body.attachment_url,
          });
          return json({ message }, { status: 201, headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: e?.message || "Failed to add message" },
            { status: 400, headers: corsHeaders },
          );
        }
      }

      return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
    }

    // Legacy Orders collection (Durable Objects - for backwards compatibility)
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

    // Legacy Order item routes
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
