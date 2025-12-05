/**
 * GET/POST /api/p2p/rooms/[roomId]/messages
 * Manage P2P trade room chat messages using Cloudflare KV
 */

import { KVStore } from "../../../../lib/kv-utils";

interface Env {
  STAKING_KV: any;
  [key: string]: any;
}

interface TradeMessage {
  id: string;
  room_id: string;
  sender_wallet: string;
  message: string;
  attachment_url?: string;
  created_at: number;
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

async function getMessages(kv: any, roomId: string): Promise<TradeMessage[]> {
  try {
    const key = `p2p:room:${roomId}:messages`;
    const data = await kv.get(key);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Error getting messages:", error);
    return [];
  }
}

async function saveMessage(
  kv: any,
  roomId: string,
  message: TradeMessage,
): Promise<void> {
  try {
    const key = `p2p:room:${roomId}:messages`;
    const messages = await getMessages(kv, roomId);
    messages.push(message);
    // Keep only last 100 messages per room
    const trimmed = messages.slice(-100);
    await kv.put(key, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Error saving message:", error);
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

    const messages = await getMessages(env.STAKING_KV, roomId);

    return jsonResponse(200, {
      messages,
      count: messages.length,
      roomId,
    });
  } catch (error) {
    console.error("Error in /api/p2p/rooms/:roomId/messages GET:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestPost = async ({
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
    const { sender_wallet, message, attachment_url } = body;

    if (!sender_wallet || !message) {
      return jsonResponse(400, {
        error: "Missing required fields: sender_wallet, message",
      });
    }

    const newMessage: TradeMessage = {
      id: generateId("msg"),
      room_id: roomId,
      sender_wallet,
      message,
      attachment_url: attachment_url || undefined,
      created_at: Date.now(),
    };

    await saveMessage(env.STAKING_KV, roomId, newMessage);

    return jsonResponse(201, {
      message: newMessage,
    });
  } catch (error) {
    console.error("Error in /api/p2p/rooms/:roomId/messages POST:", error);
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
