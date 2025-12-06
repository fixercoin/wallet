// Trade rooms storage
let tradeRooms = [];
let tradeMessages = [];

// P2P Orders storage
let p2pOrders = [];

// ===== TRADE ROOMS & MESSAGES =====

export async function handleListTradeRooms(req, res) {
  try {
    const { wallet } = req.query;

    let rooms = tradeRooms;
    if (wallet) {
      rooms = rooms.filter(
        (r) => r.buyer_wallet === wallet || r.seller_wallet === wallet,
      );
    }

    return res.json({
      rooms,
      count: rooms.length,
    });
  } catch (error) {
    console.error("Error listing trade rooms:", error);
    return res.status(500).json({
      error: "Failed to list trade rooms",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleCreateTradeRoom(req, res) {
  try {
    const { buyerWallet, sellerWallet, orderId } = req.body;

    if (!buyerWallet || !sellerWallet || !orderId) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const newRoom = {
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      buyer_wallet: buyerWallet,
      seller_wallet: sellerWallet,
      order_id: orderId,
      created_at: Date.now(),
    };

    tradeRooms.push(newRoom);

    return res.status(201).json(newRoom);
  } catch (error) {
    console.error("Error creating trade room:", error);
    return res.status(500).json({
      error: "Failed to create trade room",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleGetTradeRoom(req, res) {
  try {
    const { roomId } = req.params;

    const room = tradeRooms.find((r) => r.id === roomId);

    if (!room) {
      return res.status(404).json({ error: "Trade room not found" });
    }

    return res.json(room);
  } catch (error) {
    console.error("Error getting trade room:", error);
    return res.status(500).json({
      error: "Failed to get trade room",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleUpdateTradeRoom(req, res) {
  try {
    const { roomId } = req.params;
    const updates = req.body;

    const roomIndex = tradeRooms.findIndex((r) => r.id === roomId);

    if (roomIndex === -1) {
      return res.status(404).json({ error: "Trade room not found" });
    }

    tradeRooms[roomIndex] = { ...tradeRooms[roomIndex], ...updates };

    return res.json(tradeRooms[roomIndex]);
  } catch (error) {
    console.error("Error updating trade room:", error);
    return res.status(500).json({
      error: "Failed to update trade room",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleListTradeMessages(req, res) {
  try {
    const { roomId } = req.params;

    const messages = tradeMessages.filter((m) => m.room_id === roomId);

    return res.json({
      messages,
      count: messages.length,
    });
  } catch (error) {
    console.error("Error listing trade messages:", error);
    return res.status(500).json({
      error: "Failed to list messages",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleAddTradeMessage(req, res) {
  try {
    const { roomId } = req.params;
    const { sender_wallet, message, attachment_url } = req.body;

    if (!sender_wallet || !message) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      room_id: roomId,
      sender_wallet,
      message,
      attachment_url: attachment_url || null,
      created_at: new Date().toISOString(),
    };

    tradeMessages.push(newMessage);

    return res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error adding trade message:", error);
    return res.status(500).json({
      error: "Failed to add message",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// ===== P2P ORDERS =====

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
