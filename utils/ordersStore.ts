import { randomUUID } from "crypto";

export type StoredOrder = {
  id: string;
  roomId: string;
  side: "buy" | "sell";
  amountPKR: number;
  quoteAsset: string;
  pricePKRPerQuote: number;
  paymentMethod: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  accountName?: string;
  accountNumber?: string;
  minQuoteAmount?: number;
  maxQuoteAmount?: number;
};

type OrdersByRoom = Map<string, StoredOrder[]>;

type OrderStoreShape = {
  rooms: OrdersByRoom;
};

function getGlobalStore(): OrderStoreShape {
  const globalKey = "__EXPRESS_ORDER_STORE";
  const existing = (globalThis as any)[globalKey] as
    | OrderStoreShape
    | undefined;
  if (existing && existing.rooms instanceof Map) {
    return existing;
  }
  const fresh: OrderStoreShape = { rooms: new Map() };
  (globalThis as any)[globalKey] = fresh;
  return fresh;
}

function generateId(prefix: string): string {
  try {
    return `${prefix}-${randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeOrder(input: StoredOrder): StoredOrder {
  return {
    ...input,
    amountPKR: Number(input.amountPKR) || 0,
    pricePKRPerQuote: Number(input.pricePKRPerQuote) || 0,
    minQuoteAmount:
      input.minQuoteAmount != null ? Number(input.minQuoteAmount) : undefined,
    maxQuoteAmount:
      input.maxQuoteAmount != null ? Number(input.maxQuoteAmount) : undefined,
  };
}

function getRoomOrders(roomId: string): StoredOrder[] {
  const store = getGlobalStore();
  const key = roomId || "global";
  if (!store.rooms.has(key)) {
    store.rooms.set(key, []);
  }
  return store.rooms.get(key)!;
}

export function listOrders(roomId: string = "global"): {
  orders: StoredOrder[];
} {
  const orders = [...getRoomOrders(roomId)].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  return { orders };
}

export function createOrder(
  roomId: string,
  input: {
    side: "buy" | "sell";
    amountPKR: number;
    quoteAsset: string;
    pricePKRPerQuote: number;
    paymentMethod: string;
    createdBy: string;
    accountName?: string;
    accountNumber?: string;
    minQuoteAmount?: number;
    maxQuoteAmount?: number;
  },
): StoredOrder {
  const now = Date.now();
  const order: StoredOrder = normalizeOrder({
    id: generateId("order"),
    roomId: roomId || "global",
    side: input.side,
    amountPKR: Number(input.amountPKR) || 0,
    quoteAsset: String(input.quoteAsset || "USDC").toUpperCase(),
    pricePKRPerQuote: Number(input.pricePKRPerQuote) || 0,
    paymentMethod: String(input.paymentMethod || "easypaisa"),
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy || "admin",
    accountName: input.accountName ? String(input.accountName) : undefined,
    accountNumber: input.accountNumber
      ? String(input.accountNumber)
      : undefined,
    minQuoteAmount: toNumber(input.minQuoteAmount) ?? undefined,
    maxQuoteAmount: toNumber(input.maxQuoteAmount) ?? undefined,
  });

  const orders = getRoomOrders(roomId || "global");
  orders.unshift(order);
  return order;
}

export function updateOrder(
  roomId: string,
  id: string,
  patch: Partial<{
    side: "buy" | "sell";
    amountPKR: number;
    quoteAsset: string;
    pricePKRPerQuote: number;
    paymentMethod: string;
    accountName?: string;
    accountNumber?: string;
    minQuoteAmount?: number;
    maxQuoteAmount?: number;
  }>,
): StoredOrder {
  const orders = getRoomOrders(roomId || "global");
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) {
    throw Object.assign(new Error("Order not found"), { status: 404 });
  }

  const existing = orders[idx];
  const now = Date.now();
  const updated: StoredOrder = normalizeOrder({
    ...existing,
    side: patch.side ?? existing.side,
    amountPKR: toNumber(patch.amountPKR) ?? existing.amountPKR,
    quoteAsset: patch.quoteAsset
      ? String(patch.quoteAsset).toUpperCase()
      : existing.quoteAsset,
    pricePKRPerQuote:
      toNumber(patch.pricePKRPerQuote) ?? existing.pricePKRPerQuote,
    paymentMethod: patch.paymentMethod
      ? String(patch.paymentMethod)
      : existing.paymentMethod,
    accountName:
      patch.accountName != null
        ? String(patch.accountName)
        : existing.accountName,
    accountNumber:
      patch.accountNumber != null
        ? String(patch.accountNumber)
        : existing.accountNumber,
    minQuoteAmount:
      patch.minQuoteAmount !== undefined
        ? toNumber(patch.minQuoteAmount)
        : existing.minQuoteAmount,
    maxQuoteAmount:
      patch.maxQuoteAmount !== undefined
        ? toNumber(patch.maxQuoteAmount)
        : existing.maxQuoteAmount,
    updatedAt: now,
  });

  if (
    updated.minQuoteAmount != null &&
    updated.maxQuoteAmount != null &&
    updated.minQuoteAmount > updated.maxQuoteAmount
  ) {
    throw Object.assign(
      new Error("Minimum amount cannot exceed maximum amount"),
      { status: 400 },
    );
  }

  orders[idx] = updated;
  return updated;
}

export function deleteOrder(roomId: string, id: string): void {
  const orders = getRoomOrders(roomId || "global");
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) {
    throw Object.assign(new Error("Order not found"), { status: 404 });
  }
  orders.splice(idx, 1);
}
