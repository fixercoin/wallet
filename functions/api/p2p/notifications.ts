/**
 * GET/POST /api/p2p/notifications
 * Manage P2P order notifications using Cloudflare KV
 */

import { KVStore } from "../../lib/kv-utils";

interface Env {
  STAKING_KV: any;
  [key: string]: any;
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

export const onRequestGet = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");
    const unreadOnly = url.searchParams.get("unread") === "true";
    const includeBroadcast =
      url.searchParams.get("includeBroadcast") === "true";

    if (!walletAddress) {
      return jsonResponse(400, { error: "Missing wallet address" });
    }

    const kvStore = new KVStore(env.STAKING_KV);
    let notifications = await kvStore.getNotificationsByWallet(walletAddress);

    if (includeBroadcast) {
      try {
        const broadcastSellerNotifications =
          await kvStore.getBroadcastNotifications("sellers");
        const broadcastBuyerNotifications =
          await kvStore.getBroadcastNotifications("buyers");
        notifications = [
          ...notifications,
          ...broadcastSellerNotifications,
          ...broadcastBuyerNotifications,
        ];
      } catch (error) {
        console.warn("Failed to fetch broadcast notifications:", error);
      }
    }

    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }

    notifications.sort((a, b) => b.createdAt - a.createdAt);

    return jsonResponse(200, {
      success: true,
      data: notifications,
      count: notifications.length,
    });
  } catch (error) {
    console.error("Error in /api/p2p/notifications GET:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const body = await request.json();
    const {
      recipientWallet,
      senderWallet,
      type,
      orderType,
      message,
      orderId,
      orderData,
    } = body;

    if (!recipientWallet || !senderWallet || !type || !orderType || !orderId) {
      return jsonResponse(400, {
        error: "Missing required fields",
      });
    }

    if (!["BUY", "SELL"].includes(orderType)) {
      return jsonResponse(400, { error: "Invalid order type" });
    }

    const validTypes = [
      "order_created",
      "new_buy_order",
      "new_sell_order",
      "payment_confirmed",
      "seller_payment_received",
      "transfer_initiated",
      "crypto_received",
      "order_cancelled",
      "order_accepted",
      "order_rejected",
      "order_completed_by_seller",
    ];
    if (!validTypes.includes(type)) {
      return jsonResponse(400, { error: "Invalid notification type" });
    }

    const kvStore = new KVStore(env.STAKING_KV);

    const notificationType = type as
      | "order_created"
      | "new_buy_order"
      | "new_sell_order"
      | "payment_confirmed"
      | "seller_payment_received"
      | "transfer_initiated"
      | "crypto_received"
      | "order_cancelled"
      | "order_accepted"
      | "order_rejected"
      | "order_completed_by_seller";

    const savedNotification = await kvStore.saveNotification({
      orderId,
      recipientWallet,
      senderWallet,
      type: notificationType,
      orderType: orderType as "BUY" | "SELL",
      message,
      orderData: orderData || {},
      read: false,
    });

    // If this is a broadcast notification, also save to broadcast queue
    const lowerWallet = recipientWallet.toLowerCase();
    if (lowerWallet.includes("broadcast")) {
      try {
        let broadcastKey = "notifications:broadcast";
        if (lowerWallet === "broadcast_sellers") {
          broadcastKey = "notifications:broadcast:sellers";
        } else if (lowerWallet === "broadcast_buyers") {
          broadcastKey = "notifications:broadcast:buyers";
        }

        const broadcastJson = await env.STAKING_KV.get(broadcastKey);
        const broadcastNotifications = broadcastJson
          ? JSON.parse(broadcastJson)
          : [];
        broadcastNotifications.push(savedNotification);
        // Keep only last 100 broadcast notifications
        if (broadcastNotifications.length > 100) {
          broadcastNotifications.shift();
        }
        await env.STAKING_KV.put(
          broadcastKey,
          JSON.stringify(broadcastNotifications),
        );
      } catch (error) {
        console.warn("Failed to add to broadcast queue:", error);
        // Don't fail the request if broadcast queue fails
      }
    }

    return jsonResponse(200, {
      success: true,
      data: savedNotification,
    });
  } catch (error) {
    console.error("Error in /api/p2p/notifications POST:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestPut = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    if (!env.STAKING_KV) {
      return jsonResponse(500, {
        error: "KV storage not configured",
      });
    }

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return jsonResponse(400, { error: "Missing notification ID" });
    }

    const kvStore = new KVStore(env.STAKING_KV);
    await kvStore.markNotificationAsRead(notificationId);

    return jsonResponse(200, {
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error in /api/p2p/notifications PUT:", error);
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
