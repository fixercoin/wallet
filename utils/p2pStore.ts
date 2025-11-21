export type P2PPost = {
  id: string;
  type: "buy" | "sell";
  token: "USDC" | "SOL" | "FIXERCOIN" | string;
  pricePkr: number;
  // Optional additional pricing for Fixercoin
  pricePerUSDC?: number | null;
  pricePerSOL?: number | null;
  minToken: number;
  maxToken: number;
  paymentMethod: "bank" | "easypaisa" | "firstpay" | string;
  // For BUY offers only
  walletAddress?: string;
  // Online/Offline visibility option
  availability: "online" | "offline";
  // Payment account details
  paymentDetails?: {
    accountName: string;
    accountNumber: string;
  };
  createdAt: number;
  updatedAt: number;
};

export type TradeMessage = {
  id: string;
  message: string;
  from: string;
  ts: number;
  proof?: { filename: string; url?: string };
};

export type TradeRoom = {
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
};

const ADMIN_WALLET = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

// In-memory store (per server instance) with optional on-disk persistence
// For Netlify serverless functions, file I/O is available but data is ephemeral per invocation
let fsPromises: any = null;
let DATA_FILE: string = "";

// Lazy-load file system module only when needed in Node.js environment
async function getFileSystemModules() {
  if (fsPromises) return { fsPromises, DATA_FILE };

  if (typeof window === "undefined" && typeof process !== "undefined") {
    try {
      const fs = await import("fs");
      const fsp = await import("fs/promises");
      const path = await import("path");
      fsPromises = fsp;
      DATA_FILE = path.join(
        path.resolve(process.cwd(), "data"),
        "p2p-store.json",
      );
    } catch {
      // File system not available (Worker environment)
    }
  }

  return { fsPromises, DATA_FILE };
}

type EasypaisaPayment = {
  id: string;
  msisdn: string;
  amount: number;
  currency?: string;
  reference?: string;
  sender?: string;
  ts: number;
};

const store: {
  posts: P2PPost[];
  messages: Record<string, TradeMessage[]>;
  proofs: Record<
    string,
    { id: string; filename: string; data: string; ts: number }[]
  >;
  easypaisa: EasypaisaPayment[];
  rooms: TradeRoom[];
} = (globalThis as any).__P2P_STORE || {
  posts: [],
  messages: {},
  proofs: {},
  easypaisa: [],
  rooms: [],
};
(globalThis as any).__P2P_STORE = store;

async function saveStoreToFile() {
  try {
    const { fsPromises: fsp, DATA_FILE: dataFile } =
      await getFileSystemModules();
    if (!fsp || !dataFile) {
      // File system not available (browser/Worker environment)
      return;
    }

    const path = await import("path");
    const dataDir = path.dirname(dataFile);
    await fsp.mkdir(dataDir, { recursive: true });
    await fsp.writeFile(
      dataFile,
      JSON.stringify(
        {
          posts: store.posts,
          messages: store.messages,
          proofs: store.proofs,
          easypaisa: store.easypaisa,
          rooms: store.rooms,
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch (e) {
    // best-effort; do not crash server
    try {
      console.error("Failed to persist P2P store:", (e as any)?.message || e);
    } catch {}
  }
}

// Load persisted data on startup (best-effort)
async function loadPersistedData() {
  try {
    const { fsPromises: fsp, DATA_FILE: dataFile } =
      await getFileSystemModules();
    if (!fsp || !dataFile) {
      return;
    }

    const fs = await import("fs");
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, "utf-8");
      const parsed = JSON.parse(raw || "{}");
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.posts))
          store.posts = parsed.posts as P2PPost[];
        if (parsed.messages && typeof parsed.messages === "object")
          store.messages = parsed.messages;
        if (parsed.proofs && typeof parsed.proofs === "object")
          store.proofs = parsed.proofs;
        if (Array.isArray(parsed.easypaisa))
          store.easypaisa = parsed.easypaisa as EasypaisaPayment[];
        if (Array.isArray(parsed.rooms))
          store.rooms = parsed.rooms as TradeRoom[];
      }
    }
  } catch (e) {
    // ignore
  }
}

