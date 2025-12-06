/**
 * Supabase Disputes Functions
 * Replaces Cloudflare KV with Supabase for dispute management
 */

import { supabase } from "./client";
import type { Dispute } from "./niazi";

/**
 * Create a new dispute
 */
export async function createDisputeInSupabase(
  disputeData: Omit<
    Dispute,
    "id" | "created_at" | "updated_at" | "created_timestamp" | "updated_timestamp"
  >,
): Promise<Dispute> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("disputes")
      .insert({
        ...disputeData,
        created_at: now,
        updated_at: now,
        created_timestamp: nowTimestamp,
        updated_timestamp: nowTimestamp,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating dispute:", error);
      throw new Error(`Failed to create dispute: ${error.message}`);
    }

    return data as Dispute;
  } catch (error) {
    console.error("Error creating dispute in Supabase:", error);
    throw error;
  }
}

/**
 * Get a dispute by ID
 */
export async function getDisputeFromSupabase(
  disputeId: string,
): Promise<Dispute | null> {
  try {
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching dispute:", error);
      return null;
    }

    return data as Dispute;
  } catch (error) {
    console.error("Error fetching dispute from Supabase:", error);
    return null;
  }
}

/**
 * Get all disputes
 */
export async function getAllDisputesFromSupabase(): Promise<Dispute[]> {
  try {
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching all disputes:", error);
      return [];
    }

    return (data || []) as Dispute[];
  } catch (error) {
    console.error("Error fetching all disputes from Supabase:", error);
    return [];
  }
}

/**
 * Get open disputes only
 */
export async function getOpenDisputesFromSupabase(): Promise<Dispute[]> {
  try {
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .eq("status", "OPEN")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching open disputes:", error);
      return [];
    }

    return (data || []) as Dispute[];
  } catch (error) {
    console.error("Error fetching open disputes from Supabase:", error);
    return [];
  }
}

/**
 * Resolve a dispute (admin only)
 */
export async function resolveDisputeInSupabase(
  disputeId: string,
  resolution: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT",
  resolvedBy: string,
): Promise<Dispute | null> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("disputes")
      .update({
        status: "RESOLVED",
        resolution,
        resolved_by: resolvedBy,
        resolved_at: now,
        updated_at: now,
        updated_timestamp: nowTimestamp,
      })
      .eq("id", disputeId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error resolving dispute:", error);
      return null;
    }

    return data as Dispute;
  } catch (error) {
    console.error("Error resolving dispute in Supabase:", error);
    return null;
  }
}

/**
 * Get disputes by order
 */
export async function getDisputesByOrderFromSupabase(
  orderId: string,
): Promise<Dispute[]> {
  try {
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching disputes by order:", error);
      return [];
    }

    return (data || []) as Dispute[];
  } catch (error) {
    console.error("Error fetching disputes by order from Supabase:", error);
    return [];
  }
}

/**
 * Get disputes by escrow
 */
export async function getDisputesByEscrowFromSupabase(
  escrowId: string,
): Promise<Dispute[]> {
  try {
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .eq("escrow_id", escrowId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching disputes by escrow:", error);
      return [];
    }

    return (data || []) as Dispute[];
  } catch (error) {
    console.error("Error fetching disputes by escrow from Supabase:", error);
    return [];
  }
}

/**
 * Update dispute
 */
export async function updateDisputeInSupabase(
  disputeId: string,
  updates: Partial<Omit<Dispute, "id" | "created_at" | "created_timestamp">>,
): Promise<Dispute | null> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("disputes")
      .update({
        ...updates,
        updated_at: now,
        updated_timestamp: nowTimestamp,
      })
      .eq("id", disputeId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error updating dispute:", error);
      return null;
    }

    return data as Dispute;
  } catch (error) {
    console.error("Error updating dispute in Supabase:", error);
    return null;
  }
}

/**
 * Delete a dispute
 */
export async function deleteDisputeFromSupabase(
  disputeId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("disputes")
      .delete()
      .eq("id", disputeId);

    if (error) {
      console.error("Error deleting dispute:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting dispute from Supabase:", error);
    return false;
  }
}

/**
 * Subscribe to open disputes updates
 */
export function subscribeToOpenDisputes(
  callback: (disputes: Dispute[]) => void,
) {
  const channel = supabase
    .channel("open-disputes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "disputes",
        filter: "status=eq.OPEN",
      },
      async () => {
        const disputes = await getOpenDisputesFromSupabase();
        callback(disputes);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
