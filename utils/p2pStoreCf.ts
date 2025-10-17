// Cloudflare D1-backed P2P storage implementation
// Falls back gracefully if DB is unavailable (callers should branch before calling)

export type P2PPost = {
  id: string;
  type: "buy" | "sell";
  token: string;
  pricePkr: number;
  pricePerUSDC?: number | null;
  pricePerSOL?: number | null;
  minToken: number;
  maxToken: number;
  paymentMethod: string;
  walletAddress?: string;
  availability: "online" | "offline";
  paymentDetails?: { accountName: string; accountNumber: string };
  createdAt: number;
  updatedAt: number;
};

export type TradeMessage = {
  id: string;
  message: string;
  from: string;
  ts: number;
  tradeId: string;
};

export type EasypaisaPayment = {
  id: string;
  msisdn: string;
  amount: number;
  currency?: string;
  reference?: string;
  sender?: string;
  ts: number;
};

// Keep admin wallet consistent with client & legacy store
const ADMIN_WALLET = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

type D1 = any; // Avoid strict type coupling; Cloudflare provides D1Database at runtime

export async function ensureSchema(db: D1) {
  // Create tables if not exist
  const stmts = [
    `CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      token TEXT NOT NULL,
      price_pkr REAL NOT NULL,
      price_per_usdc REAL,
      price_per_sol REAL,
      min_token REAL NOT NULL,
      max_token REAL NOT NULL,
      payment_method TEXT NOT NULL,
      wallet_address TEXT,
      availability TEXT NOT NULL,
      payment_account_name TEXT,
      payment_account_number TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL,
      message TEXT NOT NULL,
      sender TEXT NOT NULL,
      ts INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_trade_ts ON messages(trade_id, ts)`,
    `CREATE TABLE IF NOT EXISTS easypaisa (
      id TEXT PRIMARY KEY,
      msisdn TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT,
      reference TEXT,
      sender TEXT,
      ts INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_easypaisa_msisdn_ts ON easypaisa(msisdn, ts)`,
  ];
  for (const sql of stmts) {
    await db.prepare(sql).run();
  }
}

function sanitizeDetails(p: any) {
  const d = p?.paymentDetails || {};
  const accountName = String(d?.accountName || "").slice(0, 128);
  const accountNumber = String(d?.accountNumber || "").slice(0, 64);
  return accountName || accountNumber
    ? { accountName, accountNumber }
    : undefined;
}

