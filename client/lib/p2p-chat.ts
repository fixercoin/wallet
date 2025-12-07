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

export interface ServerMessage {
  id: string;
  room_id: string;
  sender_wallet: string;
  message: string;
  attachment_url?: string;
  created_at: number;
}

const CHAT_STORAGE_PREFIX = "p2p_chat_";
const NOTIFICATIONS_KEY = "p2p_notifications";
const API_BASE =
  (import.meta as any).env?.VITE_P2P_API || window.location.origin;

// WebSocket connection pool
const wsConnections: Map<string, WebSocket> = new Map();

// Store chat messages locally (fallback)
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

// Load chat history for a room (fallback)
export function loadChatHistory(roomId: string): ChatMessage[] {
  try {
    const key = `${CHAT_STORAGE_PREFIX}${roomId}`;
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

// SERVER-SIDE: Load chat history from server (source of truth)
export async function loadServerChatHistory(
  roomId: string,
): Promise<ChatMessage[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/p2p/rooms/${encodeURIComponent(roomId)}/messages`,
    );
    if (!res.ok) return loadChatHistory(roomId); // Fallback to localStorage

    const data = await res.json();
    const messages = data.messages || [];

    // Convert server messages to ChatMessage format
    return messages.map((msg: ServerMessage) => ({
      id: msg.id,
      roomId: roomId,
      senderWallet: msg.sender_wallet,
      senderRole: "buyer" as const, // Will be determined by order context
      type: "message",
      text: msg.message,
      metadata: msg.attachment_url
        ? { attachmentUrl: msg.attachment_url }
        : undefined,
      timestamp: msg.created_at,
    }));
  } catch (error) {
    console.error("Failed to load server chat history:", error);
    return loadChatHistory(roomId); // Fallback to localStorage
  }
}

// SERVER-SIDE: Save message to server (source of truth)
export async function saveServerChatMessage(
  roomId: string,
  senderWallet: string,
  text: string,
  attachmentUrl?: string,
): Promise<ChatMessage | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/p2p/rooms/${encodeURIComponent(roomId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          sender_wallet: senderWallet,
          message: text,
          attachment_url: attachmentUrl,
        }),
      },
    );

    if (!res.ok) {
      console.error("Failed to save message to server:", res.status);
      return null;
    }

    const data = await res.json();
    const msg = data.message;

    return {
      id: msg.id,
      roomId: roomId,
      senderWallet: msg.sender_wallet,
      senderRole: "buyer" as const,
      type: "message",
      text: msg.message,
      metadata: msg.attachment_url
        ? { attachmentUrl: msg.attachment_url }
        : undefined,
      timestamp: msg.created_at,
    };
  } catch (error) {
    console.error("Failed to send message to server:", error);
    return null;
  }
}

// Polling: Sync messages periodically
export async function syncChatMessagesFromServer(
  roomId: string,
  onNewMessages?: (messages: ChatMessage[]) => void,
): Promise<void> {
  try {
    const messages = await loadServerChatHistory(roomId);
    if (onNewMessages) {
      onNewMessages(messages);
    }
  } catch (error) {
    console.error("Failed to sync messages:", error);
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

// WEBSOCKET: Connect to real-time chat room
export function connectToRoom(
  roomId: string,
  onMessage: (message: ChatMessage) => void,
  onError?: (error: Event) => void,
): () => void {
  try {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/p2p/${encodeURIComponent(roomId)}`;

    const ws = new WebSocket(wsUrl);
    wsConnections.set(roomId, ws);

    ws.onmessage = (event) => {
      try {
        const msg = parseWebSocketMessage(event.data);
        if (msg) {
          onMessage(msg);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (onError) onError(error);
    };

    ws.onclose = () => {
      wsConnections.delete(roomId);
    };

    // Return disconnect function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsConnections.delete(roomId);
    };
  } catch (error) {
    console.error("Failed to connect to WebSocket:", error);
    return () => {}; // No-op disconnect
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
