-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  wallet_address VARCHAR(88) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE,
  full_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  reputation_score FLOAT DEFAULT 0,
  total_trades INT DEFAULT 0,
  completed_trades INT DEFAULT 0,
  cancelled_trades INT DEFAULT 0,
  dispute_count INT DEFAULT 0,
  kyc_verified BOOLEAN DEFAULT FALSE,
  verification_level VARCHAR(50) DEFAULT 'unverified', -- unverified, basic, advanced
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS p2p_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  method_type VARCHAR(50) NOT NULL, -- bank_transfer, crypto_wallet, paypal, mobile_money, etc.
  method_name VARCHAR(100) NOT NULL,
  account_holder VARCHAR(255),
  account_identifier VARCHAR(255) NOT NULL, -- masked account number, email, phone, etc.
  is_verified BOOLEAN DEFAULT FALSE,
  is_primary BOOLEAN DEFAULT FALSE,
  bank_code VARCHAR(50),
  bank_name VARCHAR(255),
  country VARCHAR(2),
  currency VARCHAR(3),
  daily_limit DECIMAL(20, 8) DEFAULT 0,
  monthly_limit DECIMAL(20, 8) DEFAULT 0,
  daily_used DECIMAL(20, 8) DEFAULT 0,
  monthly_used DECIMAL(20, 8) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create p2p_orders table
CREATE TABLE IF NOT EXISTS p2p_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  trader_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  order_type VARCHAR(20) NOT NULL, -- 'buy' or 'sell'
  token_mint VARCHAR(88) NOT NULL,
  token_symbol VARCHAR(20),
  token_amount DECIMAL(20, 8) NOT NULL,
  fiat_currency VARCHAR(3) NOT NULL,
  fiat_amount DECIMAL(20, 8) NOT NULL,
  fiat_price DECIMAL(20, 8) NOT NULL,
  payment_method_id UUID REFERENCES p2p_payment_methods(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, matched, in_escrow, completed, cancelled, disputed
  counterparty_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  min_order_amount DECIMAL(20, 8),
  max_order_amount DECIMAL(20, 8),
  time_limit_minutes INT DEFAULT 30,
  remark TEXT,
  latitude FLOAT,
  longitude FLOAT,
  location_name VARCHAR(255),
  viewed_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create escrow table
CREATE TABLE IF NOT EXISTS p2p_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES p2p_orders(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  token_mint VARCHAR(88) NOT NULL,
  token_amount DECIMAL(20, 8) NOT NULL,
  fiat_amount DECIMAL(20, 8) NOT NULL,
  escrow_address VARCHAR(88),
  status VARCHAR(50) NOT NULL DEFAULT 'pending_deposit', -- pending_deposit, token_locked, payment_verified, released, cancelled
  seller_released_at TIMESTAMP WITH TIME ZONE,
  buyer_confirmed_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  release_hash VARCHAR(88),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create disputes table
CREATE TABLE IF NOT EXISTS p2p_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES p2p_orders(id) ON DELETE CASCADE NOT NULL,
  escrow_id UUID REFERENCES p2p_escrow(id) ON DELETE CASCADE,
  initiator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  respondent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  dispute_reason VARCHAR(255) NOT NULL,
  description TEXT,
  evidence JSONB, -- Array of file URLs and descriptions
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, in_review, resolved, closed
  resolution VARCHAR(50), -- buyer_wins, seller_wins, split, cancelled
  resolution_note TEXT,
  resolution_amount DECIMAL(20, 8),
  resolution_recipient VARCHAR(88), -- wallet address for resolution
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS p2p_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES p2p_orders(id) ON DELETE CASCADE,
  dispute_id UUID REFERENCES p2p_disputes(id) ON DELETE CASCADE,
  notification_type VARCHAR(100) NOT NULL, -- order_matched, payment_pending, payment_received, tokens_released, dispute_created, dispute_resolved, etc.
  title VARCHAR(255),
  message TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON p2p_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_trader_id ON p2p_orders(trader_id);
CREATE INDEX IF NOT EXISTS idx_orders_counterparty_id ON p2p_orders(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON p2p_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_token_mint ON p2p_orders(token_mint);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON p2p_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_order_id ON p2p_escrow(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_buyer_id ON p2p_escrow(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_seller_id ON p2p_escrow(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON p2p_escrow(status);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON p2p_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_initiator_id ON p2p_disputes(initiator_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON p2p_disputes(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON p2p_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON p2p_notifications(is_read);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for payment_methods
CREATE POLICY "Users can view their own payment methods" ON p2p_payment_methods
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods" ON p2p_payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods" ON p2p_payment_methods
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods" ON p2p_payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for p2p_orders
CREATE POLICY "Orders are viewable by everyone" ON p2p_orders
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own orders" ON p2p_orders
  FOR INSERT WITH CHECK (auth.uid() = trader_id);

CREATE POLICY "Users can update their own orders" ON p2p_orders
  FOR UPDATE USING (auth.uid() = trader_id OR auth.uid() = counterparty_id);

-- RLS Policies for p2p_escrow
CREATE POLICY "Escrow parties can view escrow details" ON p2p_escrow
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Escrow parties can update escrow" ON p2p_escrow
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policies for p2p_disputes
CREATE POLICY "Dispute parties can view dispute details" ON p2p_disputes
  FOR SELECT USING (auth.uid() = initiator_id OR auth.uid() = respondent_id);

CREATE POLICY "Users can create disputes" ON p2p_disputes
  FOR INSERT WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Dispute parties can update dispute" ON p2p_disputes
  FOR UPDATE USING (auth.uid() = initiator_id OR auth.uid() = respondent_id);

-- RLS Policies for p2p_notifications
CREATE POLICY "Users can view their own notifications" ON p2p_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON p2p_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" ON p2p_notifications
  FOR DELETE USING (auth.uid() = user_id);