// Load data on module initialization (in Node.js only)
if (typeof window === "undefined" && typeof process !== "undefined") {
  loadPersistedData().catch(() => {});
}

export function listPosts() {
  return { posts: store.posts };
}

export function deletePost(id: string, adminWalletHeader?: string) {
  const idx = store.posts.findIndex((p) => p.id === id);
  if (idx === -1) return { error: "not_found", status: 404 } as const;
  const removed = store.posts.splice(idx, 1)[0];
  void saveStoreToFile();
  return { ok: true, post: removed, status: 200 } as const;
}

export function getPost(id: string) {
  return store.posts.find((p) => p.id === id) || null;
}

export function createOrUpdatePost(payload: any, adminWalletHeader?: string) {
  const now = Date.now();

  const normPricePerUSDC =
    payload?.pricePerUSDC != null && payload.pricePerUSDC !== ""
      ? Number(payload.pricePerUSDC)
      : null;
  const normPricePerSOL =
    payload?.pricePerSOL != null && payload.pricePerSOL !== ""
      ? Number(payload.pricePerSOL)
      : null;
  const sanitizeDetails = (p: any) => {
    const d = p?.paymentDetails || {};
    const accountName = String(d?.accountName || "").slice(0, 128);
    const accountNumber = String(d?.accountNumber || "").slice(0, 64);
    return accountName || accountNumber
      ? { accountName, accountNumber }
      : undefined;
  };

  if (payload?.id) {
    const idx = store.posts.findIndex((p) => p.id === payload.id);
    if (idx === -1) return { error: "not found", status: 404 } as const;

    const existing = store.posts[idx];
    const updated: P2PPost = {
      ...existing,
      type: payload?.type ?? existing.type,
      token: payload?.token ?? existing.token,
      pricePkr:
        payload?.pricePkr != null
          ? Number(payload.pricePkr)
          : existing.pricePkr,
      pricePerUSDC: normPricePerUSDC ?? existing.pricePerUSDC,
      pricePerSOL: normPricePerSOL ?? existing.pricePerSOL,
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
      paymentDetails: sanitizeDetails(payload) ?? existing.paymentDetails,
      updatedAt: now,
    };
    store.posts[idx] = updated;
    // persist
    void saveStoreToFile();
    return { post: store.posts[idx], status: 200 } as const;
  }

  const id = `post-${now}`;
  const post: P2PPost = {
    id,
    type: payload?.type || "buy",
    token: payload?.token || "USDC",
    pricePkr: Number(payload?.pricePkr) || 0,
    pricePerUSDC: normPricePerUSDC,
    pricePerSOL: normPricePerSOL,
    minToken: Number(payload?.minToken) || 0,
    maxToken: Number(payload?.maxToken) || 0,
    paymentMethod: payload?.paymentMethod || "bank",
    walletAddress:
      payload?.type === "sell" ? undefined : payload?.walletAddress || "",
    availability: payload?.availability === "offline" ? "offline" : "online",
    paymentDetails: sanitizeDetails(payload),
    createdAt: now,
    updatedAt: now,
  };
  store.posts.unshift(post);
  void saveStoreToFile();
  return { post, status: 201 } as const;
}

export function listTradeMessages(tradeId: string) {
  const messages = store.messages[tradeId] || [];
  return { messages };
}

export function listRecentTradeMessages(options?: {
  since?: number;
  limit?: number;
}) {
  const since = options?.since ?? 0;
  const limit = options?.limit ?? 100;
  const flattened: Array<{
    tradeId: string;
    id: string;
    message: string;
    from: string;
    ts: number;
  }> = [];
  for (const [tradeId, msgs] of Object.entries(store.messages)) {
    for (const m of msgs) {
      if (!since || m.ts > since) {
        flattened.push({
          tradeId,
          id: m.id,
          message: m.message,
          from: m.from,
          ts: m.ts,
        });
      }
    }
  }
  flattened.sort((a, b) => a.ts - b.ts);
  return {
    messages: flattened.slice(Math.max(0, flattened.length - limit)),
  } as const;
}

