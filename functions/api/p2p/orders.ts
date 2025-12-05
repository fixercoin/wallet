/**
 * GET/POST /api/p2p/orders
 * Manage P2P buy/sell orders using Cloudflare KV
 */

import { KVStore } from "../../lib/kv-utils";

interface Env {
  STAKING_KV: any;
  [key: string]: any;
}

function applyCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");
  return headers;
}

function jsonResponse(status: number, body: any) {
  const headers = applyCors(
    new Headers({ "Content-Type": "application/json" }),
  );
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

export const onRequestGet = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");
    const orderId = url.searchParams.get("id");
    const status = url.searchParams.get("status");

    if (!walletAddress) {
      return jsonResponse(400, { error: "Missing wallet address" });
    }

    const kvStore = new KVStore(env.STAKING_KV);

    if (orderId) {
      // Get single order
      const order = await kvStore.getOrder(orderId);
      if (!order) {
        return jsonResponse(404, { error: "Order not found" });
      }
      return jsonResponse(200, {
        success: true,
        data: order,
      });
    } else {
      // Get all orders for wallet
      let orders = await kvStore.getOrdersByWallet(walletAddress);

      // Filter by status if provided
      if (status) {
        orders = orders.filter((o) => o.status === status);
      }

      return jsonResponse(200, {
        success: true,
        data: orders,
        count: orders.length,
      });
    }
  } catch (error) {
    console.error("Error in /api/p2p/orders GET:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const body = await request.json();
    const {
      walletAddress,
      type,
      token,
      amountTokens,
      amountPKR,
      paymentMethodId,
      status,
      orderId,
    } = body;

    if (!walletAddress) {
      return jsonResponse(400, { error: "Missing wallet address" });
    }

    if (!type || !token || amountTokens === undefined || amountPKR === undefined) {
      return jsonResponse(400, {
        error: "Missing required fields",
      });
    }

    if (!["BUY", "SELL"].includes(type)) {
      return jsonResponse(400, { error: "Invalid order type" });
    }

    const kvStore = new KVStore(env.STAKING_KV);

    const savedOrder = await kvStore.saveOrder(
      {
        walletAddress,
        type,
        token,
        amountTokens,
        amountPKR,
        paymentMethodId: paymentMethodId || "",
        status: status || "PENDING",
      },
      orderId,
    );

    return jsonResponse(200, {
      success: true,
      data: savedOrder,
    });
  } catch (error) {
    console.error("Error in /api/p2p/orders POST:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestPut = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId) {
      return jsonResponse(400, { error: "Missing order ID" });
    }

    const kvStore = new KVStore(env.STAKING_KV);
    const order = await kvStore.getOrder(orderId);

    if (!order) {
      return jsonResponse(404, { error: "Order not found" });
    }

    const updatedOrder = await kvStore.saveOrder(
      {
        walletAddress: order.walletAddress,
        type: order.type,
        token: order.token,
        amountTokens: order.amountTokens,
        amountPKR: order.amountPKR,
        paymentMethodId: order.paymentMethodId,
        status: status || order.status,
      },
      orderId,
    );

    return jsonResponse(200, {
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Error in /api/p2p/orders PUT:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestDelete = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");
    const orderId = url.searchParams.get("id");

    if (!walletAddress || !orderId) {
      return jsonResponse(400, {
        error: "Missing wallet address or order ID",
      });
    }

    const kvStore = new KVStore(env.STAKING_KV);
    await kvStore.deleteOrder(orderId, walletAddress);

    return jsonResponse(200, {
      success: true,
      message: "Order deleted",
    });
  } catch (error) {
    console.error("Error in /api/p2p/orders DELETE:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: applyCors(new Headers()),
  });
};
