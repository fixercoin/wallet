import { RequestHandler } from "express";

interface Order {
  id: string;
  side: "buy" | "sell";
  amountPKR: number;
  quoteAsset: string;
  pricePKRPerQuote: number;
  paymentMethod: string;
  roomId: string;
  createdBy: string;
  createdAt: number;
  accountName?: string;
  accountNumber?: string;
  walletAddress?: string;
}

// In-memory store for orders (will be replaced with database in production)
const ordersStore = new Map<string, Order>();

// Admin password for validation
const ADMIN_PASSWORD = "Pakistan##123";

const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const validateAdminToken = (token: string): boolean => {
  return token === ADMIN_PASSWORD;
};

export const handleListOrders: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.query;

    let filtered = Array.from(ordersStore.values());

    if (roomId && typeof roomId === "string") {
      filtered = filtered.filter((o) => o.roomId === roomId);
    }

    // Sort by created date, newest first
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    res.json({ orders: filtered });
  } catch (error) {
    console.error("List orders error:", error);
    res.status(500).json({ error: "Failed to list orders" });
  }
};

export const handleCreateOrder: RequestHandler = async (req, res) => {
  try {
    const {
      side,
      amountPKR,
      quoteAsset,
      pricePKRPerQuote,
      paymentMethod,
      roomId = "global",
      createdBy,
      accountName,
      accountNumber,
      walletAddress,
    } = req.body;

    // Validate required fields
    if (
      !side ||
      !amountPKR ||
      !quoteAsset ||
      !pricePKRPerQuote ||
      !paymentMethod
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: side, amountPKR, quoteAsset, pricePKRPerQuote, paymentMethod",
      });
    }

    // Validate authorization
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token || !validateAdminToken(token)) {
      return res
        .status(401)
        .json({ error: "Unauthorized: invalid or missing admin token" });
    }

    // Validate numeric fields
    const amount = Number(amountPKR);
    const price = Number(pricePKRPerQuote);

    if (!isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid amountPKR: must be a positive number" });
    }

    if (!isFinite(price) || price <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid pricePKRPerQuote: must be a positive number" });
    }

    // Create order
    const id = generateId("order");
    const now = Date.now();

    const order: Order = {
      id,
      side: side as "buy" | "sell",
      amountPKR: amount,
      quoteAsset,
      pricePKRPerQuote: price,
      paymentMethod,
      roomId,
      createdBy: createdBy || "admin",
      createdAt: now,
      accountName,
      accountNumber,
      walletAddress,
    };

    ordersStore.set(id, order);

    res.status(201).json({ order });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const handleGetOrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = ordersStore.get(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ order });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({ error: "Failed to get order" });
  }
};

export const handleUpdateOrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate authorization
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token || !validateAdminToken(token)) {
      return res
        .status(401)
        .json({ error: "Unauthorized: invalid or missing admin token" });
    }

    const order = ordersStore.get(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updated: Order = {
      ...order,
      ...req.body,
      id: order.id,
      createdAt: order.createdAt,
    };

    ordersStore.set(orderId, updated);
    res.json({ order: updated });
  } catch (error) {
    console.error("Update order error:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
};

export const handleDeleteOrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate authorization
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token || !validateAdminToken(token)) {
      return res
        .status(401)
        .json({ error: "Unauthorized: invalid or missing admin token" });
    }

    if (!ordersStore.has(orderId)) {
      return res.status(404).json({ error: "Order not found" });
    }

    ordersStore.delete(orderId);
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
};
