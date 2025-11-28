import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

export type Database = {
  public: {
    Tables: {
      stakes: {
        Row: {
          id: string;
          wallet_address: string;
          token_mint: string;
          amount: number;
          stake_period_days: number;
          start_time: number;
          end_time: number;
          reward_amount: number;
          status: "active" | "completed" | "withdrawn";
          withdrawn_at: number | null;
          created_at: number;
          updated_at: number;
        };
        Insert: {
          id?: string;
          wallet_address: string;
          token_mint: string;
          amount: number;
          stake_period_days: number;
          start_time: number;
          end_time: number;
          reward_amount: number;
          status?: "active" | "completed" | "withdrawn";
          withdrawn_at?: number | null;
          created_at?: number;
          updated_at?: number;
        };
        Update: {
          id?: string;
          wallet_address?: string;
          token_mint?: string;
          amount?: number;
          stake_period_days?: number;
          start_time?: number;
          end_time?: number;
          reward_amount?: number;
          status?: "active" | "completed" | "withdrawn";
          withdrawn_at?: number | null;
          created_at?: number;
          updated_at?: number;
        };
      };
    };
  };
};
