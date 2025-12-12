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
  buyer_wallet?: string;
  token: string;
  token_amount?: string;
  amountTokens?: number;
  pkr_amount?: number;
  amountPKR?: number;
  minAmountPKR?: number;
  maxAmountPKR?: number;
  minAmountTokens?: number;
  maxAmountTokens?: number;
  payment_method?: string;
  paymentMethod?: string;
  status: OrderStatus;
  online?: boolean;
  created_at?: number;
  createdAt?: number;
  updated_at?: number;
  updatedAt?: number;
  account_name?: string;
  accountName?: string;
  account_number?: string;
  accountNumber?: string;
  wallet_address?: string;
  walletAddress?: string;
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
  buyerPaymentConfirmed?: boolean;
  sellerPaymentConfirmed?: boolean;
  buyerConfirmedAt?: number;
  sellerConfirmedAt?: number;
}

export interface TradeMessage {
  id: string;
  room_id: string;
  sender_wallet: string;
  message: string;
  attachment_url?: string;
  created_at: number;
}

const API_BASE =
  (import.meta as any).env?.VITE_P2P_API || window.location.origin;

// ===== P2P ORDERS =====

export async function listP2POrders(filters?: {
  type?: OrderType;
  status?: OrderStatus;
  token?: string;
  online?: boolean;
}): Promise<P2POrder[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.token) params.set("token", filters.token);
  if (filters?.online !== undefined)
    params.set("online", String(filters.online));

  const res = await fetch(`${API_BASE}/api/p2p/orders?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to list orders: ${res.status}`);
  const data = await res.json();
  return data.orders || [];
}

export async function getP2POrder(orderId: string): Promise<P2POrder> {
  const res = await fetch(
    `${API_BASE}/api/p2p/orders/${encodeURIComponent(orderId)}`,
  );
  if (!res.ok) throw new Error(`Failed to get order: ${res.status}`);
  const data = await res.json();
  return data.order;
}

export async function createP2POrder(input: {
  type: OrderType;
  creator_wallet: string;
  token: string;
  token_amount: string;
  pkr_amount: number;
  payment_method: string;
  online: boolean;
  account_name?: string;
  account_number?: string;
  wallet_address?: string;
}): Promise<P2POrder> {
  const res = await fetch(`${API_BASE}/api/p2p/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create order: ${res.status}`);
  const data = await res.json();
  return data;
}

export async function updateP2POrder(
  orderId: string,
  patch: Partial<Omit<P2POrder, "id" | "created_at">>,
): Promise<P2POrder> {
  const res = await fetch(
    `${API_BASE}/api/p2p/orders/${encodeURIComponent(orderId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) throw new Error(`Failed to update order: ${res.status}`);
  const data = await res.json();
  return data.order;
}

export async function deleteP2POrder(orderId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/p2p/orders/${encodeURIComponent(orderId)}`,
    {
      method: "DELETE",
    },
  );
  if (!res.ok) throw new Error(`Failed to delete order: ${res.status}`);
}

// ===== TRADE ROOMS =====

export async function listTradeRooms(wallet?: string): Promise<TradeRoom[]> {
  const params = new URLSearchParams();
  if (wallet) params.set("wallet", wallet);

  const res = await fetch(`${API_BASE}/api/p2p/rooms?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to list rooms: ${res.status}`);
  const data = await res.json();
  return data.rooms || [];
}

export async function getTradeRoom(roomId: string): Promise<TradeRoom> {
  const res = await fetch(
    `${API_BASE}/api/p2p/rooms/${encodeURIComponent(roomId)}`,
  );
  if (!res.ok) throw new Error(`Failed to get room: ${res.status}`);
  const data = await res.json();
  return data.room;
}

export async function createTradeRoom(input: {
  buyer_wallet: string;
  seller_wallet: string;
  order_id: string;
}): Promise<TradeRoom> {
  const res = await fetch(`${API_BASE}/api/p2p/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create room: ${res.status}`);
  const data = await res.json();
  return data.room;
}

export async function updateTradeRoomStatus(
  roomId: string,
  status: TradeRoom["status"],
): Promise<TradeRoom> {
  const res = await fetch(
    `${API_BASE}/api/p2p/rooms/${encodeURIComponent(roomId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) throw new Error(`Failed to update room: ${res.status}`);
  const data = await res.json();
  return data.room;
}

export async function confirmPayment(
  roomId: string,
  walletAddress: string,
): Promise<{
  room: TradeRoom;
  autoReleased: boolean;
  message: string;
}> {
  const res = await fetch(
    `${API_BASE}/api/p2p/rooms/${encodeURIComponent(roomId)}/confirm-payment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    },
  );
  if (!res.ok) throw new Error(`Failed to confirm payment: ${res.status}`);
  const data = await res.json();
  return {
    room: data.room,
    autoReleased: data.autoReleased,
    message: data.message,
  };
}

// ===== TRADE MESSAGES =====

export async function listTradeMessages(
  roomId: string,
): Promise<TradeMessage[]> {
  const res = await fetch(
    `${API_BASE}/api/p2p/rooms/${encodeURIComponent(roomId)}/messages`,
  );
  if (!res.ok) throw new Error(`Failed to list messages: ${res.status}`);
  const data = await res.json();
  return data.messages || [];
}

export async function addTradeMessage(input: {
  room_id: string;
  sender_wallet: string;
  message: string;
  attachment_url?: string;
}): Promise<TradeMessage> {
  const res = await fetch(
    `${API_BASE}/api/p2p/rooms/${encodeURIComponent(input.room_id)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_wallet: input.sender_wallet,
        message: input.message,
        attachment_url: input.attachment_url,
      }),
    },
  );
  if (!res.ok) throw new Error(`Failed to add message: ${res.status}`);
  const data = await res.json();
  return data.message;
}