export async function listPostsCF(db: D1) {
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, type, token, price_pkr as pricePkr, price_per_usdc as pricePerUSDC,
              price_per_sol as pricePerSOL, min_token as minToken, max_token as maxToken,
              payment_method as paymentMethod, wallet_address as walletAddress,
              availability,
              payment_account_name as accountName,
              payment_account_number as accountNumber,
              created_at as createdAt, updated_at as updatedAt
       FROM posts
       ORDER BY updated_at DESC`,
    )
    .all();
  const posts: P1[] = [] as any;
  const mapped = (results || []).map((r: any) => ({
    id: r.id,
    type: r.type,
    token: r.token,
    pricePkr: r.pricePkr,
    pricePerUSDC: r.pricePerUSDC ?? null,
    pricePerSOL: r.pricePerSOL ?? null,
    minToken: r.minToken,
    maxToken: r.maxToken,
    paymentMethod: r.paymentMethod,
    walletAddress: r.walletAddress || undefined,
    availability: r.availability === "offline" ? "offline" : "online",
    paymentDetails:
      r.accountName || r.accountNumber
        ? {
            accountName: r.accountName || "",
            accountNumber: r.accountNumber || "",
          }
        : undefined,
    createdAt: Number(r.createdAt) || 0,
    updatedAt: Number(r.updatedAt) || 0,
  })) as P2PPost[];
  return { posts: mapped } as { posts: P2PPost[] };
}

export async function getPostCF(db: D1, id: string) {
  await ensureSchema(db);
  const r = await db
    .prepare(
      `SELECT id, type, token, price_pkr as pricePkr, price_per_usdc as pricePerUSDC,
              price_per_sol as pricePerSOL, min_token as minToken, max_token as maxToken,
              payment_method as paymentMethod, wallet_address as walletAddress,
              availability,
              payment_account_name as accountName,
              payment_account_number as accountNumber,
              created_at as createdAt, updated_at as updatedAt
       FROM posts WHERE id = ?`,
    )
    .bind(id)
    .first();
  if (!r) return null;
  const post: P2PPost = {
    id: r.id,
    type: r.type,
    token: r.token,
    pricePkr: r.pricePkr,
    pricePerUSDC: r.pricePerUSDC ?? null,
    pricePerSOL: r.pricePerSOL ?? null,
    minToken: r.minToken,
    maxToken: r.maxToken,
    paymentMethod: r.paymentMethod,
    walletAddress: r.walletAddress || undefined,
    availability: r.availability === "offline" ? "offline" : "online",
    paymentDetails:
      r.accountName || r.accountNumber
        ? {
            accountName: r.accountName || "",
            accountNumber: r.accountNumber || "",
          }
        : undefined,
    createdAt: Number(r.createdAt) || 0,
    updatedAt: Number(r.updatedAt) || 0,
  };
  return post;
}

export async function deletePostCF(
  db: D1,
  id: string,
  adminWalletHeader?: string,
) {
  const admin = adminWalletHeader || "";
  if (admin !== ADMIN_WALLET) {
    return { error: "unauthorized", status: 401 } as const;
  }
  await ensureSchema(db);
  const existing = await getPostCF(db, id);
  if (!existing) return { error: "not_found", status: 404 } as const;
  await db.prepare(`DELETE FROM posts WHERE id = ?`).bind(id).run();
  return { ok: true, post: existing, status: 200 } as const;
}

export async function createOrUpdatePostCF(
  db: D1,
  payload: any,
  adminWalletHeader?: string,
) {
  const admin = adminWalletHeader || payload?.adminWallet || "";
  if (admin !== ADMIN_WALLET) {
    return { error: "unauthorized", status: 401 } as const;
  }
  await ensureSchema(db);
  const now = Date.now();
  const pricePerUSDC =
    payload?.pricePerUSDC != null && payload.pricePerUSDC !== ""
      ? Number(payload.pricePerUSDC)
      : null;
  const pricePerSOL =
    payload?.pricePerSOL != null && payload.pricePerSOL !== ""
      ? Number(payload.pricePerSOL)
      : null;
  const details = sanitizeDetails(payload);

  if (payload?.id) {
    const existing = await getPostCF(db, payload.id);
    if (!existing) return { error: "not found", status: 404 } as const;
    const updated: P2PPost = {
      ...existing,
      type: payload?.type ?? existing.type,
      token: payload?.token ?? existing.token,
      pricePkr:
        payload?.pricePkr != null
          ? Number(payload.pricePkr)
          : existing.pricePkr,
      pricePerUSDC: pricePerUSDC ?? existing.pricePerUSDC ?? null,
      pricePerSOL: pricePerSOL ?? existing.pricePerSOL ?? null,
      minToken:
        payload?.minToken != null
          ? Number(payload.minToken)
          : existing.minToken,
      maxToken:
        payload?.maxToken != null
          ? Number(payload.maxToken)
          : existing.maxToken,
      paymentMethod: payload?.paymentMethod ?? existing.paymentMethod,
      walletAddress:
        (payload?.type ?? existing.type) === "sell"
          ? undefined
          : (payload?.walletAddress ?? existing.walletAddress),
      availability: payload?.availability === "offline" ? "offline" : "online",
      paymentDetails: details ?? existing.paymentDetails,
      updatedAt: now,
      createdAt: existing.createdAt,
    };

    await db
      .prepare(
        `UPDATE posts SET type=?, token=?, price_pkr=?, price_per_usdc=?, price_per_sol=?,
         min_token=?, max_token=?, payment_method=?, wallet_address=?, availability=?,
         payment_account_name=?, payment_account_number=?, updated_at=?
         WHERE id=?`,
      )
      .bind(
        updated.type,
        updated.token,
        updated.pricePkr,
        updated.pricePerUSDC,
        updated.pricePerSOL,
        updated.minToken,
        updated.maxToken,
        updated.paymentMethod,
        updated.walletAddress ?? null,
        updated.availability,
        updated.paymentDetails?.accountName ?? null,
        updated.paymentDetails?.accountNumber ?? null,
        updated.updatedAt,
        updated.id,
      )
      .run();

    return { post: updated, status: 200 } as const;
  }

  const id = `post-${now}`;
  const post: P2PPost = {
    id,
    type: payload?.type || "buy",
    token: payload?.token || "USDC",
    pricePkr: Number(payload?.pricePkr) || 0,
    pricePerUSDC,
    pricePerSOL,
    minToken: Number(payload?.minToken) || 0,
    maxToken: Number(payload?.maxToken) || 0,
    paymentMethod: payload?.paymentMethod || "bank",
    walletAddress:
      payload?.type === "sell" ? undefined : payload?.walletAddress || "",
    availability: payload?.availability === "offline" ? "offline" : "online",
    paymentDetails: details,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .prepare(
      `INSERT INTO posts (
        id, type, token, price_pkr, price_per_usdc, price_per_sol,
        min_token, max_token, payment_method, wallet_address, availability,
        payment_account_name, payment_account_number, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      post.id,
      post.type,
      post.token,
      post.pricePkr,
      post.pricePerUSDC,
      post.pricePerSOL,
      post.minToken,
      post.maxToken,
      post.paymentMethod,
      post.walletAddress ?? null,
      post.availability,
      post.paymentDetails?.accountName ?? null,
      post.paymentDetails?.accountNumber ?? null,
      post.createdAt,
      post.updatedAt,
    )
    .run();

  return { post, status: 201 } as const;
}

