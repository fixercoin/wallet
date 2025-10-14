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
}

type Client = { ws: WebSocket; id: string };

export class DurableRoom implements DurableObject {
  private state: DurableObjectState;
  private clients = new Map<string, Client>();

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const saved = (await this.state.storage.get<Order[]>("orders")) || [];
      await this.state.storage.put("orders", saved);
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
          const msg = JSON.parse(typeof evt.data === "string" ? evt.data : String(evt.data));
          if (msg?.type === "chat") {
            await this.broadcast("chat", { id: cid, text: String(msg.text || ""), at: Date.now() });
          } else if (msg?.type === "ping") {
            server.send(JSON.stringify({ kind: "pong", ts: Date.now() }));
          }
        } catch {}
      });

      server.addEventListener("close", () => {
        this.clients.delete(cid);
      });

      // Send initial snapshot
      const orders = (await this.state.storage.get<Order[]>("orders")) || [];
      server.send(JSON.stringify({ kind: "snapshot", data: { orders } }));

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith("/orders") && request.method === "GET") {
      const orders = (await this.state.storage.get<Order[]>("orders")) || [];
      return Response.json({ orders });
    }

    if (url.pathname.endsWith("/orders") && request.method === "POST") {
      const body = await request.json<Order>().catch(() => null);
      if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });
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
      };
      orders.unshift(order);
      await this.state.storage.put("orders", orders);
      await this.broadcast("order:new", order);
      return Response.json(order, { status: 201 });
    }

    // passthrough for other room-scoped paths as needed
    return new Response("Not found", { status: 404 });
  }
}
