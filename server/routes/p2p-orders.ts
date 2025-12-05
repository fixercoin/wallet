import { RequestHandler } from "express";

export interface P2POrder {
  id: string;
  type: "BUY" | "SELL";
  creator_wallet?: string;
  walletAddress?: string;
  token: string;
  amountTokens?: number;
  token_amount?: string;
  amountPKR?: number;
  pkr_amount?: number;
  pricePKRPerQuote?: number;
  payment_method?: string;
  paymentMethodId?: string;
  status: "PENDING" | "active" | "pending" | "completed" | "cancelled" | "disputed";
  online?: boolean;
  created_at?: number;
  createdAt?: number;
  updated_at?: number;
  updatedAt?: number;
  account_name?: string;
  accountName?: string;
  account_number?: string;
  accountNumber?: string;
  wallet_address?: string;
  buyerWallet?: string;
  sellerWallet?: string;
  adminWallet?: string;
  orderId?: string;
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

// In-memory store for development (will be replaced with Cloudflare KV in production)
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

// Helper to normalize order fields
function normalizeOrder(order: any): P2POrder {
  return {
    id: order.id || order.orderId,
    type: order.type as "BUY" | "SELL",
    walletAddress: order.walletAddress || order.creator_wallet,
    token: order.token,
    amountTokens: order.amountTokens ?? parseFloat(order.token_amount || 0),
    amountPKR: order.amountPKR ?? order.pkr_amount,
    pricePKRPerQuote: order.pricePKRPerQuote,
    paymentMethod: order.paymentMethod || order.payment_method,
    status: (order.status || "PENDING") as P2POrder["status"],
    createdAt: order.createdAt || order.created_at || Date.now(),
    updatedAt: order.updatedAt || order.updated_at || Date.now(),
    accountName: order.accountName || order.account_name,
    accountNumber: order.accountNumber || order.account_number,
    buyerWallet: order.buyerWallet,
    sellerWallet: order.sellerWallet,
    adminWallet: order.adminWallet,
  };
}

// Helper functions
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// P2P Orders endpoints
export const handleListP2POrders: RequestHandler = async (req, res) => {
  try {
    const { type, status, token, wallet, id } = req.query;

    let filtered = Array.from(orders.values());

    if (wallet) {
      filtered = filtered.filter(
        (o) =>
          o.walletAddress === wallet ||
          o.creator_wallet === wallet ||
          o.buyerWallet === wallet ||
          o.sellerWallet === wallet,
      );
    }

    if (type) filtered = filtered.filter((o) => o.type === String(type));
    if (status) filtered = filtered.filter((o) => o.status === status);
    if (token) filtered = filtered.filter((o) => o.token === token);
    if (id) filtered = filtered.filter((o) => o.id === id);

    filtered.sort(
      (a, b) => (b.createdAt || b.created_at || 0) - (a.createdAt || a.created_at || 0),
    );

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
      walletAddress,
      creator_wallet,
      token,
      amountTokens,
      token_amount,
      amountPKR,
      pkr_amount,
      pricePKRPerQuote,
      payment_method,
      paymentMethodId,
      status,
      orderId,
      buyerWallet,
      sellerWallet,
      adminWallet,
      accountName,
      account_name,
      accountNumber,
      account_number,
    } = req.body;

    // Support both naming conventions
    const finalWallet = walletAddress || creator_wallet;
    const finalType = type?.toUpperCase() || "BUY";
    const finalToken = token;
    const finalAmount = amountTokens !== undefined ? amountTokens : parseFloat(token_amount || 0);
    const finalPKR = amountPKR !== undefined ? amountPKR : parseFloat(pkr_amount || 0);
    const finalPrice = pricePKRPerQuote;

    if (!finalType || !finalWallet || !finalToken) {
      return res.status(400).json({
        error: "Missing required fields: type, walletAddress (or creator_wallet), and token",
      });
    }

    const id = orderId || generateId("order");
    const now = Date.now();

    const order: P2POrder = {
      id,
      type: finalType as "BUY" | "SELL",
      walletAddress: finalWallet,
      creator_wallet: finalWallet,
      token: finalToken,
      amountTokens: finalAmount,
      amountPKR: finalPKR,
      pricePKRPerQuote: finalPrice,
      paymentMethod: payment_method || paymentMethodId,
      status: (status || "PENDING") as P2POrder["status"],
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
      accountName: accountName || account_name,
      accountNumber: accountNumber || account_number,
      buyerWallet,
      sellerWallet,
      adminWallet,
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
      createdAt: order.createdAt,
      created_at: order.created_at,
      updatedAt: Date.now(),
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

// Export P2P Order handlers for use in main server file
export const handleListP2POrdersRoute = handleListP2POrders;
export const handleCreateP2POrderRoute = handleCreateP2POrder;
export const handleGetP2POrderRoute = handleGetP2POrder;
export const handleUpdateP2POrderRoute = handleUpdateP2POrder;
export const handleDeleteP2POrderRoute = handleDeleteP2POrder;

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
