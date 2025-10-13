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
};

const ADMIN_WALLET = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

// In-memory store (per server instance) with on-disk persistence to data/p2p-store.json
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "p2p-store.json");

const store: {
  posts: P2PPost[];
  messages: Record<string, TradeMessage[]>;
  proofs: Record<string, { id: string; filename: string; data: string; ts: number }[]>;
} = (globalThis as any).__P2P_STORE || {
  posts: [],
  messages: {},
  proofs: {},
};
(globalThis as any).__P2P_STORE = store;

async function saveStoreToFile() {
  try {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
    await fsPromises.writeFile(
      DATA_FILE,
      JSON.stringify({ posts: store.posts, messages: store.messages, proofs: store.proofs }, null, 2),
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
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.posts)) store.posts = parsed.posts as P2PPost[];
      if (parsed.messages && typeof parsed.messages === "object") store.messages = parsed.messages;
      if (parsed.proofs && typeof parsed.proofs === "object") store.proofs = parsed.proofs;
    }
  }
} catch (e) {
  // ignore
}

export function listPosts() {
  return { posts: store.posts };
}

export function getPost(id: string) {
  return store.posts.find((p) => p.id === id) || null;
}

export function createOrUpdatePost(payload: any, adminWalletHeader?: string) {
  const admin = adminWalletHeader || payload?.adminWallet || "";
  if (admin !== ADMIN_WALLET) {
    return { error: "unauthorized", status: 401 } as const;
  }
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
    return accountName || accountNumber ? { accountName, accountNumber } : undefined;
  };

  if (payload?.id) {
    const idx = store.posts.findIndex((p) => p.id === payload.id);
    if (idx === -1) return { error: "not found", status: 404 } as const;

    const existing = store.posts[idx];
    const updated: P2PPost = {
      ...existing,
      type: payload?.type ?? existing.type,
      token: payload?.token ?? existing.token,
      pricePkr: payload?.pricePkr != null ? Number(payload.pricePkr) : existing.pricePkr,
      pricePerUSDC: normPricePerUSDC ?? existing.pricePerUSDC,
      pricePerSOL: normPricePerSOL ?? existing.pricePerSOL,
      minToken: payload?.minToken != null ? Number(payload.minToken) : existing.minToken,
      maxToken: payload?.maxToken != null ? Number(payload.maxToken) : existing.maxToken,
      paymentMethod: payload?.paymentMethod ?? existing.paymentMethod,
      walletAddress: (payload?.type ?? existing.type) === "sell" ? undefined : payload?.walletAddress ?? existing.walletAddress,
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
    walletAddress: payload?.type === "sell" ? undefined : payload?.walletAddress || "",
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

export function addTradeMessage(tradeId: string, message: string, from: string) {
  if (!message) return { error: "invalid message", status: 400 } as const;
  const entry: TradeMessage = {
    id: `m-${Date.now()}`,
    message,
    from: from || "unknown",
    ts: Date.now(),
  };
  store.messages[tradeId] = store.messages[tradeId] || [];
  store.messages[tradeId].push(entry);
  void saveStoreToFile();
  return { message: entry, status: 201 } as const;
}

export function uploadProof(tradeId: string, proof: { filename: string; data: string }) {
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
