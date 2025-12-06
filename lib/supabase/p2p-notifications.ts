/**
 * Supabase Notifications Functions
 * Replaces Cloudflare KV with Supabase for notification management
 */

import { supabase } from "./client";
import type { OrderNotification, TradeRoom, TradeMessage } from "./niazi";

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Get all notifications for a wallet
 */
export async function getNotificationsByWalletFromSupabase(
  walletAddress: string,
  unreadOnly?: boolean,
): Promise<OrderNotification[]> {
  try {
    let query = supabase
      .from("order_notifications")
      .select("*")
      .eq("recipient_wallet", walletAddress)
      .order("created_at", { ascending: false });

    if (unreadOnly) {
      query = query.eq("read", false);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }

    return (data || []) as OrderNotification[];
  } catch (error) {
    console.error("Error fetching notifications from Supabase:", error);
    return [];
  }
}

/**
 * Get a single notification by ID
 */
export async function getNotificationFromSupabase(
  notificationId: string,
): Promise<OrderNotification | null> {
  try {
    const { data, error } = await supabase
      .from("order_notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching notification:", error);
      return null;
    }

    return data as OrderNotification;
  } catch (error) {
    console.error("Error fetching notification from Supabase:", error);
    return null;
  }
}

/**
 * Create a notification
 */
export async function createNotificationInSupabase(
  notification: Omit<
    OrderNotification,
    "id" | "created_at" | "created_timestamp"
  >,
): Promise<OrderNotification> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("order_notifications")
      .insert({
        ...notification,
        created_at: now,
        created_timestamp: nowTimestamp,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating notification:", error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data as OrderNotification;
  } catch (error) {
    console.error("Error creating notification in Supabase:", error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsReadInSupabase(
  notificationId: string,
): Promise<OrderNotification | null> {
  try {
    const { data, error } = await supabase
      .from("order_notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error marking notification as read:", error);
      return null;
    }

    return data as OrderNotification;
  } catch (error) {
    console.error("Error marking notification as read in Supabase:", error);
    return null;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotificationFromSupabase(
  notificationId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("order_notifications")
      .delete()
      .eq("id", notificationId);

    if (error) {
      console.error("Error deleting notification:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting notification from Supabase:", error);
    return false;
  }
}

/**
 * Subscribe to wallet notifications
 */
export function subscribeToNotifications(
  walletAddress: string,
  callback: (notifications: OrderNotification[]) => void,
) {
  const channel = supabase
    .channel(`notifications:${walletAddress}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_notifications",
        filter: `recipient_wallet=eq.${walletAddress}`,
      },
      async () => {
        const notifications =
          await getNotificationsByWalletFromSupabase(walletAddress);
        callback(notifications);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================================
// TRADE ROOMS
// ============================================================================

/**
 * Create a trade room
 */
export async function createTradeRoomInSupabase(
  roomData: Omit<
    TradeRoom,
    | "id"
    | "created_at"
    | "updated_at"
    | "created_timestamp"
    | "updated_timestamp"
  >,
): Promise<TradeRoom> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("trade_rooms")
      .insert({
        ...roomData,
        created_at: now,
        updated_at: now,
        created_timestamp: nowTimestamp,
        updated_timestamp: nowTimestamp,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating trade room:", error);
      throw new Error(`Failed to create trade room: ${error.message}`);
    }

    return data as TradeRoom;
  } catch (error) {
    console.error("Error creating trade room in Supabase:", error);
    throw error;
  }
}

/**
 * Get a trade room by ID
 */
export async function getTradeRoomFromSupabase(
  roomId: string,
): Promise<TradeRoom | null> {
  try {
    const { data, error } = await supabase
      .from("trade_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching trade room:", error);
      return null;
    }

    return data as TradeRoom;
  } catch (error) {
    console.error("Error fetching trade room from Supabase:", error);
    return null;
  }
}

/**
 * Update trade room status
 */
export async function updateTradeRoomStatusInSupabase(
  roomId: string,
  status: string,
): Promise<TradeRoom | null> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("trade_rooms")
      .update({
        status,
        updated_at: now,
        updated_timestamp: nowTimestamp,
      })
      .eq("id", roomId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error updating trade room:", error);
      return null;
    }

    return data as TradeRoom;
  } catch (error) {
    console.error("Error updating trade room in Supabase:", error);
    return null;
  }
}

// ============================================================================
// TRADE MESSAGES
// ============================================================================

/**
 * Send a trade message
 */
export async function sendTradeMessageInSupabase(
  messageData: Omit<TradeMessage, "id" | "created_at" | "created_timestamp">,
): Promise<TradeMessage> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("trade_messages")
      .insert({
        ...messageData,
        created_at: now,
        created_timestamp: nowTimestamp,
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending trade message:", error);
      throw new Error(`Failed to send trade message: ${error.message}`);
    }

    return data as TradeMessage;
  } catch (error) {
    console.error("Error sending trade message in Supabase:", error);
    throw error;
  }
}

/**
 * Get all messages for a trade room
 */
export async function getTradeMessagesFromSupabase(
  roomId: string,
): Promise<TradeMessage[]> {
  try {
    const { data, error } = await supabase
      .from("trade_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching trade messages:", error);
      return [];
    }

    return (data || []) as TradeMessage[];
  } catch (error) {
    console.error("Error fetching trade messages from Supabase:", error);
    return [];
  }
}

/**
 * Subscribe to trade room messages
 */
export function subscribeToTradeMessages(
  roomId: string,
  callback: (message: TradeMessage) => void,
) {
  const channel = supabase
    .channel(`room:${roomId}:messages`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "trade_messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as TradeMessage);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to trade room updates
 */
export function subscribeToTradeRoomUpdates(
  roomId: string,
  callback: (room: TradeRoom) => void,
) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "trade_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as TradeRoom);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
