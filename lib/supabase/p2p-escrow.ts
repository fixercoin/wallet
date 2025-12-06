/**
 * Supabase Escrow Functions
 * Replaces Cloudflare KV with Supabase for escrow management
 */

import { supabase } from "./client";
import type { Escrow } from "./niazi";

/**
 * Create a new escrow
 */
export async function createEscrowInSupabase(
  escrowData: Omit<
    Escrow,
    | "id"
    | "created_at"
    | "updated_at"
    | "created_timestamp"
    | "updated_timestamp"
  >,
): Promise<Escrow> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("escrow")
      .insert({
        ...escrowData,
        created_at: now,
        updated_at: now,
        created_timestamp: nowTimestamp,
        updated_timestamp: nowTimestamp,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating escrow:", error);
      throw new Error(`Failed to create escrow: ${error.message}`);
    }

    return data as Escrow;
  } catch (error) {
    console.error("Error creating escrow in Supabase:", error);
    throw error;
  }
}

/**
 * Get an escrow by ID
 */
export async function getEscrowFromSupabase(
  escrowId: string,
): Promise<Escrow | null> {
  try {
    const { data, error } = await supabase
      .from("escrow")
      .select("*")
      .eq("id", escrowId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching escrow:", error);
      return null;
    }

    return data as Escrow;
  } catch (error) {
    console.error("Error fetching escrow from Supabase:", error);
    return null;
  }
}

/**
 * Get all escrows for an order
 */
export async function getEscrowsByOrderFromSupabase(
  orderId: string,
): Promise<Escrow[]> {
  try {
    const { data, error } = await supabase
      .from("escrow")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching escrows:", error);
      return [];
    }

    return (data || []) as Escrow[];
  } catch (error) {
    console.error("Error fetching escrows from Supabase:", error);
    return [];
  }
}

/**
 * Update escrow status
 */
export async function updateEscrowStatusInSupabase(
  escrowId: string,
  status: "LOCKED" | "RELEASED" | "REFUNDED" | "DISPUTED",
): Promise<Escrow | null> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const updateData: any = {
      status,
      updated_at: now,
      updated_timestamp: nowTimestamp,
    };

    if (status === "RELEASED") {
      updateData.released_at = now;
    }

    const { data, error } = await supabase
      .from("escrow")
      .update(updateData)
      .eq("id", escrowId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error updating escrow:", error);
      return null;
    }

    return data as Escrow;
  } catch (error) {
    console.error("Error updating escrow in Supabase:", error);
    return null;
  }
}

/**
 * Get all escrows by wallet (buyer or seller)
 */
export async function getEscrowsByWalletFromSupabase(
  walletAddress: string,
): Promise<Escrow[]> {
  try {
    const { data, error } = await supabase
      .from("escrow")
      .select("*")
      .or(`buyer_wallet.eq.${walletAddress},seller_wallet.eq.${walletAddress}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching wallet escrows:", error);
      return [];
    }

    return (data || []) as Escrow[];
  } catch (error) {
    console.error("Error fetching wallet escrows from Supabase:", error);
    return [];
  }
}

/**
 * Get escrows by status
 */
export async function getEscrowsByStatusFromSupabase(
  status: "LOCKED" | "RELEASED" | "REFUNDED" | "DISPUTED",
): Promise<Escrow[]> {
  try {
    const { data, error } = await supabase
      .from("escrow")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching escrows by status:", error);
      return [];
    }

    return (data || []) as Escrow[];
  } catch (error) {
    console.error("Error fetching escrows by status from Supabase:", error);
    return [];
  }
}

/**
 * Delete an escrow
 */
export async function deleteEscrowFromSupabase(
  escrowId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("escrow").delete().eq("id", escrowId);

    if (error) {
      console.error("Error deleting escrow:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting escrow from Supabase:", error);
    return false;
  }
}

/**
 * Subscribe to escrow updates
 */
export function subscribeToEscrowUpdates(
  escrowId: string,
  callback: (escrow: Escrow) => void,
) {
  const channel = supabase
    .channel(`escrow:${escrowId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "escrow",
        filter: `id=eq.${escrowId}`,
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new as Escrow);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
