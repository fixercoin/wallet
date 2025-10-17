export type LockStatus = "active" | "withdrawn" | "cancelled";

export interface Lock {
  id: string;
  wallet: string;
  token_mint: string;
  amount_total: string; // decimal or base units as string
  amount_withdrawn: string; // as string
  decimals: number | null;
  status: LockStatus;
  network: string;
  created_at: number;
  updated_at: number;
  tx_signature: string | null;
}

export interface LockEvent {
  id: string;
  lock_id: string;
  type: "lock" | "withdraw" | "cancel";
  amount_delta: string; // positive for lock, negative for withdraw
  tx_signature: string | null;
  created_at: number;
  note: string | null;
}

export async function ensureSchema(db: D1Database) {
  // Safe to run on every request; guarded by IF NOT EXISTS
  const schema = `
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS locks (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      token_mint TEXT NOT NULL,
      amount_total TEXT NOT NULL,
      amount_withdrawn TEXT NOT NULL DEFAULT '0',
      decimals INTEGER DEFAULT NULL,
      status TEXT NOT NULL CHECK (status IN ('active','withdrawn','cancelled')) DEFAULT 'active',
      network TEXT NOT NULL DEFAULT 'solana',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      tx_signature TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_locks_wallet ON locks(wallet);
    CREATE INDEX IF NOT EXISTS idx_locks_wallet_token ON locks(wallet, token_mint);
    CREATE INDEX IF NOT EXISTS idx_locks_status ON locks(status);
    CREATE TABLE IF NOT EXISTS lock_events (
      id TEXT PRIMARY KEY,
      lock_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('lock','withdraw','cancel')),
      amount_delta TEXT NOT NULL,
      tx_signature TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL,
      note TEXT DEFAULT NULL,
      FOREIGN KEY (lock_id) REFERENCES locks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_events_lock ON lock_events(lock_id);
    CREATE INDEX IF NOT EXISTS idx_events_created ON lock_events(created_at);
  `;
  await db.batch(
    schema
      .split(";\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sql) => db.prepare(sql)),
  );
}

export interface CreateLockInput {
  id?: string;
  wallet: string;
  token_mint: string;
  amount_total: string; // string for precision
  decimals?: number;
  tx_signature?: string;
  network?: string;
  note?: string;
}

export async function createLock(
  db: D1Database,
  input: CreateLockInput,
): Promise<Lock> {
  const now = Date.now();
  const id = input.id || crypto.randomUUID();
  const network = input.network || "solana";
  const decimals = Number.isInteger(input.decimals)
    ? (input.decimals as number)
    : null;
  const tx = db
    .prepare(
      `INSERT INTO locks (id, wallet, token_mint, amount_total, amount_withdrawn, decimals, status, network, created_at, updated_at, tx_signature)
     VALUES (?1, ?2, ?3, ?4, '0', ?5, 'active', ?6, ?7, ?7, ?8)`,
    )
    .bind(
      id,
      input.wallet,
      input.token_mint,
      input.amount_total,
      decimals,
      network,
      now,
      input.tx_signature ?? null,
    );
  const ev = db
    .prepare(
      `INSERT INTO lock_events (id, lock_id, type, amount_delta, tx_signature, created_at, note)
     VALUES (?1, ?2, 'lock', ?3, ?4, ?5, ?6)`,
    )
    .bind(
      crypto.randomUUID(),
      id,
      input.amount_total,
      input.tx_signature ?? null,
      now,
      input.note ?? null,
    );
  const res = await db.batch([tx, ev]);
  if (res.some((r) => (r as D1Result).success === false))
    throw new Error("Failed to create lock");
  return getLock(db, id);
}

export async function getLock(db: D1Database, id: string): Promise<Lock> {
  const row = await db
    .prepare(`SELECT * FROM locks WHERE id = ?1`)
    .bind(id)
    .first<Lock>();
  if (!row) throw new Error("Lock not found");
  return row;
}

export interface WithdrawInput {
  amount: string; // amount to withdraw (same unit as amount_total)
  tx_signature?: string;
  note?: string;
}

function add(a: string, b: string): string {
  // simple decimal addition using BigInt over scaled integer by removing dot; assume same scale for both inputs
  if (!a.includes(".") && !b.includes("."))
    return (BigInt(a) + BigInt(b)).toString();
  const [ai, ad = ""] = a.split(".");
  const [bi, bd = ""] = b.split(".");
  const scale = Math.max(ad.length, bd.length);
  const A = BigInt(ai + ad.padEnd(scale, "0"));
  const B = BigInt(bi + bd.padEnd(scale, "0"));
  const sum = A + B;
  const s = sum.toString().padStart(scale + 1, "0");
  return scale
    ? `${s.slice(0, -scale)}.${s.slice(-scale).replace(/0+$/, "")}`.replace(
        /\.$/,
        "",
      )
    : s;
}

function sub(a: string, b: string): string {
  if (!a.includes(".") && !b.includes("."))
    return (BigInt(a) - BigInt(b)).toString();
  const [ai, ad = ""] = a.split(".");
  const [bi, bd = ""] = b.split(".");
  const scale = Math.max(ad.length, bd.length);
  const A = BigInt(ai + ad.padEnd(scale, "0"));
  const B = BigInt(bi + bd.padEnd(scale, "0"));
  const diff = A - B;
  const s = diff.toString().padStart(scale + 1, "0");
  return scale
    ? `${s.slice(0, -scale)}.${s.slice(-scale).replace(/0+$/, "")}`.replace(
        /\.$/,
        "",
      )
    : s;
}

export async function withdrawFromLock(
  db: D1Database,
  id: string,
  input: WithdrawInput,
): Promise<Lock> {
  const now = Date.now();
  const lock = await getLock(db, id);
  const newWithdrawn = add(lock.amount_withdrawn, input.amount);
  // determine if fully withdrawn
  const remaining = sub(lock.amount_total, newWithdrawn);
  const isFully = remaining === "0" || /^0(?:\.0+)?$/.test(remaining);
  const status: LockStatus = isFully ? "withdrawn" : "active";

  const upd = db
    .prepare(
      `UPDATE locks SET amount_withdrawn = ?2, status = ?3, updated_at = ?4, tx_signature = COALESCE(?5, tx_signature) WHERE id = ?1`,
    )
    .bind(id, newWithdrawn, status, now, input.tx_signature ?? null);
  const ev = db
    .prepare(
      `INSERT INTO lock_events (id, lock_id, type, amount_delta, tx_signature, created_at, note)
     VALUES (?1, ?2, 'withdraw', ?3, ?4, ?5, ?6)`,
    )
    .bind(
      crypto.randomUUID(),
      id,
      `-${input.amount}`,
      input.tx_signature ?? null,
      now,
      input.note ?? null,
    );
  const res = await db.batch([upd, ev]);
  if (res.some((r) => (r as D1Result).success === false))
    throw new Error("Failed to withdraw");
  return getLock(db, id);
}

export interface ListLocksFilter {
  wallet?: string;
  token_mint?: string;
  status?: LockStatus;
}

export async function listLocks(
  db: D1Database,
  filter: ListLocksFilter = {},
): Promise<Lock[]> {
  const where: string[] = [];
  const binds: any[] = [];
  let n = 1;
  if (filter.wallet) {
    where.push(`wallet = ?${n++}`);
    binds.push(filter.wallet);
  }
  if (filter.token_mint) {
    where.push(`token_mint = ?${n++}`);
    binds.push(filter.token_mint);
  }
  if (filter.status) {
    where.push(`status = ?${n++}`);
    binds.push(filter.status);
  }
  const sql = `SELECT * FROM locks ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
  const stmt = db.prepare(sql).bind(...binds);
  const { results } = await stmt.all<Lock>();
  return results || [];
}

export async function listEvents(
  db: D1Database,
  lockId: string,
): Promise<LockEvent[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM lock_events WHERE lock_id = ?1 ORDER BY created_at ASC`,
    )
    .bind(lockId)
    .all<LockEvent>();
  return results || [];
}
