import { RequestHandler } from "express";

export interface P2POrder {
  id: string;
  type: "buy" | "sell";
  creator_wallet: string;
  token: string;
  token_amount: string;
  pkr_amount: number;
  payment_method: string;
  status: "active" | "pending" | "completed" | "cancelled" | "disputed";
  online: boolean;
  created_at: number;
  updated_at: number;
  account_name?: string;
  account_number?: string;
  wallet_address?: string;
}

export interface TradeRoom {
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

// In-memory store for development (will be replaced with database)
const orders: Map<string, P2POrder> = new Map();
const rooms: Map<string, TradeRoom> = new Map();
const messages: Map<
  string,
  Array<{
    id: string;
    sender_wallet: string;
    message: string;
    created_at: number;
  }>
> = new Map();

// Helper functions
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// P2P Orders endpoints
export const handleListP2POrders: RequestHandler = async (req, res) => {
  try {
    const { type, status, token, online } = req.query;

    let filtered = Array.from(orders.values());

    if (type) filtered = filtered.filter((o) => o.type === type);
    if (status) filtered = filtered.filter((o) => o.status === status);
    if (token) filtered = filtered.filter((o) => o.token === token);
    if (online === "true") filtered = filtered.filter((o) => o.online);
    if (online === "false") filtered = filtered.filter((o) => !o.online);

    filtered.sort((a, b) => b.created_at - a.created_at);

    res.json({ orders: filtered });
  } catch (error) {
    console.error("List P2P orders error:", error);
    res.status(500).json({ error: "Failed to list orders" });
  }
};

export const handleCreateP2POrder: RequestHandler = async (req, res) => {
  try {
    const {
      type,
      creator_wallet,
      token,
      token_amount,
      pkr_amount,
      payment_method,
      online,
      account_name,
      account_number,
      wallet_address,
    } = req.body;

    if (
      !type ||
      !creator_wallet ||
      !token ||
      !token_amount ||
      !pkr_amount ||
      !payment_method
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const id = generateId("order");
    const now = Date.now();

    const order: P2POrder = {
      id,
      type,
      creator_wallet,
      token,
      token_amount: String(token_amount),
      pkr_amount: Number(pkr_amount),
      payment_method,
      status: "active",
      online: online !== false,
      created_at: now,
      updated_at: now,
      account_name,
      account_number,
      wallet_address: type === "sell" ? wallet_address : undefined,
    };

    orders.set(id, order);

    res.status(201).json({ order });
  } catch (error) {
    console.error("Create P2P order error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const handleGetP2POrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = orders.get(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    console.error("Get P2P order error:", error);
    res.status(500).json({ error: "Failed to get order" });
  }
};

export const handleUpdateP2POrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = orders.get(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updated: P2POrder = {
      ...order,
      ...req.body,
      id: order.id,
      created_at: order.created_at,
      updated_at: Date.now(),
    };

    orders.set(orderId, updated);
    res.json({ order: updated });
  } catch (error) {
    console.error("Update P2P order error:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
};

export const handleDeleteP2POrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orders.has(orderId)) {
      return res.status(404).json({ error: "Order not found" });
    }

    orders.delete(orderId);
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete P2P order error:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
};

// Trade Rooms endpoints
export const handleListTradeRooms: RequestHandler = async (req, res) => {
  try {
    const { wallet } = req.query;

    let filtered = Array.from(rooms.values());

    if (wallet) {
      filtered = filtered.filter(
        (r) => r.buyer_wallet === wallet || r.seller_wallet === wallet,
      );
    }

    filtered.sort((a, b) => b.created_at - a.created_at);

    res.json({ rooms: filtered });
  } catch (error) {
    console.error("List trade rooms error:", error);
    res.status(500).json({ error: "Failed to list rooms" });
  }
};

export const handleCreateTradeRoom: RequestHandler = async (req, res) => {
  try {
    const { buyer_wallet, seller_wallet, order_id } = req.body;

    if (!buyer_wallet || !seller_wallet || !order_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const id = generateId("room");
    const now = Date.now();

    const room: TradeRoom = {
      id,
      buyer_wallet,
      seller_wallet,
      order_id,
      status: "pending",
      created_at: now,
      updated_at: now,
    };

    rooms.set(id, room);

    res.status(201).json({ room });
  } catch (error) {
    console.error("Create trade room error:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
};

export const handleGetTradeRoom: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({ room });
  } catch (error) {
    console.error("Get trade room error:", error);
    res.status(500).json({ error: "Failed to get room" });
  }
};

export const handleUpdateTradeRoom: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const updated: TradeRoom = {
      ...room,
      ...req.body,
      id: room.id,
      created_at: room.created_at,
      updated_at: Date.now(),
    };

    rooms.set(roomId, updated);
    res.json({ room: updated });
  } catch (error) {
    console.error("Update trade room error:", error);
    res.status(500).json({ error: "Failed to update room" });
  }
};

// Trade Messages endpoints
export const handleListTradeMessages: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.params;

    const roomMessages = messages.get(roomId) || [];
    res.json({ messages: roomMessages });
  } catch (error) {
    console.error("List trade messages error:", error);
    res.status(500).json({ error: "Failed to list messages" });
  }
};

export const handleAddTradeMessage: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { sender_wallet, message, attachment_url } = req.body;

    if (!sender_wallet || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const id = generateId("msg");
    const now = Date.now();

    const msg = {
      id,
      sender_wallet,
      message,
      attachment_url,
      created_at: now,
    };

    if (!messages.has(roomId)) {
      messages.set(roomId, []);
    }

    messages.get(roomId)!.push(msg);

    res.status(201).json({ message: msg });
  } catch (error) {
    console.error("Add trade message error:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
};
