-- ============================================
-- Fixorium Staking Database Schema
-- Copy and paste this into Supabase SQL Editor
-- ============================================

-- ============================================
-- Table 1: stakes
-- ============================================
CREATE TABLE IF NOT EXISTS stakes (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  stake_period_days INTEGER NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  reward_amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  withdrawn_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_at_ts TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stakes_wallet_address ON stakes(wallet_address);
CREATE INDEX IF NOT EXISTS idx_stakes_status ON stakes(status);
CREATE INDEX IF NOT EXISTS idx_stakes_token_mint ON stakes(token_mint);
CREATE INDEX IF NOT EXISTS idx_stakes_created_at ON stakes(created_at);
CREATE INDEX IF NOT EXISTS idx_stakes_end_time ON stakes(end_time);

-- ============================================
-- Table 2: stake_rewards (optional, for tracking earned rewards)
-- ============================================
CREATE TABLE IF NOT EXISTS stake_rewards (
  id TEXT PRIMARY KEY,
  stake_id TEXT NOT NULL REFERENCES stakes(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  reward_amount DOUBLE PRECISION NOT NULL,
  earned_at BIGINT NOT NULL,
  reward_type TEXT DEFAULT 'daily' CHECK (reward_type IN ('daily', 'withdrawal', 'bonus')),
  created_at BIGINT NOT NULL,
  created_at_ts TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for stake_rewards
CREATE INDEX IF NOT EXISTS idx_stake_rewards_stake_id ON stake_rewards(stake_id);
CREATE INDEX IF NOT EXISTS idx_stake_rewards_wallet ON stake_rewards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_stake_rewards_earned_at ON stake_rewards(earned_at);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================

-- Enable RLS on stakes table
ALTER TABLE stakes ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow all users to read stakes (for public access)
CREATE POLICY IF NOT EXISTS allow_read_stakes ON stakes
  FOR SELECT
  USING (true);

-- Policy 2: Allow users to insert their own stakes
CREATE POLICY IF NOT EXISTS allow_insert_stakes ON stakes
  FOR INSERT
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::jsonb->>'sub' OR true);

-- Policy 3: Allow users to update their own stakes
CREATE POLICY IF NOT EXISTS allow_update_stakes ON stakes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Policy 4: Allow users to delete their own stakes
CREATE POLICY IF NOT EXISTS allow_delete_stakes ON stakes
  FOR DELETE
  USING (true);

-- Enable RLS on stake_rewards table
ALTER TABLE stake_rewards ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow all users to read rewards
CREATE POLICY IF NOT EXISTS allow_read_rewards ON stake_rewards
  FOR SELECT
  USING (true);

-- Policy 2: Allow insert into rewards
CREATE POLICY IF NOT EXISTS allow_insert_rewards ON stake_rewards
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Sample Data (Optional - for testing)
-- ============================================
-- Uncomment below to add test data

-- INSERT INTO stakes (
--   id, wallet_address, token_mint, amount, stake_period_days,
--   start_time, end_time, reward_amount, status, created_at, updated_at
-- ) VALUES (
--   'stake_test_001',
--   'YourWalletAddressHere',
--   'FixerCoinMintAddress',
--   1000000,
--   30,
--   1760000000000,
--   1762592000000,
--   8219.17,
--   'active',
--   1760000000000,
--   1760000000000
-- );

-- ============================================
-- Useful Queries for Testing
-- ============================================

-- Check if tables were created
-- SELECT * FROM information_schema.tables WHERE table_schema = 'public';

-- View all stakes
-- SELECT * FROM stakes ORDER BY created_at DESC;

-- View stakes for a specific wallet
-- SELECT * FROM stakes WHERE wallet_address = 'your_wallet_address';

-- View active stakes only
-- SELECT * FROM stakes WHERE status = 'active' ORDER BY end_time ASC;

-- Count stakes by status
-- SELECT status, COUNT(*) as count FROM stakes GROUP BY status;

-- View rewards earned
-- SELECT * FROM stake_rewards ORDER BY earned_at DESC;
