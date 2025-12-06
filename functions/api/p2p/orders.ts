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
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
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
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");

    const kvStore = new KVStore(env.STAKING_KV);

    if (walletAddress) {
      // Get all orders for specific wallet
      let orders = await kvStore.getOrdersByWallet(walletAddress);

      // Filter by status if provided
      if (status) {
        const statusLower = status.toLowerCase();
        orders = orders.filter(
          (o) =>
            o.status.toLowerCase() === statusLower ||
            (statusLower === "active" &&
              (o.status === "PENDING" || o.status === "pending")),
        );
      }

      // Filter by type if provided
      if (type) {
        orders = orders.filter((o) => o.type === type.toUpperCase());
      }

      return jsonResponse(200, {
        success: true,
        data: orders,
        orders: orders,
        count: orders.length,
      });
    }

    // Get ALL orders (for marketplace/offers display)
    if (type || status) {
      // For marketplace, we need to scan all orders
      // This is a workaround - ideally we'd have a global index
      const allOrders: any[] = [];

      // Query KV for all order keys
      const listResult = await env.STAKING_KV.list({ prefix: "orders:" });
      const keys = listResult.keys || [];

      for (const key of keys) {
        // Skip wallet index keys
        if (key.name.includes("wallet:")) continue;

        const orderJson = await env.STAKING_KV.get(key.name);
        if (orderJson) {
          try {
            const order = JSON.parse(orderJson);

            // Apply filters
            let include = true;

            if (type && order.type !== type.toUpperCase()) {
              include = false;
            }

            if (status && include) {
              const statusLower = status.toLowerCase();
              const orderStatus = order.status.toLowerCase();
              if (statusLower === "active") {
                include =
                  orderStatus === "pending" || orderStatus === "pending";
              } else if (statusLower !== orderStatus) {
                include = false;
              }
            }

            if (include) {
              allOrders.push(order);
            }
          } catch (e) {
            console.error("Failed to parse order:", key.name, e);
          }
        }
      }

      // Sort by createdAt descending
      allOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return jsonResponse(200, {
        success: true,
        data: allOrders,
        orders: allOrders,
        count: allOrders.length,
      });
    }

    return jsonResponse(400, {
      error: "Provide wallet, id, type, or status parameter",
    });
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
      minAmountPKR,
      maxAmountPKR,
      minAmountTokens,
      maxAmountTokens,
      pricePKRPerQuote,
      paymentMethodId,
      status,
      orderId,
      sellerWallet,
      buyerWallet,
    } = body;

    if (!walletAddress) {
      return jsonResponse(400, { error: "Missing wallet address" });
    }

    if (!type || !token) {
      return jsonResponse(400, {
        error: "Missing required fields: type and token",
      });
    }

    if (!["BUY", "SELL"].includes(type.toUpperCase())) {
      return jsonResponse(400, { error: "Invalid order type" });
    }

    const kvStore = new KVStore(env.STAKING_KV);

    // Support both amountTokens/amountPKR and min/max amounts
    const amount = amountTokens ?? minAmountTokens ?? 0;
    const pkrAmount = amountPKR ?? minAmountPKR ?? 0;

    const savedOrder = await kvStore.saveOrder(
      {
        walletAddress,
        type: type.toUpperCase() as "BUY" | "SELL",
        token,
        amountTokens: amount,
        amountPKR: pkrAmount,
        paymentMethodId: paymentMethodId || "",
        status: status || "PENDING",
        // Store additional fields for market display
        ...(minAmountPKR !== undefined && { minAmountPKR }),
        ...(maxAmountPKR !== undefined && { maxAmountPKR }),
        ...(minAmountTokens !== undefined && { minAmountTokens }),
        ...(maxAmountTokens !== undefined && { maxAmountTokens }),
        ...(pricePKRPerQuote !== undefined && { pricePKRPerQuote }),
        ...(sellerWallet && { sellerWallet }),
        ...(buyerWallet && { buyerWallet }),
      } as any,
      orderId,
    );

    return jsonResponse(201, {
      success: true,
      data: savedOrder,
      order: savedOrder,
    });
  } catch (error) {
    console.error("Error in /api/p2p/orders POST:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

// Note: PUT for individual orders is handled in functions/api/p2p/orders/[orderId].ts

// Note: DELETE for individual orders is handled in functions/api/p2p/orders/[orderId].ts

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: applyCors(new Headers()),
  });
};
