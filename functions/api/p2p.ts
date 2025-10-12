import {
  listPosts,
  getPost,
  createOrUpdatePost,
  listTradeMessages,
  addTradeMessage,
  uploadProof,
} from "../../utils/p2pStore";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export default async function (request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,Authorization,X-Admin-Wallet",
      },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/api\/p2p/, "");

  try {
    if (request.method === "GET" && (path === "/list" || path === "/")) {
      return jsonResponse(listPosts());
    }

    if (request.method === "GET" && path.startsWith("/post/")) {
      const id = path.replace("/post/", "");
      const post = getPost(id);
      if (!post) return jsonResponse({ error: "not found" }, 404);
      return jsonResponse({ post });
    }

    if (
      (request.method === "POST" || request.method === "PUT") &&
      path === "/post"
    ) {
      const body = await request.json().catch(() => null);
      const adminHeader =
        request.headers.get("x-admin-wallet") || body?.adminWallet || "";
      const result = createOrUpdatePost(body || {}, adminHeader || "");
      if ("error" in result) return jsonResponse({ error: result.error }, result.status);
      return jsonResponse({ post: result.post }, result.status);
    }

    if (
      request.method === "GET" &&
      path.startsWith("/trade/") &&
      path.endsWith("/messages")
    ) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/messages$/, "");
      return jsonResponse(listTradeMessages(tradeId));
    }

    if (
      request.method === "POST" &&
      path.startsWith("/trade/") &&
      path.endsWith("/message")
    ) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/message$/, "");
      const body = await request.json().catch(() => null);
      const msg = (body && body.message) || "";
      const from = (body && body.from) || "unknown";
      const result = addTradeMessage(tradeId, msg, from);
      if ("error" in result) return jsonResponse({ error: result.error }, result.status);
      return jsonResponse({ message: result.message }, result.status);
    }

    if (
      request.method === "POST" &&
      path.startsWith("/trade/") &&
      path.endsWith("/proof")
    ) {
      const tradeId = path.replace(/^\/trade\//, "").replace(/\/proof$/, "");
      const body = await request.json().catch(() => null);
      const result = uploadProof(tradeId, body?.proof);
      if ("error" in result) return jsonResponse({ error: result.error }, result.status);
      return jsonResponse({ ok: true }, result.status);
    }

    return jsonResponse({ error: "not found" }, 404);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || String(err) }, 500);
  }
}
