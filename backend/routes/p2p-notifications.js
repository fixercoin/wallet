let p2pNotifications = []; // In-memory storage, replace with persistent DB in production

export async function handleListNotifications(req, res) {
  try {
    const { wallet, unread } = req.query;

    if (!wallet) {
      return res.status(400).json({
        error: "Missing wallet parameter",
      });
    }

    let filtered = p2pNotifications.filter(
      (n) => n.recipientWallet === wallet,
    );

    if (unread === "true") {
      filtered = filtered.filter((n) => !n.read);
    }

    return res.json({
      data: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error("Error listing notifications:", error);
    return res.status(500).json({
      error: "Failed to list notifications",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleCreateNotification(req, res) {
  try {
    const {
      recipientWallet,
      senderWallet,
      type,
      orderType,
      message,
      orderId,
      orderData,
    } = req.body;

    if (!recipientWallet || !senderWallet || !type || !orderId) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const newNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      recipientWallet,
      senderWallet,
      type,
      orderType,
      message,
      orderData: orderData || {},
      read: false,
      createdAt: Date.now(),
    };

    p2pNotifications.push(newNotification);

    return res.status(201).json(newNotification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({
      error: "Failed to create notification",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleMarkNotificationAsRead(req, res) {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        error: "Missing notificationId",
      });
    }

    const notif = p2pNotifications.find((n) => n.id === notificationId);

    if (!notif) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notif.read = true;

    return res.json(notif);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      error: "Failed to mark as read",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleDeleteNotification(req, res) {
  try {
    const { notificationId } = req.query;

    if (!notificationId) {
      return res.status(400).json({
        error: "Missing notificationId",
      });
    }

    const index = p2pNotifications.findIndex((n) => n.id === notificationId);

    if (index === -1) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const deleted = p2pNotifications.splice(index, 1);

    return res.json({ success: true, notification: deleted[0] });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      error: "Failed to delete notification",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
