import { RequestHandler } from "express";
import { getKVStorage } from "../lib/kv-storage";

export interface OrderNotification {
  id: string;
  orderId: string;
  recipientWallet: string;
  senderWallet: string;
  type:
    | "order_created"
    | "new_buy_order"
    | "new_sell_order"
    | "payment_confirmed"
    | "received_confirmed"
    | "order_cancelled";
  orderType: "BUY" | "SELL";
  message: string;
  orderData: {
    token: string;
    amountTokens: number;
    amountPKR: number;
  };
  read: boolean;
  createdAt: number;
}

// Helper to generate unique ID
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Helper to get all notification IDs for a wallet
async function getNotificationIdsForWallet(
  walletAddress: string,
): Promise<string[]> {
  try {
    const kv = getKVStorage();
    const key = `notifications:wallet:${walletAddress}`;
    const json = await kv.get(key);
    if (!json) return [];
    return JSON.parse(json) || [];
  } catch (error) {
    console.error("[Notifications] Error getting notification IDs:", error);
    return [];
  }
}

// Helper to save notification IDs for a wallet
async function saveNotificationIdsForWallet(
  walletAddress: string,
  notificationIds: string[],
): Promise<void> {
  try {
    const kv = getKVStorage();
    const key = `notifications:wallet:${walletAddress}`;
    await kv.put(key, JSON.stringify(notificationIds));
  } catch (error) {
    console.error("[Notifications] Error saving notification IDs:", error);
    // Don't throw - allow graceful degradation
  }
}

// Helper to get a notification by ID
async function getNotificationById(
  notificationId: string,
): Promise<OrderNotification | null> {
  try {
    const kv = getKVStorage();
    const key = `notifications:${notificationId}`;
    const json = await kv.get(key);
    if (!json) return null;
    return JSON.parse(json);
  } catch (error) {
    console.error(
      "[Notifications] Error getting notification by ID:",
      notificationId,
      error,
    );
    return null;
  }
}

// Helper to save a notification
async function saveNotification(
  notification: OrderNotification,
): Promise<void> {
  try {
    const kv = getKVStorage();
    const key = `notifications:${notification.id}`;
    await kv.put(key, JSON.stringify(notification));

    // Update recipient's notification list
    const notificationIds = await getNotificationIdsForWallet(
      notification.recipientWallet,
    );
    if (!notificationIds.includes(notification.id)) {
      notificationIds.push(notification.id);
      await saveNotificationIdsForWallet(
        notification.recipientWallet,
        notificationIds,
      );
    }
  } catch (error) {
    console.error("[Notifications] Error saving notification:", error);
    // Don't throw - allow graceful degradation
  }
}

// Helper to delete a notification
async function deleteNotificationById(
  notificationId: string,
  walletAddress: string,
): Promise<void> {
  const kv = getKVStorage();
  const key = `notifications:${notificationId}`;
  await kv.delete(key);

  // Update recipient's notification list
  const notificationIds = await getNotificationIdsForWallet(walletAddress);
  const filtered = notificationIds.filter((id) => id !== notificationId);
  await saveNotificationIdsForWallet(walletAddress, filtered);
}

