/**
 * Supabase Client Initialization
 * Replaces Cloudflare KV with Supabase for all P2P operations
 */

import { createClient } from "@supabase/supabase-js";

// Get credentials from environment variables
const SUPABASE_URL = "https://pcuhmppymboyukkdxuba.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdWhtcHB5bWJveXVra2R4dWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTk3MTIsImV4cCI6MjA3NTgzNTcxMn0.9OhZ6BpUE5K0e1OfGlNN10Vs2lhXa4NXQtEAJBAfspM";

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 100,
    },
  },
});

// Export client type for use in other files
export type Database = {
  public: {
    Tables: {
      p2p_orders: {
        Row: {
          id: string;
          wallet_address: string;
          type: "BUY" | "SELL";
          token: string;
          amount_tokens: number;
          amount_pkr: number;
          payment_method_id: string | null;
          status: string;
          created_at: number;
          updated_at: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["p2p_orders"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["p2p_orders"]["Insert"]>;
      };
      payment_methods: {
        Row: {
          id: string;
          wallet_address: string;
          user_name: string;
          payment_method: "EASYPAISA";
          account_name: string;
          account_number: string;
          solana_wallet_address: string | null;
          created_at: number;
          updated_at: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["payment_methods"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["payment_methods"]["Insert"]
        >;
      };
      escrow: {
        Row: {
          id: string;
          order_id: string;
          buyer_wallet: string;
          seller_wallet: string;
          amount_pkr: number;
          amount_tokens: number;
          token: string;
          status: string;
          created_at: number;
          updated_at: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["escrow"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["escrow"]["Insert"]>;
      };
      disputes: {
        Row: {
          id: string;
          escrow_id: string | null;
          order_id: string;
          initiated_by: string;
          reason: string;
          status: string;
          created_at: number;
          updated_at: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["disputes"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["disputes"]["Insert"]>;
      };
      order_notifications: {
        Row: {
          id: string;
          order_id: string;
          recipient_wallet: string;
          sender_wallet: string;
          notification_type: string;
          order_type: string;
          message: string;
          order_data: Record<string, any>;
          read: boolean;
          created_at: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["order_notifications"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["order_notifications"]["Insert"]
        >;
      };
      trade_rooms: {
        Row: {
          id: string;
          buyer_wallet: string;
          seller_wallet: string;
          order_id: string;
          status: string;
          created_at: number;
          updated_at: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["trade_rooms"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["trade_rooms"]["Insert"]>;
      };
      trade_messages: {
        Row: {
          id: string;
          room_id: string;
          sender_wallet: string;
          message: string;
          attachment_url: string | null;
          created_at: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["trade_messages"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["trade_messages"]["Insert"]
        >;
      };
    };
  };
};

export default supabase;
