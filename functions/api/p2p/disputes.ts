/**
 * GET/POST/PUT /api/p2p/disputes
 * Manage disputes for P2P orders using Cloudflare KV or Appwrite
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
        error: "Storage not configured. Provide either STAKING_KV or Appwrite credentials",
      });
    }

    const url = new URL(request.url);
    const disputeId = url.searchParams.get("id");
    const filter = url.searchParams.get("filter");

    if (disputeId) {
      const dispute = await kvStore.getDispute(disputeId);
      if (!dispute) {
        return jsonResponse(404, { error: "Dispute not found" });
      }
      return jsonResponse(200, {
        success: true,
        data: dispute,
      });
    } else if (filter === "open") {
      const disputes = await kvStore.getOpenDisputes();
      return jsonResponse(200, {
        success: true,
        data: disputes,
        count: disputes.length,
      });
    } else {
      const disputes = await kvStore.getAllDisputes();
      return jsonResponse(200, {
        success: true,
        data: disputes,
        count: disputes.length,
      });
    }
  } catch (error) {
    console.error("Error in /api/p2p/disputes GET:", error);
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
    const { escrowId, orderId, initiatedBy, reason, evidence } = body;

    if (!escrowId || !orderId || !initiatedBy || !reason) {
      return jsonResponse(400, {
        error: "Missing required fields",
      });
    }

    const kvStore = new KVStore(env.STAKING_KV);

    const dispute = await kvStore.createDispute({
      escrowId,
      orderId,
      initiatedBy,
      reason,
      evidence: evidence || [],
      status: "OPEN",
    });

    await kvStore.getEscrow(escrowId).then((escrow) => {
      if (escrow) {
        kvStore.updateEscrowStatus(escrowId, "DISPUTED");
      }
    });

    return jsonResponse(200, {
      success: true,
      data: dispute,
    });
  } catch (error) {
    console.error("Error in /api/p2p/disputes POST:", error);
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
    const { disputeId, resolution, resolvedBy } = body;

    if (!disputeId || !resolution || !resolvedBy) {
      return jsonResponse(400, {
        error: "Missing dispute ID, resolution, or resolver",
      });
    }

    if (
      !["RELEASE_TO_SELLER", "REFUND_TO_BUYER", "SPLIT"].includes(resolution)
    ) {
      return jsonResponse(400, {
        error: "Invalid resolution type",
      });
    }

    const kvStore = new KVStore(env.STAKING_KV);
    const dispute = await kvStore.getDispute(disputeId);

    if (!dispute) {
      return jsonResponse(404, { error: "Dispute not found" });
    }

    const updated = await kvStore.resolveDispute(
      disputeId,
      resolution,
      resolvedBy,
    );

    if (updated && dispute.escrowId) {
      const escrowFinalStatus =
        resolution === "RELEASE_TO_SELLER" ? "RELEASED" : "REFUNDED";
      await kvStore.updateEscrowStatus(dispute.escrowId, escrowFinalStatus);
    }

    return jsonResponse(200, {
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error in /api/p2p/disputes PUT:", error);
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
