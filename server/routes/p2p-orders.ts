import { RequestHandler } from "express";
import { getKVStorage } from "../lib/kv-storage";

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
  minAmountPKR?: number;
  maxAmountPKR?: number;
  minAmountTokens?: number;
  maxAmountTokens?: number;
  pricePKRPerQuote?: number;
  payment_method?: string;
  paymentMethodId?: string;
  status:
    | "PENDING"
    | "active"
    | "pending"
    | "completed"
    | "cancelled"
    | "disputed"
    | "EXPIRED";
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
  sellerVerified?: boolean;
  sellerPaymentMethodVerified?: boolean;
  expiresAt?: number;
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
  buyerPaymentConfirmed?: boolean;
  sellerPaymentConfirmed?: boolean;
  buyerConfirmedAt?: number;
  sellerConfirmedAt?: number;
}

// In-memory stores for trade rooms and messages
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
    minAmountPKR: order.minAmountPKR,
    maxAmountPKR: order.maxAmountPKR,
    minAmountTokens: order.minAmountTokens,
    maxAmountTokens: order.maxAmountTokens,
    pricePKRPerQuote: order.pricePKRPerQuote,
    payment_method: order.paymentMethod || order.payment_method,
    status: (order.status || "PENDING") as P2POrder["status"],
    createdAt: order.createdAt || order.created_at || Date.now(),
    updatedAt: order.updatedAt || order.updated_at || Date.now(),
    accountName: order.accountName || order.account_name,
    accountNumber: order.accountNumber || order.account_number,
    buyerWallet: order.buyerWallet,
    sellerWallet: order.sellerWallet,
    adminWallet: order.adminWallet,
    sellerVerified: order.sellerVerified || false,
    sellerPaymentMethodVerified: order.sellerPaymentMethodVerified || false,
    expiresAt: order.expiresAt,
  };
}

// Helper to check if order has expired (15 minutes)
function isOrderExpired(order: P2POrder): boolean {
  const ORDER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  const expiresAt =
    order.expiresAt || (order.createdAt || 0) + ORDER_TIMEOUT_MS;
  return Date.now() > expiresAt;
}

// Helper to verify seller has payment method
async function sellerHasVerifiedPaymentMethod(
  walletAddress: string,
): Promise<boolean> {
  const kv = getKVStorage();
  const paymentMethodsKey = `payment_methods:${walletAddress}`;
  const json = await kv.get(paymentMethodsKey);
  if (!json) return false;

  try {
    const paymentMethods = JSON.parse(json);
    return Array.isArray(paymentMethods) && paymentMethods.length > 0;
  } catch {
    return false;
  }
}

// Helper functions
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Helper to get all order IDs for a wallet
async function getOrderIdsForWallet(walletAddress: string): Promise<string[]> {
  const kv = getKVStorage();
  const key = `orders:wallet:${walletAddress}`;
  const json = await kv.get(key);
  return json ? JSON.parse(json) : [];
}

// Helper to save order IDs for a wallet
async function saveOrderIdsForWallet(
  walletAddress: string,
  orderIds: string[],
): Promise<void> {
  const kv = getKVStorage();
  const key = `orders:wallet:${walletAddress}`;
  await kv.put(key, JSON.stringify(orderIds));
}

// Helper to get an order by ID
async function getOrderById(orderId: string): Promise<P2POrder | null> {
  const kv = getKVStorage();
  const key = `orders:${orderId}`;
  const json = await kv.get(key);
  return json ? JSON.parse(json) : null;
}

// Helper to save an order
async function saveOrder(order: P2POrder): Promise<void> {
  const kv = getKVStorage();
  const key = `orders:${order.id}`;
  await kv.put(key, JSON.stringify(order));

  // Update wallet's order list
  const walletAddress = order.walletAddress || order.creator_wallet;
  if (walletAddress) {
    const orderIds = await getOrderIdsForWallet(walletAddress);
    if (!orderIds.includes(order.id)) {
      orderIds.push(order.id);
      await saveOrderIdsForWallet(walletAddress, orderIds);
    }
  }
}