export function addTradeMessage(
  tradeId: string,
  message: string,
  from: string,
  proof?: { filename: string; url?: string },
) {
  if (!message) return { error: "invalid message", status: 400 } as const;
  const entry: TradeMessage = {
    id: `m-${Date.now()}`,
    message,
    from: from || "unknown",
    ts: Date.now(),
    proof,
  };
  store.messages[tradeId] = store.messages[tradeId] || [];
  store.messages[tradeId].push(entry);
  void saveStoreToFile();
  return { message: entry, status: 201 } as const;
}

export function uploadProof(
  tradeId: string,
  proof: { filename: string; data: string },
) {
  if (!proof || !proof.filename || !proof.data) {
    return { error: "invalid proof", status: 400 } as const;
  }
  store.proofs[tradeId] = store.proofs[tradeId] || [];
  store.proofs[tradeId].push({
    id: `p-${Date.now()}`,
    filename: proof.filename,
    data: proof.data,
    ts: Date.now(),
  });
  void saveStoreToFile();
  return { ok: true, status: 201 } as const;
}

export function addEasypaisaPayment(p: {
  msisdn: string;
  amount: number;
  currency?: string;
  reference?: string;
  sender?: string;
  ts?: number;
}) {
  const entry: EasypaisaPayment = {
    id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    msisdn: String(p.msisdn),
    amount: Number(p.amount),
    currency: p.currency,
    reference: p.reference,
    sender: p.sender,
    ts: p.ts ?? Date.now(),
  };
  store.easypaisa.push(entry);
  if (store.easypaisa.length > 500) store.easypaisa.shift();
  void saveStoreToFile();
  return { payment: entry, status: 201 } as const;
}

export function listEasypaisaPayments(filters: {
  msisdn?: string;
  since?: number;
}) {
  let arr = store.easypaisa.slice();
  if (filters.msisdn) arr = arr.filter((p) => p.msisdn === filters.msisdn);
  if (filters.since) arr = arr.filter((p) => p.ts >= Number(filters.since));
  arr.sort((a, b) => b.ts - a.ts);
  return { payments: arr } as const;
}

// ===== TRADE ROOM FUNCTIONS =====

export function listTradeRooms(wallet?: string) {
  let rooms = store.rooms.slice();
  if (wallet) {
    rooms = rooms.filter(
      (r) => r.buyer_wallet === wallet || r.seller_wallet === wallet,
    );
  }
  rooms.sort((a, b) => b.created_at - a.created_at);
  return { rooms } as const;
}

export function getTradeRoom(roomId: string) {
  const room = store.rooms.find((r) => r.id === roomId);
  return room || null;
}

export function createTradeRoom(input: {
  buyer_wallet: string;
  seller_wallet: string;
  order_id: string;
}) {
  const { buyer_wallet, seller_wallet, order_id } = input;
  if (!buyer_wallet || !seller_wallet || !order_id) {
    return { error: "Missing required fields", status: 400 } as const;
  }

  const now = Date.now();
  const room: TradeRoom = {
    id: `room-${now}-${Math.random().toString(36).slice(2, 8)}`,
    buyer_wallet,
    seller_wallet,
    order_id,
    status: "pending",
    created_at: now,
    updated_at: now,
  };

  store.rooms.push(room);
  void saveStoreToFile();
  return { room, status: 201 } as const;
}

export function updateTradeRoom(
  roomId: string,
  updates: Partial<Omit<TradeRoom, "id" | "created_at">>,
) {
  const idx = store.rooms.findIndex((r) => r.id === roomId);
  if (idx === -1) {
    return { error: "Room not found", status: 404 } as const;
  }

  const existing = store.rooms[idx];
  const updated: TradeRoom = {
    ...existing,
    ...updates,
    id: existing.id,
    created_at: existing.created_at,
    updated_at: Date.now(),
  };

  store.rooms[idx] = updated;
  void saveStoreToFile();
  return { room: updated, status: 200 } as const;
}
