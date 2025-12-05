/**
 * Supabase service - DEPRECATED
 * Staking data is now managed by PHP backend API
 * This file is kept for backward compatibility but is no longer actively used
 */

// Stub object for backward compatibility (in case any code still references it)
const supabase = {
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
