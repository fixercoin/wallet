/**
 * GET/POST /api/p2p/payment-methods
 * Manage payment methods for P2P trading using Cloudflare KV or Appwrite
 */

import { KVStore } from "../../lib/kv-utils";
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
        error:
          "Storage not configured. Provide either STAKING_KV or Appwrite credentials",
      });
    }

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");
    const methodId = url.searchParams.get("id");

    if (!walletAddress) {
      return jsonResponse(400, { error: "Missing wallet address" });
    }

    if (methodId) {
      // Get single payment method
      const method = await kvStore.getPaymentMethod(methodId);
      if (!method) {
        return jsonResponse(404, { error: "Payment method not found" });
      }
      return jsonResponse(200, {
        success: true,
        data: method,
      });
    } else {
      // Get all payment methods for wallet
      const methods = await kvStore.getPaymentMethodsByWallet(walletAddress);
      return jsonResponse(200, {
        success: true,
        data: methods,
        count: methods.length,
      });
    }
  } catch (error) {
    console.error("Error in /api/p2p/payment-methods GET:", error);
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
        error:
          "Storage not configured. Provide either STAKING_KV or Appwrite credentials",
      });
    }

    const body = await request.json();
    const {
      walletAddress,
      userName,
      paymentMethod,
      accountName,
      accountNumber,
      solanawWalletAddress,
      methodId,
    } = body;

    if (!walletAddress) {
      return jsonResponse(400, { error: "Missing wallet address" });
    }

    if (!userName || !accountName || !accountNumber || !solanawWalletAddress) {
      return jsonResponse(400, {
        error: "Missing required fields",
      });
    }

    const savedMethod = await kvStore.savePaymentMethod(
      {
        walletAddress,
        userName,
        paymentMethod: paymentMethod || "EASYPAISA",
        accountName,
        accountNumber,
        solanawWalletAddress,
      },
      methodId,
    );

    return jsonResponse(200, {
      success: true,
      data: savedMethod,
    });
  } catch (error) {
    console.error("Error in /api/p2p/payment-methods POST:", error);
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
    let kvStore: any;
    try {
      kvStore = getKVStore(env);
    } catch (error) {
      return jsonResponse(500, {
        error:
          "Storage not configured. Provide either STAKING_KV or Appwrite credentials",
      });
    }

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");
    const methodId = url.searchParams.get("id");

    if (!walletAddress || !methodId) {
      return jsonResponse(400, {
        error: "Missing wallet address or method ID",
      });
    }
    await kvStore.deletePaymentMethod(methodId, walletAddress);

    return jsonResponse(200, {
      success: true,
      message: "Payment method deleted",
    });
  } catch (error) {
    console.error("Error in /api/p2p/payment-methods DELETE:", error);
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
