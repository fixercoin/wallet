import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn(
    "Supabase credentials not configured. Supabase features will be disabled.",
  );
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  };
}

export { supabase };

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
