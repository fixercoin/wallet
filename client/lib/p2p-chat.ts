import { useDurableRoom } from "@/hooks/useDurableRoom";

export interface ChatMessage {
  id: string;
  roomId: string;
  senderWallet: string;
  senderRole: "buyer" | "seller";
  type: string;
  text: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface ChatNotification {
  type: "trade_initiated" | "message" | "status_change" | "payment_received";
  roomId: string;
  initiatorWallet: string;
  initiatorRole: "buyer" | "seller";
  message: string;
  data?: Record<string, any>;
  timestamp: number;
}

const CHAT_STORAGE_PREFIX = "p2p_chat_";
const NOTIFICATIONS_KEY = "p2p_notifications";

// Store chat messages locally
export function saveChatMessage(message: ChatMessage) {
  try {
    const key = `${CHAT_STORAGE_PREFIX}${message.roomId}`;
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push(message);
    localStorage.setItem(key, JSON.stringify(existing.slice(-100))); // Keep last 100 messages
  } catch (e) {
    console.error("Failed to save chat message", e);
  }
}

// Load chat history for a room
export function loadChatHistory(roomId: string): ChatMessage[] {
  try {
    const key = `${CHAT_STORAGE_PREFIX}${roomId}`;
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

// Store notifications for both parties
export function saveNotification(notification: ChatNotification) {
  try {
    const existing = JSON.parse(
      localStorage.getItem(NOTIFICATIONS_KEY) || "[]",
    );
    existing.push(notification);
    localStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(existing.slice(-50)),
    ); // Keep last 50
  } catch (e) {
    console.error("Failed to save notification", e);
  }
}

// Get unread notifications
export function getUnreadNotifications(wallet: string): ChatNotification[] {
  try {
    const all = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
    return all.filter((n: ChatNotification) => n.initiatorWallet !== wallet);
  } catch {
    return [];
  }
}

// Get payment received notifications for seller
export function getPaymentReceivedNotifications(
  sellerWallet: string,
): ChatNotification[] {
  try {
    const all = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
    return all.filter(
      (n: ChatNotification) =>
        n.type === "payment_received" && n.initiatorWallet !== sellerWallet,
    );
  } catch {
    return [];
  }
}

// Clear notifications for a room
export function clearNotificationsForRoom(roomId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
    const filtered = all.filter((n: ChatNotification) => n.roomId !== roomId);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to clear notifications", e);
  }
}

// Send notification to WebSocket room
export function broadcastNotification(
  send: any,
  notification: ChatNotification,
) {
  try {
    send?.({
      kind: "notification",
      data: notification,
    });
  } catch (e) {
    console.error("Failed to broadcast notification", e);
  }
}

// Send chat message via WebSocket
export function sendChatMessage(send: any, message: ChatMessage) {
  try {
    send?.({
      type: "chat",
      text: JSON.stringify(message),
    });
  } catch (e) {
    console.error("Failed to send chat message", e);
  }
}

// Parse incoming message from WebSocket
export function parseWebSocketMessage(text: string): ChatMessage | null {
  try {
    const data = JSON.parse(text);
    if (
      data.roomId &&
      data.senderWallet &&
      data.type &&
      data.timestamp !== undefined
    ) {
      return data as ChatMessage;
    }
  } catch {
    return null;
  }
  return null;
}
