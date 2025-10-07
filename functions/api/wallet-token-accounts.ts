import type { Env } from "../../types/env" // optional env typings
// This file wraps existing Express handler from server/routes/wallet.ts
// and adapts it to Cloudflare Pages Functions runtime.

import { handleWalletTokenAccounts } from "../../../server/routes/wallet.ts";

async function callHandler(handler, req) {
  // Build mock Express req and res
  const body = await (async () => {
    try {
      return await req.json();
    } catch (e) {
      return null;
    }
  })();

  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const params = {};

  let statusSet = 200;
  let headers = {};
  let sent = null;

  const res = {
    status: (s) => {
      statusSet = s;
      return res;
    },
    setHeader: (k, v) => {
      headers[k] = v;
    },
    json: (payload) => {
      sent = payload;
    },
    send: (payload) => {
      sent = payload;
    },
    end: () => {}
  };

  const mockReq = {
    method: req.method,
    headers: Object.fromEntries(req.headers),
    body,
    query,
    params,
    url: req.url
  };

  // call handler
  await handler(mockReq as any, res as any);

  // Build Response
  const respHeaders = new Headers(headers || { "Content-Type": "application/json" });
  respHeaders.set("Access-Control-Allow-Origin", "*");
  respHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  respHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  const bodyOut = (sent === null) ? "" : (typeof sent === "string" ? sent : JSON.stringify(sent));
  return new Response(bodyOut, { status: statusSet, headers: respHeaders });
}

export const onRequest = async (context) => {
  const { request, env } = context;
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    const headers = new Headers();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return new Response(null, { status: 204, headers });
  }
  return await callHandler(handleWalletTokenAccounts, request);
};
