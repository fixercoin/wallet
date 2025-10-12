export default async function (request: Request): Promise<Response> {
  const ADMIN_WALLET = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Admin-Wallet",
      },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/api\/p2p/, "");

  // Initialize global in-memory store (persists during dev server lifetime)
  const store: any = (globalThis as any).__P2P_STORE || {
    posts: [],
    messages: {},
    proofs: {},
  };
  (globalThis as any).__P2P_STORE = store;

  const jsonResponse = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  try {
    // List posts
    if (request.method === "GET" && (path === "/list" || path === "/")) {
      return jsonResponse({ posts: store.posts });
    }

    // Get post by id
    if (request.method === "GET" && path.startsWith("/post/")) {
      const id = path.replace("/post/", "");
      const post = store.posts.find((p: any) => p.id === id);
      if (!post) return jsonResponse({ error: "not found" }, 404);
      return jsonResponse({ post });
    }

    // Create or update post (admin only)
    if ((request.method === "POST" || request.method === "PUT") && path === "/post") {
      const body = await request.json().catch(() => null);
      const adminHeader = request.headers.get("x-admin-wallet") || (body && body.adminWallet) || "";
      if (adminHeader !== ADMIN_WALLET) {
        return jsonResponse({ error: "unauthorized" }, 401);
      }

      const payload = body || {};
      const now = Date.now();
      if (payload.id) {
        // update
        const idx = store.posts.findIndex((p: any) => p.id === payload.id);
        if (idx === -1) return jsonResponse({ error: "not found" }, 404);
        store.posts[idx] = { ...store.posts[idx], ...payload, updatedAt: now };
        return jsonResponse({ post: store.posts[idx] });
      }

      const id = `post-${now}`;
      const post = {
        id,
        type: payload.type || "buy",
        token: payload.token || "USDC",
        pricePkr: Number(payload.pricePkr) || 0,
        minToken: Number(payload.minToken) || 0,
        maxToken: Number(payload.maxToken) || 0,
        paymentMethod: payload.paymentMethod || "bank",
        createdAt: now,
        updatedAt: now,
      };
      store.posts.unshift(post);
      return jsonResponse({ post }, 201);
    }

    // Trade messages: list
    if (request.method === "GET" && path.startsWith("/trade/") && path.endsWith("/messages")) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/messages$/, "");
      const msgs = store.messages[tradeId] || [];
      return jsonResponse({ messages: msgs });
    }

    // Trade messages: post a message
    if (request.method === "POST" && path.startsWith("/trade/") && path.endsWith("/message")) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/message$/, "");
      const body = await request.json().catch(() => null);
      const msg = body?.message;
      if (!msg) return jsonResponse({ error: "invalid message" }, 400);
      const entry = { id: `m-${Date.now()}`, message: msg, from: body.from || "unknown", ts: Date.now() };
      store.messages[tradeId] = store.messages[tradeId] || [];
      store.messages[tradeId].push(entry);
      return jsonResponse({ message: entry }, 201);
    }

    // Upload proof (base64) for a trade
    if (request.method === "POST" && path.startsWith("/trade/") && path.endsWith("/proof")) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/proof$/, "");
      const body = await request.json().catch(() => null);
      const proof = body?.proof; // expect { filename, data (base64) }
      if (!proof || !proof.filename || !proof.data) return jsonResponse({ error: "invalid proof" }, 400);
      store.proofs[tradeId] = store.proofs[tradeId] || [];
      store.proofs[tradeId].push({ id: `p-${Date.now()}`, filename: proof.filename, data: proof.data, ts: Date.now() });
      return jsonResponse({ ok: true }, 201);
    }

    return jsonResponse({ error: "not found" }, 404);
  } catch (err) {
    return jsonResponse({ error: (err as any).message || String(err) }, 500);
  }
}
