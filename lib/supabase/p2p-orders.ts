/**
 * Supabase P2P Orders Functions
 * Replaces Cloudflare KV with Supabase for order management
 */

import { supabase } from "./client";
import type { P2POrder } from "./niazi";

/**
 * Get a single order by ID
 */
export async function getOrderFromSupabase(
  orderId: string,
): Promise<P2POrder | null> {
  try {
    const { data, error } = await supabase
      .from("p2p_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return null;
      }
      console.error("Error fetching order:", error);
      return null;
    }

    return data as P2POrder;
  } catch (error) {
    console.error("Error fetching order from Supabase:", error);
    return null;
  }
}

/**
 * Get all orders for a wallet
 */
export async function getOrdersByWalletFromSupabase(
  walletAddress: string,
): Promise<P2POrder[]> {
  try {
    const { data, error } = await supabase
      .from("p2p_orders")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching wallet orders:", error);
      return [];
    }

    return (data || []) as P2POrder[];
  } catch (error) {
    console.error("Error fetching wallet orders from Supabase:", error);
    return [];
  }
}

/**
 * Get all orders with optional filters
 */
export async function getOrdersFromSupabase(filters?: {
  type?: "BUY" | "SELL";
  status?: string;
  token?: string;
}): Promise<P2POrder[]> {
  try {
    let query = supabase.from("p2p_orders").select("*");

    if (filters?.type) {
      query = query.eq("type", filters.type);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.token) {
      query = query.eq("token", filters.token);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching orders:", error);
      return [];
    }

    return (data || []) as P2POrder[];
  } catch (error) {
    console.error("Error fetching orders from Supabase:", error);
    return [];
  }
}

/**
 * Create a new order
 */
export async function createOrderInSupabase(
  order: Omit<
    P2POrder,
    | "id"
    | "created_at"
    | "updated_at"
    | "created_timestamp"
    | "updated_timestamp"
  >,
): Promise<P2POrder> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("p2p_orders")
      .insert({
        ...order,
        created_at: now,
        updated_at: now,
        created_timestamp: nowTimestamp,
        updated_timestamp: nowTimestamp,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating order:", error);
      throw new Error(`Failed to create order: ${error.message}`);
    }

    return data as P2POrder;
  } catch (error) {
    console.error("Error creating order in Supabase:", error);
    throw error;
  }
}

/**
 * Update an order
 */
export async function updateOrderInSupabase(
  orderId: string,
  updates: Partial<Omit<P2POrder, "id" | "created_at" | "created_timestamp">>,
): Promise<P2POrder | null> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("p2p_orders")
      .update({
        ...updates,
        updated_at: now,
        updated_timestamp: nowTimestamp,
      })
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error updating order:", error);
      return null;
    }

    return data as P2POrder;
  } catch (error) {
    console.error("Error updating order in Supabase:", error);
    return null;
  }
}

/**
 * Delete an order
 */
export async function deleteOrderFromSupabase(
  orderId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("p2p_orders")
      .delete()
      .eq("id", orderId);

    if (error) {
      console.error("Error deleting order:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting order from Supabase:", error);
    return false;
  }
}

/**
 * Get orders by status
 */
export async function getOrdersByStatusFromSupabase(
  status: string,
): Promise<P2POrder[]> {
  try {
    const { data, error } = await supabase
      .from("p2p_orders")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders by status:", error);
      return [];
    }

    return (data || []) as P2POrder[];
  } catch (error) {
    console.error("Error fetching orders by status from Supabase:", error);
    return [];
  }
}

/**
 * Get orders by type
 */
export async function getOrdersByTypeFromSupabase(
  type: "BUY" | "SELL",
): Promise<P2POrder[]> {
  try {
    const { data, error } = await supabase
      .from("p2p_orders")
      .select("*")
      .eq("type", type)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders by type:", error);
      return [];
    }

    return (data || []) as P2POrder[];
  } catch (error) {
    console.error("Error fetching orders by type from Supabase:", error);
    return [];
  }
}

/**
 * Subscribe to real-time order updates
 */
export function subscribeToOrderUpdates(
  orderId: string,
  callback: (order: P2POrder) => void,
) {
  const channel = supabase
    .channel(`order:${orderId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "p2p_orders",
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as P2POrder);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to wallet order updates
 */
export function subscribeToWalletOrders(
  walletAddress: string,
  callback: (orders: P2POrder[]) => void,
) {
  const channel = supabase
    .channel(`wallet:${walletAddress}:orders`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "p2p_orders",
        filter: `wallet_address=eq.${walletAddress}`,
      },
      async () => {
        const orders = await getOrdersByWalletFromSupabase(walletAddress);
        callback(orders);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
