export type OrderType = "buy" | "sell";
export type OrderStatus =
  | "active"
  | "pending"
  | "completed"
  | "cancelled"
  | "disputed";

export interface P2POrder {
  id: string;
  type: OrderType;
  creator_wallet: string;
  token: string; // USDC, SOL, FIXERCOIN
  token_amount: string; // amount of token to trade
  pkr_amount: number; // amount in PKR
  payment_method: string; // easypaisa, bank, etc
  status: OrderStatus;
  online: boolean;
  created_at: number;
  updated_at: number;
  // For buy orders
  account_name?: string;
  account_number?: string;
  // For sell orders
  wallet_address?: string;
}

export interface TradeRoom {
  id: string;
  buyer_wallet: string;
  seller_wallet: string;
  order_id: string;
  status:
    | "pending"
    | "payment_confirmed"
    | "assets_transferred"
    | "completed"
    | "cancelled";
  created_at: number;
  updated_at: number;
}

export interface TradeMessage {
  id: string;
  room_id: string;
  sender_wallet: string;
  message: string;
  attachment_url?: string;
  created_at: number;
}

export async function ensureP2PSchema(db: D1Database) {
  const schema = `
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS p2p_orders (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
      creator_wallet TEXT NOT NULL,
      token TEXT NOT NULL,
      token_amount TEXT NOT NULL,
      pkr_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'completed', 'cancelled', 'disputed')) DEFAULT 'active',
      online BOOLEAN NOT NULL DEFAULT 1,
      account_name TEXT,
      account_number TEXT,
      wallet_address TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_p2p_orders_creator ON p2p_orders(creator_wallet);
    CREATE INDEX IF NOT EXISTS idx_p2p_orders_type ON p2p_orders(type);
    CREATE INDEX IF NOT EXISTS idx_p2p_orders_status ON p2p_orders(status);
    CREATE INDEX IF NOT EXISTS idx_p2p_orders_token ON p2p_orders(token);
    
    CREATE TABLE IF NOT EXISTS trade_rooms (
      id TEXT PRIMARY KEY,
      buyer_wallet TEXT NOT NULL,
      seller_wallet TEXT NOT NULL,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'payment_confirmed', 'assets_transferred', 'completed', 'cancelled')) DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES p2p_orders(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_trade_rooms_buyer ON trade_rooms(buyer_wallet);
    CREATE INDEX IF NOT EXISTS idx_trade_rooms_seller ON trade_rooms(seller_wallet);
    CREATE INDEX IF NOT EXISTS idx_trade_rooms_order ON trade_rooms(order_id);
    CREATE INDEX IF NOT EXISTS idx_trade_rooms_status ON trade_rooms(status);
    
    CREATE TABLE IF NOT EXISTS trade_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender_wallet TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_url TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES trade_rooms(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_trade_messages_room ON trade_messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_trade_messages_sender ON trade_messages(sender_wallet);
  `;

  await db.batch(
    schema
      .split(";\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sql) => db.prepare(sql)),
  );
}

// ===== P2P ORDERS =====

export async function createP2POrder(
  db: D1Database,
  input: Omit<P2POrder, "id" | "created_at" | "updated_at">,
): Promise<P2POrder> {
  const now = Date.now();
  const id = `order-${now}-${Math.random().toString(36).slice(2, 8)}`;

  const stmt = db.prepare(`
    INSERT INTO p2p_orders 
    (id, type, creator_wallet, token, token_amount, pkr_amount, payment_method, status, online, account_name, account_number, wallet_address, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await stmt
    .bind(
      id,
      input.type,
      input.creator_wallet,
      input.token,
      input.token_amount,
      input.pkr_amount,
      input.payment_method,
      input.status,
      input.online ? 1 : 0,
      input.account_name || null,
      input.account_number || null,
      input.wallet_address || null,
      now,
      now,
    )
    .run();

  return getP2POrder(db, id);
}

export async function getP2POrder(
  db: D1Database,
  id: string,
): Promise<P2POrder> {
  const row = await db
    .prepare(`SELECT * FROM p2p_orders WHERE id = ?`)
    .bind(id)
    .first<any>();

  if (!row) throw new Error("Order not found");

  return {
    ...row,
    online: Boolean(row.online),
  };
}

export async function listP2POrders(
  db: D1Database,
  filters?: {
    type?: OrderType;
    status?: OrderStatus;
    token?: string;
    online?: boolean;
  },
): Promise<P2POrder[]> {
  let sql = `SELECT * FROM p2p_orders WHERE 1=1`;
  const binds: any[] = [];

  if (filters?.type) {
    sql += ` AND type = ?`;
    binds.push(filters.type);
  }
  if (filters?.status) {
    sql += ` AND status = ?`;
    binds.push(filters.status);
  }
  if (filters?.token) {
    sql += ` AND token = ?`;
    binds.push(filters.token);
  }
  if (filters?.online !== undefined) {
    sql += ` AND online = ?`;
    binds.push(filters.online ? 1 : 0);
  }

  sql += ` ORDER BY created_at DESC`;

  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<any>();
  return (results || []).map((r) => ({ ...r, online: Boolean(r.online) }));
}

export async function updateP2POrder(
  db: D1Database,
  id: string,
  patch: Partial<Omit<P2POrder, "id" | "created_at">>,
): Promise<P2POrder> {
  const now = Date.now();
  const order = await getP2POrder(db, id);

  const updated: P2POrder = {
    ...order,
    ...patch,
    updated_at: now,
  };

  const stmt = db.prepare(`
    UPDATE p2p_orders 
    SET type = ?, status = ?, online = ?, account_name = ?, account_number = ?, wallet_address = ?, updated_at = ?
    WHERE id = ?
  `);

  await stmt
    .bind(
      updated.type,
      updated.status,
      updated.online ? 1 : 0,
      updated.account_name || null,
      updated.account_number || null,
      updated.wallet_address || null,
      now,
      id,
    )
    .run();

  return getP2POrder(db, id);
}

export async function deleteP2POrder(
  db: D1Database,
  id: string,
): Promise<void> {
  await db.prepare(`DELETE FROM p2p_orders WHERE id = ?`).bind(id).run();
}

// ===== TRADE ROOMS =====

export async function createTradeRoom(
  db: D1Database,
  input: Omit<TradeRoom, "id" | "created_at" | "updated_at">,
): Promise<TradeRoom> {
  const now = Date.now();
  const id = `room-${now}-${Math.random().toString(36).slice(2, 8)}`;

  await db
    .prepare(
      `
      INSERT INTO trade_rooms (id, buyer_wallet, seller_wallet, order_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      id,
      input.buyer_wallet,
      input.seller_wallet,
      input.order_id,
      input.status,
      now,
      now,
    )
    .run();

  return getTradeRoom(db, id);
}

export async function getTradeRoom(
  db: D1Database,
  id: string,
): Promise<TradeRoom> {
  const row = await db
    .prepare(`SELECT * FROM trade_rooms WHERE id = ?`)
    .bind(id)
    .first<TradeRoom>();

  if (!row) throw new Error("Trade room not found");
  return row;
}

export async function listTradeRooms(
  db: D1Database,
  wallet?: string,
): Promise<TradeRoom[]> {
  let sql = `SELECT * FROM trade_rooms WHERE 1=1`;
  const binds: any[] = [];

  if (wallet) {
    sql += ` AND (buyer_wallet = ? OR seller_wallet = ?)`;
    binds.push(wallet, wallet);
  }

  sql += ` ORDER BY created_at DESC`;

  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<TradeRoom>();
  return results || [];
}

export async function updateTradeRoom(
  db: D1Database,
  id: string,
  status: TradeRoom["status"],
): Promise<TradeRoom> {
  const now = Date.now();
  await db
    .prepare(`UPDATE trade_rooms SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, now, id)
    .run();

  return getTradeRoom(db, id);
}

// ===== TRADE MESSAGES =====

export async function addTradeMessage(
  db: D1Database,
  input: Omit<TradeMessage, "id" | "created_at">,
): Promise<TradeMessage> {
  const now = Date.now();
  const id = `msg-${now}-${Math.random().toString(36).slice(2, 8)}`;

  await db
    .prepare(
      `
      INSERT INTO trade_messages (id, room_id, sender_wallet, message, attachment_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      id,
      input.room_id,
      input.sender_wallet,
      input.message,
      input.attachment_url || null,
      now,
    )
    .run();

  return getTradeMessage(db, id);
}

export async function getTradeMessage(
  db: D1Database,
  id: string,
): Promise<TradeMessage> {
  const row = await db
    .prepare(`SELECT * FROM trade_messages WHERE id = ?`)
    .bind(id)
    .first<TradeMessage>();

  if (!row) throw new Error("Message not found");
  return row;
}

export async function listTradeMessages(
  db: D1Database,
  roomId: string,
): Promise<TradeMessage[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM trade_messages WHERE room_id = ? ORDER BY created_at ASC`,
    )
    .bind(roomId)
    .all<TradeMessage>();

  return results || [];
}
