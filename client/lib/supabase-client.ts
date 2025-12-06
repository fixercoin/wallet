import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials not configured");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

// Type definitions for database tables
export type Profile = {
  id: string;
  wallet_address: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  reputation_score: number;
  total_trades: number;
  completed_trades: number;
  cancelled_trades: number;
  dispute_count: number;
  kyc_verified: boolean;
  verification_level: "unverified" | "basic" | "advanced";
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = {
  id: string;
  user_id: string;
  method_type: string;
  method_name: string;
  account_holder?: string;
  account_identifier: string;
  is_verified: boolean;
  is_primary: boolean;
  bank_code?: string;
  bank_name?: string;
  country?: string;
  currency?: string;
  daily_limit: number;
  monthly_limit: number;
  daily_used: number;
  monthly_used: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type P2POrder = {
  id: string;
  order_number: string;
  trader_id: string;
  order_type: "buy" | "sell";
  token_mint: string;
  token_symbol?: string;
  token_amount: number;
  fiat_currency: string;
  fiat_amount: number;
  fiat_price: number;
  payment_method_id?: string;
  status:
    | "pending"
    | "matched"
    | "in_escrow"
    | "completed"
    | "cancelled"
    | "disputed";
  counterparty_id?: string;
  min_order_amount?: number;
  max_order_amount?: number;
  time_limit_minutes: number;
  remark?: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  viewed_count: number;
  is_featured: boolean;
  completed_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
};

export type P2PEscrow = {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  token_mint: string;
  token_amount: number;
  fiat_amount: number;
  escrow_address?: string;
  status:
    | "pending_deposit"
    | "token_locked"
    | "payment_verified"
    | "released"
    | "cancelled";
  seller_released_at?: string;
  buyer_confirmed_at?: string;
  released_at?: string;
  release_hash?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type P2PDispute = {
  id: string;
  order_id: string;
  escrow_id?: string;
  initiator_id: string;
  respondent_id: string;
  dispute_reason: string;
  description?: string;
  evidence?: Array<{ url: string; description?: string }>;
  status: "open" | "in_review" | "resolved" | "closed";
  resolution?: "buyer_wins" | "seller_wins" | "split" | "cancelled";
  resolution_note?: string;
  resolution_amount?: number;
  resolution_recipient?: string;
  assignee_id?: string;
  priority: "low" | "normal" | "high" | "urgent";
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
};

export type P2PNotification = {
  id: string;
  user_id: string;
  order_id?: string;
  dispute_id?: string;
  notification_type: string;
  title?: string;
  message?: string;
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  created_at: string;
};

// Helper functions
export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data as Profile;
};

export const getProfileByWalletAddress = async (walletAddress: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("wallet_address", walletAddress)
    .single();

  if (error) throw error;
  return data as Profile;
};

export const createProfile = async (
  profile: Omit<Profile, "created_at" | "updated_at">,
) => {
  const { data, error } = await supabase
    .from("profiles")
    .insert([profile])
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
};

export const getP2POrders = async (filters?: {
  trader_id?: string;
  status?: string;
  order_type?: "buy" | "sell";
  token_mint?: string;
}) => {
  let query = supabase.from("p2p_orders").select("*");

  if (filters?.trader_id) query = query.eq("trader_id", filters.trader_id);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.order_type) query = query.eq("order_type", filters.order_type);
  if (filters?.token_mint) query = query.eq("token_mint", filters.token_mint);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;
  return data as P2POrder[];
};

export const createP2POrder = async (
  order: Omit<P2POrder, "id" | "created_at" | "updated_at">,
) => {
  const { data, error } = await supabase
    .from("p2p_orders")
    .insert([order])
    .select()
    .single();

  if (error) throw error;
  return data as P2POrder;
};

export const updateP2POrder = async (
  orderId: string,
  updates: Partial<P2POrder>,
) => {
  const { data, error } = await supabase
    .from("p2p_orders")
    .update(updates)
    .eq("id", orderId)
    .select()
    .single();

  if (error) throw error;
  return data as P2POrder;
};

export const createEscrow = async (
  escrow: Omit<P2PEscrow, "id" | "created_at" | "updated_at">,
) => {
  const { data, error } = await supabase
    .from("p2p_escrow")
    .insert([escrow])
    .select()
    .single();

  if (error) throw error;
  return data as P2PEscrow;
};

export const createDispute = async (
  dispute: Omit<P2PDispute, "id" | "created_at" | "updated_at">,
) => {
  const { data, error } = await supabase
    .from("p2p_disputes")
    .insert([dispute])
    .select()
    .single();

  if (error) throw error;
  return data as P2PDispute;
};

export const addNotification = async (
  notification: Omit<P2PNotification, "id" | "created_at">,
) => {
  const { data, error } = await supabase
    .from("p2p_notifications")
    .insert([notification])
    .select()
    .single();

  if (error) throw error;
  return data as P2PNotification;
};

export const subscribeToUserNotifications = (
  userId: string,
  callback: (notification: P2PNotification) => void,
) => {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "p2p_notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as P2PNotification);
      },
    )
    .subscribe();
};
