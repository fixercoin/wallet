import { DurableRoom } from "./durable_room";
import { json, parseJSON } from "./utils";
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
  ALLOWED_PAYMENT: string;
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

    const corsHeaders = {
      "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    } as const;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (pathname === "/" || pathname === "/api/health" || pathname === "/api/ping") {
      return json({ status: "ok", timestamp: new Date().toISOString() }, { headers: corsHeaders });
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

    // P2P Orders API
    if (pathname === "/api/p2p/orders") {
      await ensureP2PSchema(env.ROOM as any);
      if (req.method === "GET") {
        try {
          const type = searchParams.get("type") as any;
          const status = searchParams.get("status") as any;
          const token = searchParams.get("token") as any;
          const online =
            searchParams.get("online") === "true" ? true : undefined;

          const orders = await listP2POrders(env.ROOM as any, {
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

          const order = await createP2POrder(env.ROOM as any, {
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
      await ensureP2PSchema(env.ROOM as any);
      const orderId = decodeURIComponent(p2pOrderMatch[1]);

      if (req.method === "GET") {
        try {
          const order = await getP2POrder(env.ROOM as any, orderId);
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
          const order = await updateP2POrder(env.ROOM as any, orderId, body || {});
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
          await deleteP2POrder(env.ROOM as any, orderId);
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
      await ensureP2PSchema(env.ROOM as any);
      if (req.method === "GET") {
        try {
          const wallet = searchParams.get("wallet");
          const rooms = await listTradeRooms(env.ROOM as any, wallet || undefined);
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
          const room = await createTradeRoom(env.ROOM as any, {
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
      await ensureP2PSchema(env.ROOM as any);
      const roomId = decodeURIComponent(roomMatch[1]);
      const action = roomMatch[2];

      if (!action && req.method === "GET") {
        try {
          const room = await getTradeRoom(env.ROOM as any, roomId);
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
          const room = await updateTradeRoom(env.ROOM as any, roomId, body.status);
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
          const messages = await listTradeMessages(env.ROOM as any, roomId);
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
          const message = await addTradeMessage(env.ROOM as any, {
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

    // Exchange Rate API
    if (pathname === "/api/exchange-rate" && req.method === "GET") {
      const token = searchParams.get("token") || "USDC";
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

    // DexTools price proxy (fallback): /api/dextools/price?tokenAddress=...&chainId=solana
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

    // SOL price proxy: /api/sol/price
    if (pathname === "/api/sol/price" && req.method === "GET") {
      try {
        const SOL_MINT = "So11111111111111111111111111111111111111112";
        const dexUrl = `https://api.dexscreener.io/latest/dex/tokens/${SOL_MINT}`;
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
        const pair = data.pairs?.[0];
        const priceData = {
          price: parseFloat(pair?.priceUsd || "0"),
          priceChange24h: parseFloat(pair?.priceChange?.h24 || "0"),
          volume24h: parseFloat(pair?.volume?.h24 || "0"),
          marketCap: pair?.marketCap || 0,
        };

        return json(priceData, { headers: corsHeaders });
      } catch (e: any) {
        return json(
          { error: "Failed to fetch SOL price", details: e?.message },
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

    // Solana RPC proxy: /api/rpc (POST)
    if (pathname === "/api/rpc" && req.method === "POST") {
      try {
        const body = await parseJSON(req);

        if (!body || typeof body !== "object") {
          return json(
            { error: "Invalid request body" },
            { status: 400, headers: corsHeaders },
          );
        }

        const RPC_ENDPOINTS = [
          "https://api.mainnet-beta.solana.com",
          "https://rpc.ankr.com/solana",
          "https://solana-mainnet.rpc.extrnode.com",
          "https://solana.blockpi.network/v1/rpc/public",
          "https://solana.publicnode.com",
        ];

        const methodName = body?.method;
        const params = body?.params ?? [];
        const id = body?.id ?? Date.now();

        if (!methodName || typeof methodName !== "string") {
          return json(
            { error: "Missing RPC method" },
            { status: 400, headers: corsHeaders },
          );
        }

        const payload = {
          jsonrpc: "2.0",
          id,
          method: methodName,
          params,
        };

        let lastError: Error | null = null;

        for (const endpoint of RPC_ENDPOINTS) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!resp.ok) {
              if ([429, 502, 503].includes(resp.status)) continue;
              const t = await resp.text().catch(() => "");
              throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
            }

            const data = await resp.text();
            return new Response(data, {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            });
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
          }
        }

        return json(
          { error: "All RPC endpoints failed", details: lastError?.message },
          { status: 502, headers: corsHeaders },
        );
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
        const rpcUrl = "https://api.mainnet-beta.solana.com";
        const payload = {
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [signature, { encoding: "json", maxSupportedTransactionVersion: 0 }],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

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
        const rpcUrl = "https://api.mainnet-beta.solana.com";
        const payload = {
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [publicKey, { encoding: "jsonParsed" }],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

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

    // 404 for unknown routes
    return json(
      { error: "API endpoint not found", path: pathname },
      { status: 404, headers: corsHeaders },
    );
  },
};
