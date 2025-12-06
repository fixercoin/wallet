/**
 * Supabase Payment Methods Functions
 * Replaces Cloudflare KV with Supabase for payment method management
 */

import { supabase } from "./client";
import type { PaymentMethod } from "./niazi";

/**
 * Get all payment methods for a wallet
 */
export async function getPaymentMethodsByWalletFromSupabase(
  walletAddress: string,
): Promise<PaymentMethod[]> {
  try {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching payment methods:", error);
      return [];
    }

    return (data || []) as PaymentMethod[];
  } catch (error) {
    console.error("Error fetching payment methods from Supabase:", error);
    return [];
  }
}

/**
 * Get a single payment method by ID
 */
export async function getPaymentMethodFromSupabase(
  methodId: string,
): Promise<PaymentMethod | null> {
  try {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("id", methodId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching payment method:", error);
      return null;
    }

    return data as PaymentMethod;
  } catch (error) {
    console.error("Error fetching payment method from Supabase:", error);
    return null;
  }
}

/**
 * Create or update a payment method
 */
export async function savePaymentMethodToSupabase(
  method: Omit<
    PaymentMethod,
    "id" | "created_at" | "updated_at" | "created_timestamp" | "updated_timestamp"
  >,
  methodId?: string,
): Promise<PaymentMethod> {
  try {
    const now = Date.now();
    const nowTimestamp = new Date().toISOString();

    let query;
    if (methodId) {
      // Update existing
      query = supabase
        .from("payment_methods")
        .update({
          ...method,
          updated_at: now,
          updated_timestamp: nowTimestamp,
        })
        .eq("id", methodId)
        .select()
        .single();
    } else {
      // Create new
      query = supabase
        .from("payment_methods")
        .insert({
          ...method,
          created_at: now,
          updated_at: now,
          created_timestamp: nowTimestamp,
          updated_timestamp: nowTimestamp,
        })
        .select()
        .single();
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error saving payment method:", error);
      throw new Error(`Failed to save payment method: ${error.message}`);
    }

    return data as PaymentMethod;
  } catch (error) {
    console.error("Error saving payment method in Supabase:", error);
    throw error;
  }
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethodFromSupabase(
  methodId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", methodId);

    if (error) {
      console.error("Error deleting payment method:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting payment method from Supabase:", error);
    return false;
  }
}

/**
 * Get payment method by account number
 */
export async function getPaymentMethodByAccountFromSupabase(
  accountNumber: string,
): Promise<PaymentMethod | null> {
  try {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("account_number", accountNumber)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching payment method by account:", error);
      return null;
    }

    return data as PaymentMethod;
  } catch (error) {
    console.error("Error fetching payment method by account from Supabase:", error);
    return null;
  }
}
