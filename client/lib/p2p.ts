// ---------------------------
// 🔧 Configuration Constants
// ---------------------------
import { resolveApiUrl } from "./api-client";

export const ADMIN_WALLET = "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA";

// ---------------------------
// 🧩 Types
// ---------------------------
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
  paymentDetails?: {
    accountName: string;
    accountNumber: string;
  };
  createdAt: number;
  updatedAt: number;
};

// ---------------------------
// 📡 API Functions
// ---------------------------

export async function listOrders(roomId: string = "global") {
  const url = resolveApiUrl(`/api/orders?roomId=${encodeURIComponent(roomId)}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load orders: ${res.status}`);
  return res.json() as Promise<{ orders: any[] }>;
}

export async function createOrder(
  input: {
    side: "buy" | "sell";
    amountPKR: number;
    quoteAsset: string;
    pricePKRPerQuote: number;
    paymentMethod: string; // only easypaisa allowed by server
    roomId?: string;
    createdBy?: string;
  },
  adminToken: string,
) {
  const url = resolveApiUrl(`/api/orders`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateOrder(
  id: string,
  patch: Partial<{
    side: "buy" | "sell";
    amountPKR: number;
    quoteAsset: string;
    pricePKRPerQuote: number;
    paymentMethod: string;
  }>,
  adminToken: string,
) {
  const url = resolveApiUrl(`/api/orders/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteOrder(id: string, adminToken: string) {
  const url = resolveApiUrl(`/api/orders/${encodeURIComponent(id)}`);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
