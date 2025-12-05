/**
 * GET/POST /api/p2p/rooms
 * Manage P2P trade rooms using Cloudflare KV
 */

import { KVStore } from "../../../lib/kv-utils";

interface Env {
  STAKING_KV: any;
  [key: string]: any;
}

interface TradeRoom {
  id: string;
  buyer_wallet: string;
  seller_wallet: string;
  order_id: string;
  status:
    | "pending"
    | "payment_confirmed"
    | "assets_transferred"
    | "completed"
    | "cancelled";
  created_at: number;
  updated_at: number;
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

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getRooms(kv: any): Promise<TradeRoom[]> {
  try {
    const data = await kv.get("p2p:rooms:all");
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Error getting rooms:", error);
    return [];
  }
}

async function saveRooms(kv: any, rooms: TradeRoom[]): Promise<void> {
  try {
    await kv.put("p2p:rooms:all", JSON.stringify(rooms));
  } catch (error) {
    console.error("Error saving rooms:", error);
    throw error;
  }
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
    const walletFilter = url.searchParams.get("wallet");

    let rooms = await getRooms(env.STAKING_KV);

    // Filter by wallet if provided
    if (walletFilter) {
      rooms = rooms.filter(
        (r) =>
          r.buyer_wallet === walletFilter || r.seller_wallet === walletFilter,
      );
    }

    // Sort by most recent first
    rooms.sort((a, b) => b.created_at - a.created_at);

    return jsonResponse(200, {
      rooms,
      count: rooms.length,
    });
  } catch (error) {
    console.error("Error in /api/p2p/rooms GET:", error);
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
    const { buyer_wallet, seller_wallet, order_id } = body;

    if (!buyer_wallet || !seller_wallet || !order_id) {
      return jsonResponse(400, {
        error: "Missing required fields: buyer_wallet, seller_wallet, order_id",
      });
    }

    const now = Date.now();
    const newRoom: TradeRoom = {
      id: generateId("room"),
      buyer_wallet,
      seller_wallet,
      order_id,
      status: "pending",
      created_at: now,
      updated_at: now,
    };

    const rooms = await getRooms(env.STAKING_KV);
    rooms.push(newRoom);
    await saveRooms(env.STAKING_KV, rooms);

    return jsonResponse(201, {
      room: newRoom,
    });
  } catch (error) {
    console.error("Error in /api/p2p/rooms POST:", error);
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
