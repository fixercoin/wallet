# Supabase Staking Database Setup

## Step 1: Create the Stakes Table

Go to your Supabase dashboard and run the following SQL in the SQL Editor:

```sql
-- Create stakes table
CREATE TABLE stakes (
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

-- Create indexes for better query performance
CREATE INDEX idx_stakes_wallet ON stakes(wallet_address);
CREATE INDEX idx_stakes_status ON stakes(status);
CREATE INDEX idx_stakes_created_at ON stakes(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE stakes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own stakes
CREATE POLICY stakes_select_own ON stakes
  FOR SELECT
  USING (wallet_address = current_user_id());

-- RLS Policy: Users can only insert their own stakes
CREATE POLICY stakes_insert_own ON stakes
  FOR INSERT
  WITH CHECK (wallet_address = current_user_id());

-- RLS Policy: Users can only update their own stakes
CREATE POLICY stakes_update_own ON stakes
  FOR UPDATE
  USING (wallet_address = current_user_id())
  WITH CHECK (wallet_address = current_user_id());

-- RLS Policy: Users can only delete their own stakes
CREATE POLICY stakes_delete_own ON stakes
  FOR DELETE
  USING (wallet_address = current_user_id());

-- Allow anonymous users (no auth required) - for public use
ALTER ROLE anon SET app.current_user = '';
CREATE POLICY stakes_anon_access ON stakes
  FOR SELECT
  USING (true);
```

## Step 2: Disable RLS (for development/testing)

If you get permission errors, you can temporarily disable RLS:

```sql
-- Disable RLS for development
ALTER TABLE stakes DISABLE ROW LEVEL SECURITY;
```

Or use this simpler approach that allows anonymous access:

```sql
-- Drop existing policies if you encounter errors
DROP POLICY IF EXISTS stakes_select_own ON stakes;
DROP POLICY IF EXISTS stakes_insert_own ON stakes;
DROP POLICY IF EXISTS stakes_update_own ON stakes;
DROP POLICY IF EXISTS stakes_delete_own ON stakes;
DROP POLICY IF EXISTS stakes_anon_access ON stakes;

-- Re-enable RLS with permissive policy for development
ALTER TABLE stakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_reads ON stakes
  FOR SELECT
  USING (true);

CREATE POLICY allow_all_inserts ON stakes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY allow_all_updates ON stakes
  FOR UPDATE
  USING (true);

CREATE POLICY allow_all_deletes ON stakes
  FOR DELETE
  USING (true);
```

## Step 3: Verify Environment Variables

Make sure these are set in your `.env.local`:

```
VITE_SUPABASE_URL=https://pcuhmppymboyukkdxuba.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

They're already configured in your dev server.

## Step 4: Test the Integration

1. Go to the staking page
2. Create a stake
3. Check your Supabase dashboard → Stakes table to verify the data was saved
4. Refresh the page - your stakes should still appear
5. Try from a different device/browser - stakes should sync

## Troubleshooting

**Error: "relation \"stakes\" does not exist"**

- The table hasn't been created yet. Run the SQL from Step 1.

**Error: "permission denied"**

- RLS policies are too restrictive. Run the "Disable RLS" SQL from Step 2.

**Stakes not showing after refresh**

- Check browser console for errors
- Verify Supabase URL and API key are correct
- Make sure RLS policies allow your user to read/write data

**Network errors from Cloudflare**

- You'll need to add Supabase environment variables to Cloudflare Pages:
  - Go to Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables
  - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