// Helper to delete an order
async function deleteOrderById(
  orderId: string,
  walletAddress: string,
): Promise<void> {
  const kv = getKVStorage();
  const key = `orders:${orderId}`;
  await kv.delete(key);

  // Update wallet's order list
  const orderIds = await getOrderIdsForWallet(walletAddress);
  const filtered = orderIds.filter((id) => id !== orderId);
  await saveOrderIdsForWallet(walletAddress, filtered);
}

/**
 * Helper to get a specific order by ID with better logging
 */
async function getOrderByIdWithLogging(
  orderId: string,
): Promise<P2POrder | null> {
  try {
    const order = await getOrderById(orderId);
    if (!order) {
      console.warn(`[P2P Orders] Order not found in KV: ${orderId}`);
    } else {
      console.log(`[P2P Orders] Found order: ${orderId}`);
    }
    return order;
  } catch (error) {
    console.error(`[P2P Orders] Error fetching order ${orderId}:`, error);
    return null;
  }
}

// P2P Orders endpoints
export const handleListP2POrders: RequestHandler = async (req, res) => {
  try {
    const { type, status, token, wallet, id } = req.query;

    let filtered: P2POrder[] = [];

    if (id) {
      // Get single order by ID
      const order = await getOrderById(id as string);
      if (order) {
        filtered.push(order);
      }
    } else {
      // Get all orders from KV
      const kv = getKVStorage();
      const listResult = await kv.list();
      const keys = listResult.keys || [];

      for (const key of keys) {
        if (key.name.startsWith("orders:") && !key.name.includes("wallet:")) {
          const order = await getOrderById(key.name.replace("orders:", ""));
          if (order) {
            filtered.push(order);
          }
        }
      }
    }

    // Apply filters
    if (wallet) {
      // Normalize wallet address for comparison (handle both formats)
      const queryWallet = String(wallet).toLowerCase().trim();
      filtered = filtered.filter((o) => {
        const orderWallet = (o.walletAddress || o.creator_wallet || "")
          .toLowerCase()
          .trim();
        return orderWallet === queryWallet;
      });
    }
    if (type) {
      filtered = filtered.filter((o) => o.type === String(type).toUpperCase());
    }
    if (status) {
      // Case-insensitive status comparison and treat "active", "PENDING", "pending" as equivalent for active orders
      const statusFilter = String(status).toLowerCase();
      const activeStatuses = ["active", "pending"];

      if (activeStatuses.includes(statusFilter)) {
        // If looking for active/pending, include all active-like statuses
        filtered = filtered.filter((o) => {
          const orderStatus = String(o.status).toLowerCase();
          return activeStatuses.includes(orderStatus);
        });
      } else {
        // For other statuses, do exact match (case-insensitive)
        filtered = filtered.filter(
          (o) => String(o.status).toLowerCase() === statusFilter,
        );
      }
    }
    if (token) {
      filtered = filtered.filter((o) => o.token === token);
    }

    // Check for expired orders and update their status
    for (let i = 0; i < filtered.length; i++) {
      const order = filtered[i];
      if (
        isOrderExpired(order) &&
        order.status !== "EXPIRED" &&
        (order.status === "PENDING" ||
          order.status === "active" ||
          order.status === "pending")
      ) {
        order.status = "EXPIRED";
        await saveOrder(order);
      }
    }

    // Filter out expired orders from results
    const activeOrders = filtered.filter((o) => o.status !== "EXPIRED");

    activeOrders.sort(
      (a, b) =>
        (b.createdAt || b.created_at || 0) - (a.createdAt || a.created_at || 0),
    );

    res.json({ orders: activeOrders });
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
      minAmountPKR,
      maxAmountPKR,
      minAmountTokens,
      maxAmountTokens,
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
    const finalAmount =
      amountTokens !== undefined ? amountTokens : parseFloat(token_amount || 0);
    const finalPKR =
      amountPKR !== undefined ? amountPKR : parseFloat(pkr_amount || 0);
    const finalPrice = pricePKRPerQuote;

    if (!finalType || !finalWallet || !finalToken) {
      return res.status(400).json({
        error:
          "Missing required fields: type, walletAddress (or creator_wallet), and token",
      });
    }

    // For SELL orders, verify seller has payment method
    // Allow order creation without payment method verification for now
    // if (finalType === "SELL") {
    //   const hasPaymentMethod =
    //     await sellerHasVerifiedPaymentMethod(finalWallet);
    //   if (!hasPaymentMethod) {
    //     return res.status(400).json({
    //       error:
    //         "Seller must have at least one verified payment method to create a SELL order",
    //       code: "SELLER_NO_PAYMENT_METHOD",
    //     });
    //   }
    // }

    const id = orderId || generateId("order");
    const now = Date.now();
    const ORDER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

    const order: any = {
      id,
      type: finalType as "BUY" | "SELL",
      walletAddress: finalWallet,
      creator_wallet: finalWallet,
      token: finalToken,
      amountTokens: finalAmount,
      amountPKR: finalPKR,
      pricePKRPerQuote: finalPrice,
      payment_method: payment_method || paymentMethodId,
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
      expiresAt: now + ORDER_TIMEOUT_MS,
      sellerVerified: finalType === "SELL",
      sellerPaymentMethodVerified: finalType === "SELL",
      // Marketplace fields for min/max amounts
      ...(minAmountPKR !== undefined && { minAmountPKR }),
      ...(maxAmountPKR !== undefined && { maxAmountPKR }),
      ...(minAmountTokens !== undefined && { minAmountTokens }),
      ...(maxAmountTokens !== undefined && { maxAmountTokens }),
    };

    await saveOrder(order);

    res.status(201).json({ order });
  } catch (error) {
    console.error("Create P2P order error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const handleGetP2POrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId || typeof orderId !== "string") {
      return res.status(400).json({
        error: "Invalid order ID",
        details: "Order ID must be a non-empty string",
      });
    }

    console.log(`[P2P Orders] GET request for order: ${orderId}`);
    const order = await getOrderByIdWithLogging(orderId);

    if (!order) {
      // Provide helpful error message with diagnostic info
      return res.status(404).json({
        error: "Order not found",
        orderId,
        details:
          "Order does not exist in KV storage. Check that the order was created successfully and synced to the server.",
        hint: "Call /api/p2p/orders with wallet parameter to list all orders for a wallet",
      });
    }

    console.log(`[P2P Orders] Returning order ${orderId} with fields:`, {
      id: order.id,
      status: order.status,
      sellerTransferInitiated: order.sellerTransferInitiated,
      buyerCryptoReceived: order.buyerCryptoReceived,
      sellerPaymentReceived: order.sellerPaymentReceived,
    });

    // Return in consistent format with list endpoint
    res.json({
      success: true,
      orders: [order],
      order,
    });
  } catch (error) {
    console.error("Get P2P order error:", error);
    res.status(500).json({
      error: "Failed to get order",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export const handleUpdateP2POrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    console.log(`[P2P Orders] Updating order ${orderId}:`, req.body);

    const updated: any = {
      ...order,
      ...req.body,
      id: order.id,
      createdAt: order.createdAt,
      created_at: order.created_at,
      updatedAt: Date.now(),
      updated_at: Date.now(),
      // Preserve marketplace fields if not in update body
      ...(req.body.minAmountPKR !== undefined && {
        minAmountPKR: req.body.minAmountPKR,
      }),
      ...(req.body.maxAmountPKR !== undefined && {
        maxAmountPKR: req.body.maxAmountPKR,
      }),
      ...(req.body.minAmountTokens !== undefined && {
        minAmountTokens: req.body.minAmountTokens,
      }),
      ...(req.body.maxAmountTokens !== undefined && {
        maxAmountTokens: req.body.maxAmountTokens,
      }),
      ...(req.body.pricePKRPerQuote !== undefined && {
        pricePKRPerQuote: req.body.pricePKRPerQuote,
      }),
    };

    console.log(`[P2P Orders] Updated order state:`, {
      id: updated.id,
      status: updated.status,
      sellerTransferInitiated: updated.sellerTransferInitiated,
      buyerCryptoReceived: updated.buyerCryptoReceived,
      sellerPaymentReceived: updated.sellerPaymentReceived,
    });

    await saveOrder(updated);

    console.log(`[P2P Orders] ✅ Successfully updated order ${orderId}`);

    res.json({ order: updated });
  } catch (error) {
    console.error("Update P2P order error:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
};

export const handleDeleteP2POrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const walletAddress =
      (req.query.wallet as string) ||
      (req.body.walletAddress as string) ||
      (req.body.creator_wallet as string) ||
      "";

    if (!walletAddress) {
      return res.status(400).json({
        error: "Missing wallet address",
      });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    await deleteOrderById(orderId, walletAddress);
    res.json({ message: "Order deleted" });
  } catch (error) {
    console.error("Delete P2P order error:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
};

// Trade Rooms endpoints
export const handleListTradeRooms: RequestHandler = async (req, res) => {
  try {
    const { buyer_wallet, seller_wallet, status } = req.query;

    let filtered = Array.from(rooms.values());

    if (buyer_wallet)
      filtered = filtered.filter((r) => r.buyer_wallet === buyer_wallet);
    if (seller_wallet)
      filtered = filtered.filter((r) => r.seller_wallet === seller_wallet);
    if (status) filtered = filtered.filter((r) => r.status === status);

    res.json({ rooms: filtered });
  } catch (error) {
    console.error("List trade rooms error:", error);
    res.status(500).json({ error: "Failed to list trade rooms" });
  }
};

export const handleCreateTradeRoom: RequestHandler = async (req, res) => {
  try {
    const { buyer_wallet, seller_wallet, order_id } = req.body;

    if (!buyer_wallet || !seller_wallet || !order_id) {
      return res.status(400).json({
        error: "Missing required fields",
      });
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
    res.status(500).json({ error: "Failed to create trade room" });
  }
};

export const handleGetTradeRoom: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Trade room not found" });
    }

    res.json({ room });
  } catch (error) {
    console.error("Get trade room error:", error);
    res.status(500).json({ error: "Failed to get trade room" });
  }
};

export const handleUpdateTradeRoom: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: "Trade room not found" });
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
    res.status(500).json({ error: "Failed to update trade room" });
  }
};

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
    const { sender_wallet, message } = req.body;

    if (!sender_wallet || !message) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const roomMessages = messages.get(roomId) || [];
    const msg = {
      id: generateId("msg"),
      sender_wallet,
      message,
      created_at: Date.now(),
    };

    roomMessages.push(msg);
    messages.set(roomId, roomMessages);

    res.status(201).json({ message: msg });
  } catch (error) {
    console.error("Add trade message error:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
};

export const handleConfirmPayment: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { walletAddress } = req.body;

    if (!roomId || !walletAddress) {
      return res.status(400).json({
        error: "Missing required fields: roomId, walletAddress",
      });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: "Trade room not found" });
    }

    // Determine if this is the buyer or seller
    const isBuyer = room.buyer_wallet === walletAddress;
    const isSeller = room.seller_wallet === walletAddress;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        error: "Wallet is not part of this trade",
      });
    }

    // Mark payment as confirmed for this party
    const updated: any = {
      ...room,
      updatedAt: Date.now(),
      updated_at: Date.now(),
    };

    if (isBuyer) {
      updated.buyerPaymentConfirmed = true;
      updated.buyerConfirmedAt = Date.now();
    } else {
      updated.sellerPaymentConfirmed = true;
      updated.sellerConfirmedAt = Date.now();
    }

    // If both parties have confirmed, auto-release escrow and mark order as payment_confirmed
    if (updated.buyerPaymentConfirmed && updated.sellerPaymentConfirmed) {
      updated.status = "payment_confirmed";

      // Also update the order status to reflect payment confirmation
      const order = await getOrderById(room.order_id);
      if (order) {
        order.status = "payment_confirmed" as P2POrder["status"];
        order.updatedAt = Date.now();
        order.updated_at = Date.now();
        await saveOrder(order);
      }
    }

    rooms.set(roomId, updated);
    res.json({
      room: updated,
      autoReleased:
        updated.buyerPaymentConfirmed && updated.sellerPaymentConfirmed,
      message:
        updated.buyerPaymentConfirmed && updated.sellerPaymentConfirmed
          ? "Both parties confirmed payment. Escrow will be released."
          : `${isBuyer ? "Buyer" : "Seller"} confirmed payment. Waiting for ${isBuyer ? "seller" : "buyer"} confirmation.`,
    });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
};

