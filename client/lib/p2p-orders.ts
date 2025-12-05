/**
 * P2P Orders Management
 * Uses Cloudflare KV through API endpoints for persistent storage
 */

export interface P2POrder {
  id: string;
  walletAddress: string;
  type: "BUY" | "SELL";
  token: string;
  amountTokens: number;
  amountPKR: number;
  paymentMethodId: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "ESCROW_LOCKED" | "DISPUTED";
  createdAt: number;
  updatedAt: number;
  escrowId?: string;
  matchedWith?: string;
}

const API_BASE = "/api/p2p/orders";

/**
 * Get all orders for a wallet
 */
export async function getOrdersByWallet(
  walletAddress: string,
  status?: string,
): Promise<P2POrder[]> {
  try {
    const params = new URLSearchParams();
    params.append("wallet", walletAddress);
    if (status) {
      params.append("status", status);
    }

    const response = await fetch(`${API_BASE}?${params.toString()}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch orders");
    }
    const result = await response.json();
    return result.data || [];
  } catch (e) {
    console.error("[P2P Orders] Error getting orders:", e);
    return [];
  }
}

/**
 * Get a single order by ID
 */
export async function getOrder(orderId: string): Promise<P2POrder | null> {
  try {
    const response = await fetch(
      `${API_BASE}?id=${encodeURIComponent(orderId)}`,
    );
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch order");
    }
    const result = await response.json();
    return result.data || null;
  } catch (e) {
    console.error("[P2P Orders] Error getting order:", e);
    return null;
  }
}

/**
 * Create a new order
 */
export async function createOrder(
  walletAddress: string,
  type: "BUY" | "SELL",
  token: string,
  amountTokens: number,
  amountPKR: number,
  paymentMethodId?: string,
): Promise<P2POrder> {
  try {
    const body = {
      walletAddress,
      type,
      token,
      amountTokens,
      amountPKR,
      paymentMethodId: paymentMethodId || "",
      status: "PENDING",
    };

    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create order");
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error("[P2P Orders] Error creating order:", e);
    throw e;
  }
}

/**
 * Update an order's status
 */
export async function updateOrderStatus(
  orderId: string,
  status: "PENDING" | "COMPLETED" | "CANCELLED",
): Promise<P2POrder> {
  try {
    const body = {
      orderId,
      status,
    };

    const response = await fetch(API_BASE, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update order");
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error("[P2P Orders] Error updating order:", e);
    throw e;
  }
}

/**
 * Delete an order
 */
export async function deleteOrder(
  orderId: string,
  walletAddress: string,
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE}?id=${encodeURIComponent(orderId)}&wallet=${encodeURIComponent(walletAddress)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete order");
    }
  } catch (e) {
    console.error("[P2P Orders] Error deleting order:", e);
    throw e;
  }
}
