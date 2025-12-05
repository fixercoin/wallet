/**
 * GET/PUT /api/p2p/rooms/[roomId]
 * Get and update a specific P2P trade room using Cloudflare KV
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

    const roomId = params.roomId;
    if (!roomId) {
      return jsonResponse(400, { error: "Missing room ID" });
    }

    const rooms = await getRooms(env.STAKING_KV);
    const room = rooms.find((r) => r.id === roomId);

    if (!room) {
      return jsonResponse(404, { error: "Room not found" });
    }

    return jsonResponse(200, {
      room,
    });
  } catch (error) {
    console.error("Error in /api/p2p/rooms/:roomId GET:", error);
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

    const roomId = params.roomId;
    if (!roomId) {
      return jsonResponse(400, { error: "Missing room ID" });
    }

    const body = await request.json();
    const rooms = await getRooms(env.STAKING_KV);
    const roomIndex = rooms.findIndex((r) => r.id === roomId);

    if (roomIndex === -1) {
      return jsonResponse(404, { error: "Room not found" });
    }

    const existingRoom = rooms[roomIndex];
    const updated: TradeRoom = {
      ...existingRoom,
      ...body,
      id: existingRoom.id,
      created_at: existingRoom.created_at,
      updated_at: Date.now(),
    };

    rooms[roomIndex] = updated;
    await saveRooms(env.STAKING_KV, rooms);

    return jsonResponse(200, {
      room: updated,
    });
  } catch (error) {
    console.error("Error in /api/p2p/rooms/:roomId PUT:", error);
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