// NEW: Get order status for polling (real-time P2P flow)
export const handleGetOrderStatus: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId" });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      orderId: order.id,
      status: order.status,
      buyerPaymentSent: (order as any).buyerPaymentSent || false,
      sellerReceivedPayment: (order as any).sellerReceivedPayment || false,
      sellerCryptoSent: (order as any).sellerCryptoSent || false,
      buyerReceivedCrypto: (order as any).buyerReceivedCrypto || false,
      updatedAt: order.updatedAt || order.updated_at || Date.now(),
    });
  } catch (error) {
    console.error("Get order status error:", error);
    res.status(500).json({ error: "Failed to get order status" });
  }
};

// NEW: Update order status for real-time P2P flow
export const handleUpdateOrderStatus: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      buyerPaymentSent,
      sellerReceivedPayment,
      sellerCryptoSent,
      buyerReceivedCrypto,
    } = req.body;

    console.log(`[P2P Orders] Updating status for order ${orderId}:`, {
      buyerPaymentSent,
      sellerReceivedPayment,
      sellerCryptoSent,
      buyerReceivedCrypto,
    });

    if (!orderId) {
      return res.status(400).json({
        error: "Missing orderId",
        received: { orderId, params: req.params },
      });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      console.error(
        `[P2P Orders] Order not found for status update: ${orderId}`,
      );
      return res.status(404).json({
        error: "Order not found",
        orderId,
        hint: "The order does not exist in KV storage. Check that the order was created successfully.",
      });
    }

    console.log(`[P2P Orders] Found order ${orderId}, updating fields...`);

    // Update order status fields
    if (buyerPaymentSent !== undefined)
      (order as any).buyerPaymentSent = buyerPaymentSent;
    if (sellerReceivedPayment !== undefined)
      (order as any).sellerReceivedPayment = sellerReceivedPayment;
    if (sellerCryptoSent !== undefined)
      (order as any).sellerCryptoSent = sellerCryptoSent;
    if (buyerReceivedCrypto !== undefined)
      (order as any).buyerReceivedCrypto = buyerReceivedCrypto;

    order.updatedAt = Date.now();
    order.updated_at = Date.now();

    await saveOrder(order);

    console.log(
      `[P2P Orders] ✅ Successfully updated order status for ${orderId}`,
    );

    res.json({
      orderId: order.id,
      status: order.status,
      buyerPaymentSent: (order as any).buyerPaymentSent || false,
      sellerReceivedPayment: (order as any).sellerReceivedPayment || false,
      sellerCryptoSent: (order as any).sellerCryptoSent || false,
      buyerReceivedCrypto: (order as any).buyerReceivedCrypto || false,
      updatedAt: order.updatedAt || order.updated_at || Date.now(),
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      error: "Failed to update order status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// NEW: Complete P2P order
export const handleCompleteP2POrder: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { walletAddress } = req.body;

    if (!orderId) {
      return res.status(400).json({
        error: "Missing orderId",
      });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      console.error(`[P2P Orders] Order not found for completion: ${orderId}`);
      return res.status(404).json({
        error: "Order not found",
        orderId,
      });
    }

    // Verify wallet is part of this order
    const isParticipant =
      walletAddress === order.creator_wallet ||
      walletAddress === order.buyer_wallet ||
      (order.walletAddress && walletAddress === order.walletAddress);

    if (!isParticipant) {
      return res.status(403).json({
        error: "You are not a participant in this order",
      });
    }

    // Update order status to completed
    order.status = "completed";
    order.updatedAt = Date.now();
    order.updated_at = Date.now();

    await saveOrder(order);

    console.log(`[P2P Orders] ✅ Successfully completed order ${orderId}`);

    res.json({
      orderId: order.id,
      status: "completed",
      message: "Order completed successfully",
      completedAt: Date.now(),
    });
  } catch (error) {
    console.error("Complete order error:", error);
    res.status(500).json({
      error: "Failed to complete order",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
