/**
 * Supabase P2P Database Schema
 * This file contains all SQL schemas needed to migrate P2P functionality from Cloudflare KV to Supabase
 * 
 * Copy and paste these SQL commands into Supabase SQL Editor to create the necessary tables
 */

// ============================================================================
// SQL SCHEMAS - COPY EVERYTHING BELOW AND PASTE IN SUPABASE SQL EDITOR
// ============================================================================

export const P2P_SQL_SCHEMAS = `
-- ============================================================================
-- 1. P2P ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS p2p_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('BUY', 'SELL')),
  token TEXT NOT NULL,
  amount_tokens NUMERIC NOT NULL DEFAULT 0,
  amount_pkr NUMERIC NOT NULL DEFAULT 0,
  payment_method_id TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'ESCROW_LOCKED', 'DISPUTED', 'ACTIVE')
  ),
  min_amount_pkr NUMERIC,
  max_amount_pkr NUMERIC,
  min_amount_tokens NUMERIC,
  max_amount_tokens NUMERIC,
  price_pkr_per_quote NUMERIC,
  seller_wallet TEXT,
  buyer_wallet TEXT,
  escrow_id UUID,
  matched_with TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_wallet ON p2p_orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_status ON p2p_orders(status);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_type ON p2p_orders(type);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer ON p2p_orders(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller ON p2p_orders(seller_wallet);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_created_at ON p2p_orders(created_at DESC);

-- ============================================================================
-- 2. PAYMENT METHODS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  user_name TEXT NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'EASYPAISA' CHECK (payment_method = 'EASYPAISA'),
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  solana_wallet_address TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_wallet ON payment_methods(wallet_address);
CREATE INDEX IF NOT EXISTS idx_payment_methods_account ON payment_methods(account_number);

-- ============================================================================
-- 3. ESCROW TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  buyer_wallet TEXT NOT NULL,
  seller_wallet TEXT NOT NULL,
  amount_pkr NUMERIC NOT NULL,
  amount_tokens NUMERIC NOT NULL,
  token TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'LOCKED' CHECK (
    status IN ('LOCKED', 'RELEASED', 'REFUNDED', 'DISPUTED')
  ),
  released_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_order ON escrow(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow(status);
CREATE INDEX IF NOT EXISTS idx_escrow_buyer ON escrow(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_escrow_seller ON escrow(seller_wallet);

-- ============================================================================
-- 4. DISPUTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID REFERENCES escrow(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  initiated_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'CLOSED')),
  resolution VARCHAR(50) CHECK (resolution IN ('RELEASE_TO_SELLER', 'REFUND_TO_BUYER', 'SPLIT')),
  resolved_by TEXT,
  resolved_at BIGINT,
  evidence TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_escrow ON disputes(escrow_id);
CREATE INDEX IF NOT EXISTS idx_disputes_initiated_by ON disputes(initiated_by);

-- ============================================================================
-- 5. ORDER NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  recipient_wallet TEXT NOT NULL,
  sender_wallet TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL CHECK (
    notification_type IN ('order_created', 'payment_confirmed', 'received_confirmed')
  ),
  order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('BUY', 'SELL')),
  message TEXT NOT NULL,
  order_data JSONB NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON order_notifications(recipient_wallet);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON order_notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON order_notifications(created_at DESC);

-- ============================================================================
-- 6. TRADE ROOMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS trade_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_wallet TEXT NOT NULL,
  seller_wallet TEXT NOT NULL,
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'payment_confirmed', 'assets_transferred', 'completed', 'cancelled')
  ),
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_rooms_buyer ON trade_rooms(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_trade_rooms_seller ON trade_rooms(seller_wallet);
CREATE INDEX IF NOT EXISTS idx_trade_rooms_order ON trade_rooms(order_id);
CREATE INDEX IF NOT EXISTS idx_trade_rooms_status ON trade_rooms(status);

-- ============================================================================
-- 7. TRADE MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS trade_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES trade_rooms(id) ON DELETE CASCADE,
  sender_wallet TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_messages_room ON trade_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_trade_messages_sender ON trade_messages(sender_wallet);
CREATE INDEX IF NOT EXISTS idx_trade_messages_created ON trade_messages(created_at DESC);

-- ============================================================================
-- 8. STAKES TABLE (for rewards/staking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  token TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'WITHDRAWN')),
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stakes_wallet ON stakes(wallet_address);
CREATE INDEX IF NOT EXISTS idx_stakes_status ON stakes(status);

-- ============================================================================
-- 9. REWARDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  stake_id UUID REFERENCES stakes(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  token TEXT NOT NULL,
  reward_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CLAIMED', 'EXPIRED')),
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  created_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_wallet ON rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON rewards(status);
CREATE INDEX IF NOT EXISTS idx_rewards_stake ON rewards(stake_id);

-- ============================================================================
-- RLS (Row Level Security) Policies - Optional but recommended
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE p2p_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- P2P Orders - Users can view orders related to them or all orders
CREATE POLICY "Users can view all orders" ON p2p_orders
  FOR SELECT USING (TRUE);

-- Payment Methods - Users can only view their own
CREATE POLICY "Users can view own payment methods" ON payment_methods
  FOR SELECT USING (wallet_address = current_user OR TRUE);

-- Notifications - Users can only view their own
CREATE POLICY "Users can view own notifications" ON order_notifications
  FOR SELECT USING (recipient_wallet = current_user OR TRUE);
`;