// List notifications for a wallet
export const handleListNotifications: RequestHandler = async (req, res) => {
  try {
    const { wallet, unread, includeBroadcast } = req.query;

    if (!wallet) {
      return res.status(400).json({
        error: "Missing wallet parameter",
      });
    }

    const walletAddress = String(wallet).toLowerCase().trim();
    const notificationIds = await getNotificationIdsForWallet(walletAddress);

    let notifications: OrderNotification[] = [];

    for (const notificationId of notificationIds) {
      const notification = await getNotificationById(notificationId);
      if (notification) {
        notifications.push(notification);
      }
    }

    // Include broadcast notifications if requested
    // Sellers get "BROADCAST_SELLERS" queue (generic buy orders)
    // Buyers get "BROADCAST_BUYERS" queue (generic sell orders)
    if (includeBroadcast === "true") {
      try {
        const kv = getKVStorage();
        // Get both seller and buyer broadcast queues
        const sellerBroadcastJson = await kv.get(
          "notifications:broadcast:sellers",
        );
        if (sellerBroadcastJson) {
          const broadcastNotifications = JSON.parse(sellerBroadcastJson);
          notifications.push(...broadcastNotifications);
        }

        const buyerBroadcastJson = await kv.get(
          "notifications:broadcast:buyers",
        );
        if (buyerBroadcastJson) {
          const broadcastNotifications = JSON.parse(buyerBroadcastJson);
          notifications.push(...broadcastNotifications);
        }
      } catch (error) {
        console.warn("[Notifications] Failed to get broadcast queues:", error);
      }
    }

    // Filter by read status if requested
    if (unread === "true") {
      notifications = notifications.filter((n) => !n.read);
    }

    // Sort by creation date (newest first)
    notifications.sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({
      data: notifications,
      total: notifications.length,
    });
  } catch (error) {
    console.error("[Notifications] List notifications error:", error);
    // Return empty notifications array instead of 500 error for graceful degradation
    return res.status(200).json({
      data: [],
      total: 0,
      warning: "Could not retrieve notifications. Storage may be unavailable.",
    });
  }
};

// Create notification
export const handleCreateNotification: RequestHandler = async (req, res) => {
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

    if (
      !recipientWallet ||
      !senderWallet ||
      !type ||
      !orderType ||
      !orderId ||
      !orderData
    ) {
      return res.status(400).json({
        error:
          "Missing required fields: recipientWallet, senderWallet, type, orderType, orderId, orderData",
      });
    }

    const id = generateId("notif");
    const now = Date.now();

    const notification: OrderNotification = {
      id,
      orderId,
      recipientWallet: recipientWallet.toLowerCase().trim(),
      senderWallet: senderWallet.toLowerCase().trim(),
      type,
      orderType,
      message,
      orderData,
      read: false,
      createdAt: now,
    };

    await saveNotification(notification);

    // For broadcast notifications, store in appropriate broadcast queue
    const lowerWallet = recipientWallet.toLowerCase();
    if (lowerWallet.includes("broadcast")) {
      try {
        const kv = getKVStorage();
        let broadcastKey = "notifications:broadcast";

        // Use different queues for sellers vs buyers
        if (lowerWallet === "broadcast_sellers") {
          broadcastKey = "notifications:broadcast:sellers";
        } else if (lowerWallet === "broadcast_buyers") {
          broadcastKey = "notifications:broadcast:buyers";
        }

        const broadcastJson = await kv.get(broadcastKey);
        const broadcastNotifications = broadcastJson
          ? JSON.parse(broadcastJson)
          : [];
        broadcastNotifications.push(notification);
        // Keep only last 100 broadcast notifications
        if (broadcastNotifications.length > 100) {
          broadcastNotifications.shift();
        }
        await kv.put(broadcastKey, JSON.stringify(broadcastNotifications));
      } catch (error) {
        console.warn(
          "[Notifications] Failed to add to broadcast queue:",
          error,
        );
        // Don't fail the request if broadcast queue fails
      }
    }

    res.status(201).json({ notification });
  } catch (error) {
    console.error("Create notification error:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
};

// Mark notification as read
export const handleMarkNotificationAsRead: RequestHandler = async (
  req,
  res,
) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        error: "Missing notificationId",
      });
    }

    const notification = await getNotificationById(notificationId);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notification.read = true;
    await saveNotification(notification);

    res.json({ notification });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

// Delete notification
export const handleDeleteNotification: RequestHandler = async (req, res) => {
  try {
    const { notificationId } = req.body;
    const { wallet } = req.query;

    if (!notificationId || !wallet) {
      return res.status(400).json({
        error: "Missing notificationId or wallet",
      });
    }

    const notification = await getNotificationById(notificationId);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await deleteNotificationById(notificationId, String(wallet));

    res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};
