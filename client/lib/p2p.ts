export const API_BASE = (import.meta as any).env?.VITE_P2P_URL
  ? String((import.meta as any).env.VITE_P2P_URL).replace(/\/$/, "")
  : "";

export async function listOrders(roomId: string = "global") {
  const base = API_BASE;
  const url = `${base}/api/orders?roomId=${encodeURIComponent(roomId)}`;
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
  const base = API_BASE;
  const res = await fetch(`${base}/api/orders`, {
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
