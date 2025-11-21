const ordersStore = new Map();
const ADMIN_PASSWORD = "Pakistan##123";

const generateId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const validateAdminToken = (token) => {
  return token === ADMIN_PASSWORD;
};

export async function handleListOrders(req, res) {
  try {
    const { roomId } = req.query;

    let filtered = Array.from(ordersStore.values());

    if (roomId && typeof roomId === "string") {
      filtered = filtered.filter((o) => o.roomId === roomId);
    }

    filtered.sort((a, b) => b.createdAt - a.createdAt);

    res.json({ orders: filtered });
  } catch (error) {
    console.error("List orders error:", error);
    res.status(500).json({ error: "Failed to list orders" });
  }
}

export async function handleCreateOrder(req, res) {
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

    const orderId = generateId("ORDER");
    const order = {
      id: orderId,
      side,
      amountPKR,
      quoteAsset,
      pricePKRPerQuote,
      paymentMethod,
      roomId,
      createdBy,
      createdAt: Date.now(),
      accountName,
      accountNumber,
      walletAddress,
    };

    ordersStore.set(orderId, order);
    res.status(201).json(order);
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
}

export async function handleGetOrder(req, res) {
  try {
    const { orderId } = req.params;
    const order = ordersStore.get(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({ error: "Failed to get order" });
  }
}

export async function handleUpdateOrder(req, res) {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = ordersStore.get(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.status = status;
    ordersStore.set(orderId, order);

    res.json(order);
  } catch (error) {
    console.error("Update order error:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
}

export async function handleDeleteOrder(req, res) {
  try {
    const { orderId } = req.params;

    if (!ordersStore.has(orderId)) {
      return res.status(404).json({ error: "Order not found" });
    }

    ordersStore.delete(orderId);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
}
