import { KVStore } from "../../../lib/kv-utils";

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
  params,
}: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const orderId = params.orderId;

    if (!orderId) {
      return jsonResponse(400, { error: "Missing order ID" });
    }

    const kvStore = new KVStore(env.STAKING_KV);
    const order = await kvStore.getOrder(orderId);

    if (!order) {
      return jsonResponse(404, { error: "Order not found" });
    }

    return jsonResponse(200, {
      success: true,
      data: order,
      order: order,
      orders: [order],
    });
  } catch (error) {
    console.error("Error in /api/p2p/orders/:orderId GET:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestPut = async ({
  request,
  env,
  params,
}: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const orderId = params.orderId;
    const body = await request.json();
    const { status } = body;

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
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error in /api/p2p/orders/:orderId PUT:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestDelete = async ({
  request,
  env,
  params,
}: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");
    const orderId = params.orderId;

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
    console.error("Error in /api/p2p/orders/:orderId DELETE:", error);
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
