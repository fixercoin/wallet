let p2pOrders = []; // In-memory storage, replace with Cloudflare KV in production

export async function handleListP2POrders(req, res) {
  try {
    const { type, status, wallet } = req.query;

    let filtered = p2pOrders;

    if (type) {
      filtered = filtered.filter((o) => o.type === type);
    }

    if (status) {
      filtered = filtered.filter((o) => o.status === status);
    }

    if (wallet) {
      filtered = filtered.filter((o) => o.creator_wallet !== wallet);
    }

    return res.json({
      orders: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error("Error listing P2P orders:", error);
    return res.status(500).json({
      error: "Failed to list orders",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleCreateP2POrder(req, res) {
  try {
    const {
      type,
      token,
      creator_wallet,
      min_amount_tokens,
      max_amount_tokens,
      price_pkr_per_quote,
      payment_method,
    } = req.body;

    if (!type || !token || !creator_wallet) {
      return res.status(400).json({
        error: "Missing required fields: type, token, creator_wallet",
      });
    }

    const newOrder = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      token,
      creator_wallet,
      minAmountTokens: min_amount_tokens || 0,
      maxAmountTokens: max_amount_tokens || Infinity,
      pricePKRPerQuote: price_pkr_per_quote || 280,
      paymentMethodId: payment_method,
      status: "active",
      createdAt: Date.now(),
    };

    p2pOrders.push(newOrder);

    return res.status(201).json(newOrder);
  } catch (error) {
    console.error("Error creating P2P order:", error);
    return res.status(500).json({
      error: "Failed to create order",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleGetP2POrder(req, res) {
  try {
    const { orderId } = req.params;

    const order = p2pOrders.find((o) => o.id === orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json(order);
  } catch (error) {
    console.error("Error getting P2P order:", error);
    return res.status(500).json({
      error: "Failed to get order",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleUpdateP2POrder(req, res) {
  try {
    const { orderId } = req.params;
    const updates = req.body;

    const orderIndex = p2pOrders.findIndex((o) => o.id === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: "Order not found" });
    }

    p2pOrders[orderIndex] = { ...p2pOrders[orderIndex], ...updates };

    return res.json(p2pOrders[orderIndex]);
  } catch (error) {
    console.error("Error updating P2P order:", error);
    return res.status(500).json({
      error: "Failed to update order",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleDeleteP2POrder(req, res) {
  try {
    const { orderId } = req.params;

    const orderIndex = p2pOrders.findIndex((o) => o.id === orderId);

    if (orderIndex === -1) {
      return res.status(404).json({ error: "Order not found" });
    }

    const deleted = p2pOrders.splice(orderIndex, 1);

    return res.json({ success: true, order: deleted[0] });
  } catch (error) {
    console.error("Error deleting P2P order:", error);
    return res.status(500).json({
      error: "Failed to delete order",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