export async function listTradeMessagesCF(db: D1, tradeId: string) {
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, trade_id as tradeId, message, sender as \"from\", ts
       FROM messages WHERE trade_id = ? ORDER BY ts ASC`,
    )
    .bind(tradeId)
    .all();
  return { messages: (results || []) as TradeMessage[] } as const;
}

export async function listRecentTradeMessagesCF(
  db: D1,
  opts?: { since?: number; limit?: number },
) {
  const since = opts?.since ?? 0;
  const limit = opts?.limit ?? 100;
  await ensureSchema(db);
  const { results } = await db
    .prepare(
      `SELECT id, trade_id as tradeId, message, sender as \"from\", ts
       FROM messages WHERE ts > ? ORDER BY ts ASC LIMIT ?`,
    )
    .bind(since, limit)
    .all();
  return { messages: (results || []) as TradeMessage[] } as const;
}

export async function addTradeMessageCF(
  db: D1,
  tradeId: string,
  message: string,
  from: string,
) {
  if (!message) return { error: "invalid message", status: 400 } as const;
  await ensureSchema(db);
  const entry: TradeMessage = {
    id: `m-${Date.now()}`,
    tradeId,
    message,
    from: from || "unknown",
    ts: Date.now(),
  } as any;
  await db
    .prepare(
      `INSERT INTO messages (id, trade_id, message, sender, ts) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(entry.id, tradeId, entry.message, entry.from, entry.ts)
    .run();
  return { message: entry, status: 201 } as const;
}

export async function addEasypaisaPaymentCF(
  db: D1,
  p: {
    msisdn: string;
    amount: number;
    currency?: string;
    reference?: string;
    sender?: string;
    ts?: number;
  },
) {
  await ensureSchema(db);
  const entry: EasypaisaPayment = {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    msisdn: String(p.msisdn),
    amount: Number(p.amount),
    currency: p.currency,
    reference: p.reference,
    sender: p.sender,
    ts: p.ts ?? Date.now(),
  };
  await db
    .prepare(
      `INSERT INTO easypaisa (id, msisdn, amount, currency, reference, sender, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.id,
      entry.msisdn,
      entry.amount,
      entry.currency ?? null,
      entry.reference ?? null,
      entry.sender ?? null,
      entry.ts,
    )
    .run();
  return { payment: entry, status: 201 } as const;
}

export async function listEasypaisaPaymentsCF(
  db: D1,
  filters: { msisdn?: string; since?: number },
) {
  await ensureSchema(db);
  const msisdn = filters.msisdn || "";
  const since = Number(filters.since || 0);
  let sql = `SELECT id, msisdn, amount, currency, reference, sender, ts FROM easypaisa`;
  const args: any[] = [];
  const conds: string[] = [];
  if (msisdn) {
    conds.push(`msisdn = ?`);
    args.push(msisdn);
  }
  if (since) {
    conds.push(`ts >= ?`);
    args.push(since);
  }
  if (conds.length) sql += ` WHERE ` + conds.join(" AND ");
  sql += ` ORDER BY ts DESC`;
  const { results } = await db
    .prepare(sql)
    .bind(...args)
    .all();
  return { payments: (results || []) as EasypaisaPayment[] } as const;
}

export async function recordProofCF(
  db: D1,
  tradeId: string,
  filename: string,
  url?: string | null,
) {
  await ensureSchema(db);
  // Store as message for simplicity with a system sender
  const id = `p-${Date.now()}`;
  const msg = url ? `proof:${filename}:${url}` : `proof:${filename}`;
  await db
    .prepare(
      `INSERT INTO messages (id, trade_id, message, sender, ts) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, tradeId, msg, "system", Date.now())
    .run();
  return { ok: true, status: 201 } as const;
}