// ============================================================================
// TYPESCRIPT INTERFACES FOR TYPE SAFETY
// ============================================================================

export interface P2POrder {
  id: string;
  wallet_address: string;
  type: "BUY" | "SELL";
  token: string;
  amount_tokens: number;
  amount_pkr: number;
  payment_method_id?: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "ESCROW_LOCKED" | "DISPUTED" | "ACTIVE";
  min_amount_pkr?: number;
  max_amount_pkr?: number;
  min_amount_tokens?: number;
  max_amount_tokens?: number;
  price_pkr_per_quote?: number;
  seller_wallet?: string;
  buyer_wallet?: string;
  escrow_id?: string;
  matched_with?: string;
  created_at: number;
  updated_at: number;
  created_timestamp: string;
  updated_timestamp: string;
}

export interface PaymentMethod {
  id: string;
  wallet_address: string;
  user_name: string;
  payment_method: "EASYPAISA";
  account_name: string;
  account_number: string;
  solana_wallet_address?: string;
  created_at: number;
  updated_at: number;
  created_timestamp: string;
  updated_timestamp: string;
}

export interface Escrow {
  id: string;
  order_id: string;
  buyer_wallet: string;
  seller_wallet: string;
  amount_pkr: number;
  amount_tokens: number;
  token: string;
  status: "LOCKED" | "RELEASED" | "REFUNDED" | "DISPUTED";
  released_at?: number;
  created_at: number;
  updated_at: number;
  created_timestamp: string;
  updated_timestamp: string;
}

export interface Dispute {
  id: string;
  escrow_id?: string;
  order_id: string;
  initiated_by: string;
  reason: string;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  resolution?: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT";
  resolved_by?: string;
  resolved_at?: number;
  evidence?: string[];
  created_at: number;
  updated_at: number;
  created_timestamp: string;
  updated_timestamp: string;
}

export interface OrderNotification {
  id: string;
  order_id: string;
  recipient_wallet: string;
  sender_wallet: string;
  notification_type: "order_created" | "payment_confirmed" | "received_confirmed";
  order_type: "BUY" | "SELL";
  message: string;
  order_data: {
    token: string;
    amount_tokens: number;
    amount_pkr: number;
  };
  read: boolean;
  created_at: number;
  created_timestamp: string;
}

export interface TradeRoom {
  id: string;
  buyer_wallet: string;
  seller_wallet: string;
  order_id: string;
  status: "pending" | "payment_confirmed" | "assets_transferred" | "completed" | "cancelled";
  created_at: number;
  updated_at: number;
  created_timestamp: string;
  updated_timestamp: string;
}

export interface TradeMessage {
  id: string;
  room_id: string;
  sender_wallet: string;
  message: string;
  attachment_url?: string;
  created_at: number;
  created_timestamp: string;
}

export interface Stake {
  id: string;
  wallet_address: string;
  amount: number;
  token: string;
  status: "ACTIVE" | "PENDING" | "WITHDRAWN";
  created_at: number;
  updated_at: number;
  created_timestamp: string;
  updated_timestamp: string;
}

export interface Reward {
  id: string;
  wallet_address: string;
  stake_id?: string;
  amount: number;
  token: string;
  reward_type: string;
  status: "PENDING" | "CLAIMED" | "EXPIRED";
  created_at: number;
  updated_at: number;
  created_timestamp: string;
  updated_timestamp: string;
}

// ============================================================================
// SETUP INSTRUCTIONS
// ============================================================================

/**
 * SETUP INSTRUCTIONS FOR SUPABASE MIGRATION:
 * 
 * 1. Go to your Supabase project: https://pcuhmppymboyukkdxuba.supabase.co
 * 
 * 2. Navigate to the SQL Editor section
 * 
 * 3. Copy the entire SQL schema from P2P_SQL_SCHEMAS constant above
 * 
 * 4. Paste it into a new SQL query in Supabase SQL Editor
 * 
 * 5. Click "Execute" or press Cmd+Enter to run all the SQL commands
 * 
 * 6. Verify that all tables are created successfully by checking the "Tables" section
 * 
 * 7. Your Supabase database is now ready for P2P functionality!
 * 
 * CREDENTIALS:
 * - Project URL: https://pcuhmppymboyukkdxuba.supabase.co
 * - Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdWhtcHB5bWJveXVra2R4dWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTk3MTIsImV4cCI6MjA3NTgzNTcxMn0.9OhZ6BpUE5K0e1OfGlNN10Vs2lhXa4NXQtEAJBAfspM
 * 
 * Use these credentials in your Supabase client initialization.
 */

export default {
  P2P_SQL_SCHEMAS,
};
