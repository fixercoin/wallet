/**
 * GET/POST /api/p2p/escrow
 * Manage escrow (fund holding) for P2P orders using Cloudflare KV or Appwrite
 */

import { KVStore, Escrow } from "../../lib/kv-utils";
import { getKVStore } from "../../lib/kv-store-factory";

interface Env {
  STAKING_KV?: any;
  APPWRITE_ENDPOINT?: string;
  APPWRITE_PROJECT_ID?: string;
  APPWRITE_API_KEY?: string;
  APPWRITE_DATABASE_ID?: string;
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
    let kvStore: any;
    try {
      kvStore = getKVStore(env);
    } catch (error) {
      return jsonResponse(500, {
        error: "Storage not configured. Provide either STAKING_KV or Appwrite credentials",
      });
    }

    const url = new URL(request.url);
    const escrowId = url.searchParams.get("id");
    const orderId = url.searchParams.get("orderId");

    if (escrowId) {
      const escrow = await kvStore.getEscrow(escrowId);
      if (!escrow) {
        return jsonResponse(404, { error: "Escrow not found" });
      }
      return jsonResponse(200, {
        success: true,
        data: escrow,
      });
    } else if (orderId) {
      const escrows = await kvStore.getEscrowsByOrder(orderId);
      return jsonResponse(200, {
        success: true,
        data: escrows,
        count: escrows.length,
      });
    } else {
      return jsonResponse(400, {
        error: "Missing escrow ID or order ID",
      });
    }
  } catch (error) {
    console.error("Error in /api/p2p/escrow GET:", error);
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
    let kvStore: any;
    try {
      kvStore = getKVStore(env);
    } catch (error) {
      return jsonResponse(500, {
        error: "Storage not configured. Provide either STAKING_KV or Appwrite credentials",
      });
    }

    const body = await request.json();
    const {
      orderId,
      buyerWallet,
      sellerWallet,
      amountPKR,
      amountTokens,
      token,
    } = body;

    if (!orderId || !buyerWallet || !sellerWallet || !amountPKR || !token) {
      return jsonResponse(400, {
        error: "Missing required fields",
      });
    }

    const escrow = await kvStore.saveEscrow({
      orderId,
      buyerWallet,
      sellerWallet,
      amountPKR,
      amountTokens: amountTokens || 0,
      token,
      status: "LOCKED",
    });

    return jsonResponse(200, {
      success: true,
      data: escrow,
    });
  } catch (error) {
    console.error("Error in /api/p2p/escrow POST:", error);
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
    let kvStore: any;
    try {
      kvStore = getKVStore(env);
    } catch (error) {
      return jsonResponse(500, {
        error: "Storage not configured. Provide either STAKING_KV or Appwrite credentials",
      });
    }

    const body = await request.json();
    const { escrowId, status } = body;

    if (!escrowId || !status) {
      return jsonResponse(400, {
        error: "Missing escrow ID or status",
      });
    }

    if (!["LOCKED", "RELEASED", "REFUNDED", "DISPUTED"].includes(status)) {
      return jsonResponse(400, {
        error: "Invalid status",
      });
    }

    const updated = await kvStore.updateEscrowStatus(escrowId, status);

    return jsonResponse(200, {
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error in /api/p2p/escrow PUT:", error);
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
