export interface Env {}

export interface Order {
  id: string;
  side: "buy" | "sell";
  amountPKR: number;
  quoteAsset: string; // e.g., USDT
  pricePKRPerQuote: number;
  paymentMethod: string; // only easypaisa
  createdAt: number;
  createdBy: string;
  accountName?: string;
  accountNumber?: string;
}

interface AdminStatus {
  buyOnline: boolean;
  sellOnline: boolean;
}

type Client = { ws: WebSocket; id: string };

export class DurableRoom implements DurableObject {
  private state: DurableObjectState;
  private clients = new Map<string, Client>();

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const savedOrders =
        (await this.state.storage.get<Order[]>("orders")) || [];
      await this.state.storage.put("orders", savedOrders);
      const savedStatus =
        (await this.state.storage.get<AdminStatus>("admin_status")) ||
        ({ buyOnline: false, sellOnline: false } as AdminStatus);
      await this.state.storage.put("admin_status", savedStatus);
    });
  }

  private async broadcast(kind: string, data: unknown) {
    const payload = JSON.stringify({ kind, data, ts: Date.now() });
    for (const client of this.clients.values()) {
      try {
        client.ws.send(payload);
      } catch {}
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/ws")) {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      // Accept connection
      server.accept();
      const cid = crypto.randomUUID();
      this.clients.set(cid, { ws: server, id: cid });

      server.addEventListener("message", async (evt) => {
        try {
          const msg = JSON.parse(
            typeof evt.data === "string" ? evt.data : String(evt.data),
          );
          if (msg?.type === "chat") {
            let text = String(msg.text || "");
            try {
              const inner = JSON.parse(text);
              if (inner && inner.type === "admin_status") {
                const prev =
                  (await this.state.storage.get<AdminStatus>("admin_status")) ||
                  ({ buyOnline: false, sellOnline: false } as AdminStatus);
                const next: AdminStatus = { ...prev };
                if (
                  inner.scope === "buy" &&
                  typeof inner.online === "boolean"
                ) {
                  next.buyOnline = !!inner.online;
                } else if (
                  inner.scope === "sell" &&
                  typeof inner.online === "boolean"
                ) {
                  next.sellOnline = !!inner.online;
                } else {
                  if (typeof inner.buyOnline === "boolean")
                    next.buyOnline = !!inner.buyOnline;
                  if (typeof inner.sellOnline === "boolean")
                    next.sellOnline = !!inner.sellOnline;
                }
                await this.state.storage.put("admin_status", next);
              }
            } catch {}
            await this.broadcast("chat", {
              id: cid,
              text,
              at: Date.now(),
            });
          } else if (msg?.kind === "notification") {
            await this.broadcast("notification", msg.data);
          } else if (msg?.type === "ping") {
            server.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
          }
        } catch {}
      });

      server.addEventListener("close", () => {
        this.clients.delete(cid);
      });

      // Send initial snapshot
      const [orders, adminStatus] = await Promise.all([
        this.state.storage.get<Order[]>("orders").then((v) => v || []),
        this.state.storage
          .get<AdminStatus>("admin_status")
          .then(
            (v) =>
              v || ({ buyOnline: false, sellOnline: false } as AdminStatus),
          ),
      ]);
      server.send(
        JSON.stringify({
          kind: "snapshot",
          data: { orders, admin_status: adminStatus },
        }),
      );

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith("/orders") && request.method === "GET") {
      const orders = (await this.state.storage.get<Order[]>("orders")) || [];
      return Response.json({ orders });
    }

    if (url.pathname.endsWith("/orders") && request.method === "POST") {
      const body = await request.json<any>().catch(() => null);
      if (!body)
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      const orders = (await this.state.storage.get<Order[]>("orders")) || [];
      const order: Order = {
        id: crypto.randomUUID(),
        side: body.side,
        amountPKR: Number(body.amountPKR),
        quoteAsset: String(body.quoteAsset || "USDT"),
        pricePKRPerQuote: Number(body.pricePKRPerQuote),
        paymentMethod: String(body.paymentMethod || "easypaisa"),
        createdAt: Date.now(),
        createdBy: String(body.createdBy || "admin"),
        accountName: body.accountName,
        accountNumber: body.accountNumber,
      };
      orders.unshift(order);
      await this.state.storage.put("orders", orders);
      await this.broadcast("order:new", order);
      return Response.json(order, { status: 201 });
    }

    const idMatch = url.pathname.match(/\/orders\/(.+)$/);
    if (idMatch) {
      const id = decodeURIComponent(idMatch[1]);
      const orders = (await this.state.storage.get<Order[]>("orders")) || [];
      const idx = orders.findIndex((o) => o.id === id);
      if (idx === -1)
        return Response.json({ error: "Not found" }, { status: 404 });
      if (request.method === "GET") {
        return Response.json(orders[idx]);
      }
      if (request.method === "PUT") {
        const patch = await request.json<any>().catch(() => ({}));
        const updated = { ...orders[idx], ...patch } as Order;
        orders[idx] = updated;
        await this.state.storage.put("orders", orders);
        await this.broadcast("order:updated", updated);
        return Response.json(updated);
      }
      if (request.method === "DELETE") {
        const removed = orders.splice(idx, 1)[0];
        await this.state.storage.put("orders", orders);
        await this.broadcast("order:deleted", { id: removed.id });
        return Response.json({ ok: true });
      }
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // passthrough for other room-scoped paths as needed
    return new Response("Not found", { status: 404 });
  }
}
