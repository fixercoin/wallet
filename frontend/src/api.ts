export const API_BASE = import.meta.env.VITE_P2P_URL || "";

export async function listOrders(roomId: string = "global") {
  const res = await fetch(
    `${API_BASE}/api/orders?roomId=${encodeURIComponent(roomId)}`,
  );
  if (!res.ok) throw new Error(`Failed to load orders: ${res.status}`);
  return res.json() as Promise<{ orders: any[] }>;
}

export async function createOrder(
  input: {
    side: "buy" | "sell";
    amountPKR: number;
    quoteAsset: string;
    pricePKRPerQuote: number;
    paymentMethod: string;
    roomId?: string;
    createdBy?: string;
  },
  adminToken: string,
) {
  const res = await fetch(`${API_BASE}/api/orders`, {
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
