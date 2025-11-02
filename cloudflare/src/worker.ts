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
  RAZORPAY_KEY_ID: string; // Razorpay key ID
  RAZORPAY_KEY_SECRET: string; // Razorpay key secret
  WALLET_KV: KVNamespace; // KV store for wallet balances
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
          const online =
            searchParams.get("online") === "true" ? true : undefined;

          const orders = await listP2POrders(env.DB, {
            type,
            status,
            token,
            online,
          });
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
            return json(
              { error: "Invalid body" },
              { status: 400, headers: corsHeaders },
            );

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
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders },
      );
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
          return json(
            { error: "Order not found" },
            { status: 404, headers: corsHeaders },
          );
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
          return json(
            { error: "Order not found" },
            { status: 404, headers: corsHeaders },
          );
        }
      }
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders },
      );
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
      return json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders },
      );
    }

    // Single Trade Room routes
    const roomMatch = pathname.match(
      /^\/api\/p2p\/rooms\/([^/]+)(?:\/(messages|status))?$/,
    );
    if (roomMatch) {
      await ensureP2PSchema(env.DB);
      const roomId = decodeURIComponent(roomMatch[1]);
      const action = roomMatch[2];

      if (!action && req.method === "GET") {
        try {
          const room = await getTradeRoom(env.DB, roomId);
          return json({ room }, { headers: corsHeaders });
        } catch (e: any) {
          return json(
            { error: "Room not found" },
            { status: 404, headers: corsHeaders },
          );
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

      return json(
        { error: "Method not allowed" },
        { status: 405, headers: corsHeaders },
      );
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

    // Exchange Rate API
    if (pathname === "/api/exchange-rate" && req.method === "GET") {
      const token = searchParams.get("token") || "USDC";

      // Mock exchange rates - replace with actual API calls
      const rates: Record<string, number> = {
        FIXERCOIN: 0.0003,
        SOL: 6000,
        USDC: 280,
        USDT: 280,
        LOCKER: 0.5,
      };

      const rate = rates[token] || rates["USDC"];
      return json({ token, rate }, { headers: corsHeaders });
    }

    // Create Payment Intent (Razorpay)
    if (pathname === "/api/payments/create-intent" && req.method === "POST") {
      try {
        const body = await parseJSON(req);
        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const { walletAddress, amount, currency, tokenType, email, contact } =
          body as any;

        if (!walletAddress || !amount || !currency || !tokenType) {
          return json(
            { error: "Missing required fields" },
            { status: 400, headers: corsHeaders },
          );
        }

        // Create Razorpay order
        const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
        const orderResponse = await fetch(
          "https://api.razorpay.com/v1/orders",
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              amount: amount, // in paise
              currency: currency,
              receipt: `order_${walletAddress}_${Date.now()}`,
              notes: {
                walletAddress,
                tokenType,
              },
            }),
          },
        );

        if (!orderResponse.ok) {
          throw new Error(`Razorpay API error: ${orderResponse.statusText}`);
        }

        const orderData = (await orderResponse.json()) as any;

        return json(
          {
            orderId: orderData.id,
            key: env.RAZORPAY_KEY_ID,
            amount: orderData.amount,
            currency: orderData.currency,
            notes: orderData.notes,
          },
          { status: 201, headers: corsHeaders },
        );
      } catch (error: any) {
        console.error("Payment creation error:", error);
        return json(
          { error: error?.message || "Failed to create payment intent" },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // Razorpay Webhook Handler
    if (pathname === "/api/webhooks/payment" && req.method === "POST") {
      try {
        const body = await req.text();
        const signature = req.headers.get("x-razorpay-signature");

        if (!signature) {
          return json(
            { error: "Missing signature" },
            { status: 400, headers: corsHeaders },
          );
        }

        // Verify Razorpay signature using Web Crypto API
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(env.RAZORPAY_KEY_SECRET),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );

        const signatureBuffer = await crypto.subtle.sign(
          "HMAC",
          key,
          encoder.encode(body),
        );

        const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (signature !== expectedSignature) {
          console.error("Signature mismatch");
          return json(
            { error: "Invalid signature" },
            { status: 401, headers: corsHeaders },
          );
        }

        const payload = JSON.parse(body) as any;
        const event = payload.event;

        if (event === "payment.authorized" || event === "payment.captured") {
          const paymentData = payload.payload?.payment?.entity;
          if (!paymentData) {
            return json({ ok: true }, { headers: corsHeaders });
          }

          const walletAddress = paymentData.notes?.walletAddress;
          const tokenType = paymentData.notes?.tokenType;
          const amount = paymentData.amount / 100; // Convert from paise to rupees

          if (walletAddress && tokenType) {
            // Calculate token amount based on exchange rate
            const rates: Record<string, number> = {
              FIXERCOIN: 0.0003,
              SOL: 6000,
              USDC: 280,
              USDT: 280,
              LOCKER: 0.5,
            };

            const rate = rates[tokenType] || rates["USDC"];
            const tokenAmount = amount / rate;

            // Store payment record in KV
            const paymentId = paymentData.id;
            await env.WALLET_KV.put(
              `payment_${paymentId}`,
              JSON.stringify({
                walletAddress,
                tokenType,
                amount,
                tokenAmount,
                status: "completed",
                timestamp: Date.now(),
              }),
              { expirationTtl: 86400 * 30 }, // 30 days
            );

            // Credit wallet
            const balanceKey = `wallet_${walletAddress}_${tokenType}`;
            const oldBalanceStr = await env.WALLET_KV.get(balanceKey);
            const oldBalance = parseFloat(oldBalanceStr || "0");
            const newBalance = oldBalance + tokenAmount;

            await env.WALLET_KV.put(
              balanceKey,
              newBalance.toString(),
              { expirationTtl: 31536000 }, // 1 year
            );
          }
        }

        return json({ ok: true }, { headers: corsHeaders });
      } catch (error: any) {
        console.error("Webhook error:", error);
        return json(
          { error: error?.message || "Webhook processing failed" },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // Get Wallet Balance
    if (pathname === "/api/wallet/balance" && req.method === "GET") {
      try {
        // Accept multiple query parameter names for compatibility with different frontends
        const walletAddress =
          searchParams.get("wallet") ||
          searchParams.get("publicKey") ||
          searchParams.get("public_key") ||
          searchParams.get("address") ||
          searchParams.get("walletAddress") ||
          undefined;

        if (!walletAddress) {
          return json(
            { error: "Wallet address required" },
            { status: 400, headers: corsHeaders },
          );
        }

        const balances: Record<string, number> = {};
        const tokens = ["FIXERCOIN", "SOL", "USDC", "USDT", "LOCKER"];

        for (const token of tokens) {
          const balanceStr = await env.WALLET_KV.get(
            `wallet_${walletAddress}_${token}`,
          );
          balances[token] = parseFloat(balanceStr || "0");
        }

        return json({ walletAddress, balances }, { headers: corsHeaders });
      } catch (error: any) {
        return json(
          { error: error?.message || "Failed to fetch balance" },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // Manual Wallet Credit (admin only)
    if (pathname === "/api/wallet/credit" && req.method === "POST") {
      try {
        const authHeader = req.headers.get("authorization");
        if (authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
          return json(
            { error: "Unauthorized" },
            { status: 401, headers: corsHeaders },
          );
        }

        const body = await parseJSON(req);
        const { walletAddress, tokenType, amount } = body as any;

        if (!walletAddress || !tokenType || !amount) {
          return json(
            { error: "Missing required fields" },
            { status: 400, headers: corsHeaders },
          );
        }

        const balanceKey = `wallet_${walletAddress}_${tokenType}`;
        const oldBalanceStr = await env.WALLET_KV.get(balanceKey);
        const oldBalance = parseFloat(oldBalanceStr || "0");
        const newBalance = oldBalance + parseFloat(amount);

        await env.WALLET_KV.put(balanceKey, newBalance.toString(), {
          expirationTtl: 31536000,
        });

        return json(
          {
            status: "credited",
            walletAddress,
            tokenType,
            oldBalance,
            newBalance,
            amount,
          },
          { headers: corsHeaders },
        );
      } catch (error: any) {
        return json(
          { error: error?.message || "Failed to credit wallet" },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // SOL price proxy: /api/sol/price
    if (pathname === "/api/sol/price" && req.method === "GET") {
      try {
        const coinGeckoUrl =
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(coinGeckoUrl, {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `CoinGecko API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();

        // Transform CoinGecko response to expected format
        const solanaData = data.solana || {};
        const priceData = {
          price: solanaData.usd || 0,
          price_change_24h: solanaData.usd_24h_change || 0,
          market_cap: solanaData.usd_market_cap || 0,
          volume_24h: solanaData.usd_24h_vol || 0,
        };

        return json(priceData, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch SOL price", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun quote proxy: /api/pumpfun/quote?inputMint=...&outputMint=...&amount=...
    if (pathname === "/api/pumpfun/quote" && req.method === "GET") {
      const inputMint = url.searchParams.get("inputMint") || "";
      const outputMint = url.searchParams.get("outputMint") || "";
      const amount = url.searchParams.get("amount") || "";

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        // Use Pump.fun API for quotes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(
          `https://pumpportal.fun/api/quote?mint=${encodeURIComponent(inputMint)}&amount=${encodeURIComponent(amount)}`,
          {
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Pump.fun API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Pump.fun quote",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun quote POST handler for health checks
    if (pathname === "/api/pumpfun/quote" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const { inputMint, outputMint, amount } = body as any;

        if (!inputMint || !outputMint || !amount) {
          return json(
            {
              error: "Missing required fields: inputMint, outputMint, amount",
            },
            { status: 400, headers: corsHeaders },
          );
        }

        // Use Pump.fun API for quotes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(
          `https://pumpportal.fun/api/quote?mint=${encodeURIComponent(inputMint)}&amount=${encodeURIComponent(amount)}`,
          {
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Pump.fun API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Pump.fun quote",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun pool proxy: /api/pumpfun/pool?base=...&quote=...
    if (pathname === "/api/pumpfun/pool" && req.method === "GET") {
      const baseMint = url.searchParams.get("base") || "";
      const quoteMint = url.searchParams.get("quote") || "";

      if (!baseMint || !quoteMint) {
        return json(
          { error: "Missing required parameters: base, quote" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        // Use Shyft API to discover pools
        const shyftApiKey = "3hAwrhOAmJG82eC7";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(
          `https://rpc.shyft.to/pumpfun/pools?base_mint=${encodeURIComponent(baseMint)}&quote_mint=${encodeURIComponent(quoteMint)}&api_key=${shyftApiKey}`,
          {
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Pool lookup failed with status ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch pool info",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexTools price proxy: /api/dextools/price?tokenAddress=...&chainId=solana
    if (pathname === "/api/dextools/price" && req.method === "GET") {
      const tokenAddress = url.searchParams.get("tokenAddress") || "";
      const chainId = url.searchParams.get("chainId") || "solana";

      if (!tokenAddress) {
        return json(
          { error: "Missing 'tokenAddress' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const dexUrl = `https://api.dextools.io/v1/token/${chainId}/${tokenAddress}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(dexUrl, {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `DexTools API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data.data || data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch DexTools price", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // CoinMarketCap price proxy: /api/coinmarketcap/quotes?symbols=...
    if (pathname === "/api/coinmarketcap/quotes" && req.method === "GET") {
      const symbols = url.searchParams.get("symbols") || "";

      if (!symbols) {
        return json(
          { error: "Missing 'symbols' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const cmcApiKey = (env as any).COINMARKETCAP_API_KEY || "";
        if (!cmcApiKey) {
          return json(
            { error: "CoinMarketCap API key not configured" },
            { status: 500, headers: corsHeaders },
          );
        }

        const cmcUrl = new URL(
          "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest",
        );
        cmcUrl.searchParams.set("symbol", symbols);
        cmcUrl.searchParams.set("convert", "USD");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(cmcUrl.toString(), {
          headers: {
            Accept: "application/json",
            "X-CMC_PRO_API_KEY": cmcApiKey,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `CoinMarketCap API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch CoinMarketCap prices",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // DexScreener token price proxy: /api/dexscreener/price?token=...
    if (pathname === "/api/dexscreener/price" && req.method === "GET") {
      const token = url.searchParams.get("token") || "";

      if (!token) {
        return json(
          { error: "Missing 'token' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const dexUrl = `https://api.dexscreener.io/latest/dex/tokens/${token}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(dexUrl, {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `DexScreener API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch DexScreener price", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun swap quote: /api/swap/quote?mint=...
    if (pathname === "/api/swap/quote" && req.method === "GET") {
      const mint = url.searchParams.get("mint") || "";

      if (!mint) {
        return json(
          { error: "Missing 'mint' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(
          `https://pumpportal.fun/api/quote?mint=${encodeURIComponent(mint)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Pump.fun API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch swap quote", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Pump.fun swap execution: /api/swap/execute (POST)
    if (pathname === "/api/swap/execute" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const {
          mint,
          amount,
          decimals,
          slippage,
          txVersion,
          priorityFee,
          wallet,
        } = body as any;

        if (!mint || !amount) {
          return json(
            { error: "Missing required fields: mint, amount" },
            { status: 400, headers: corsHeaders },
          );
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const swapPayload = {
          mint,
          amount: String(amount),
          decimals: decimals || 6,
          slippage: slippage || 10,
          txVersion: txVersion || "V0",
          priorityFee: priorityFee || 0.0005,
          wallet: wallet,
        };

        const resp = await fetch("https://pumpportal.fun/api/trade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(swapPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text();
          return json(
            {
              error: `Pump.fun API returned ${resp.status}`,
              details: errorText,
            },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to execute swap",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Jupiter swap quote: /api/swap/jupiter/quote?inputMint=...&outputMint=...&amount=...
    if (pathname === "/api/swap/jupiter/quote" && req.method === "GET") {
      const inputMint = url.searchParams.get("inputMint") || "";
      const outputMint = url.searchParams.get("outputMint") || "";
      const amount = url.searchParams.get("amount") || "";

      if (!inputMint || !outputMint || !amount) {
        return json(
          {
            error: "Missing required parameters: inputMint, outputMint, amount",
          },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const jupiterUrl = new URL("https://quote-api.jup.ag/v6/quote");
        jupiterUrl.searchParams.set("inputMint", inputMint);
        jupiterUrl.searchParams.set("outputMint", outputMint);
        jupiterUrl.searchParams.set("amount", amount);
        jupiterUrl.searchParams.set("slippageBps", "500");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(jupiterUrl.toString(), {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          return json(
            { error: `Jupiter API returned ${resp.status}` },
            { status: resp.status, headers: corsHeaders },
          );
        }

        const data = await resp.json();
        return json(data, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          {
            error: "Failed to fetch Jupiter swap quote",
            details: e?.message,
          },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Solana RPC proxy: /api/rpc (POST) - for custom RPC calls
    if (pathname === "/api/rpc" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const rpcUrl = "https://rpc.shyft.to";
        const shyftApiKey = "3hAwrhOAmJG82eC7";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const resp = await fetch(`${rpcUrl}?api_key=${shyftApiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await resp.json();
        return json(data, { status: resp.status, headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to execute RPC call", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Get transaction details: /api/transaction?signature=...
    if (pathname === "/api/transaction" && req.method === "GET") {
      const signature = url.searchParams.get("signature") || "";

      if (!signature) {
        return json(
          { error: "Missing 'signature' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const rpcUrl = "https://rpc.shyft.to";
        const shyftApiKey = "3hAwrhOAmJG82eC7";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(
          `${rpcUrl}/getTransaction?api_key=${shyftApiKey}&txn_signature=${encodeURIComponent(signature)}`,
          {
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        const data = await resp.json();
        return json(data, { status: resp.status, headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch transaction", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Get account information: /api/account?publicKey=...
    if (pathname === "/api/account" && req.method === "GET") {
      const publicKey = url.searchParams.get("publicKey") || "";

      if (!publicKey) {
        return json(
          { error: "Missing 'publicKey' parameter" },
          { status: 400, headers: corsHeaders },
        );
      }

      try {
        const rpcUrl = "https://rpc.shyft.to";
        const shyftApiKey = "3hAwrhOAmJG82eC7";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(
          `${rpcUrl}/getAccountInfo?api_key=${shyftApiKey}&account_address=${encodeURIComponent(publicKey)}`,
          {
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        const data = await resp.json();
        return json(data, { status: resp.status, headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch account", details: e?.message },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    return json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },
};

export { DurableRoom };
