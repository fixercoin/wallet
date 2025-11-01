-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Locks table tracks current state per lock
CREATE TABLE IF NOT EXISTS locks (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  amount_total TEXT NOT NULL, -- total locked amount in base units or decimal string
  amount_withdrawn TEXT NOT NULL DEFAULT '0', -- total withdrawn amount
  decimals INTEGER DEFAULT NULL, -- token decimals if using base units
  status TEXT NOT NULL CHECK (status IN ('active','withdrawn','cancelled')) DEFAULT 'active',
  network TEXT NOT NULL DEFAULT 'solana',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  tx_signature TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_locks_wallet ON locks(wallet);
CREATE INDEX IF NOT EXISTS idx_locks_wallet_token ON locks(wallet, token_mint);
CREATE INDEX IF NOT EXISTS idx_locks_status ON locks(status);

-- Event log for immutable history
CREATE TABLE IF NOT EXISTS lock_events (
  id TEXT PRIMARY KEY,
  lock_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lock','withdraw','cancel')),
  amount_delta TEXT NOT NULL, -- positive for lock, negative for withdraw
  tx_signature TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL,
  note TEXT DEFAULT NULL,
  FOREIGN KEY (lock_id) REFERENCES locks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_lock ON lock_events(lock_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON lock_events(created_at);
