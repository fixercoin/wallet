/**
 * P2P Order API Management
 * Uses Cloudflare KV through Express API endpoints for persistent storage
 * Replaces localStorage with server-side KV storage
 */

import type { CreatedOrder } from "./p2p-order-creation";

const API_BASE = "/api/p2p/orders";

/**
 * Get order from server KV storage
 */
export async function getOrderFromAPI(
  orderId: string,
): Promise<CreatedOrder | null> {
  try {
    const response = await fetch(
      `${API_BASE}?id=${encodeURIComponent(orderId)}`,
    );
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error("Failed to fetch order:", response.status);
      return null;
    }
    const data = await response.json();
    const orders = data.orders || [];
    if (orders.length > 0) {
      return orders[0] as CreatedOrder;
    }
    return null;
  } catch (error) {
    console.error("Error fetching order from API:", error);
    return null;
  }
}

/**
 * Get all orders for a wallet
 */
export async function getOrdersByWalletFromAPI(
  walletAddress: string,
): Promise<CreatedOrder[]> {
  try {
    const response = await fetch(
      `${API_BASE}?wallet=${encodeURIComponent(walletAddress)}`,
    );
    if (!response.ok) {
      console.error("Failed to fetch orders:", response.status);
      return [];
    }
    const data = await response.json();
    return (data.orders || []) as CreatedOrder[];
  } catch (error) {
    console.error("Error fetching orders from API:", error);
    return [];
  }
}

/**
 * Create order in server KV storage
 */
export async function createOrderInAPI(
  order: CreatedOrder,
): Promise<CreatedOrder> {
  try {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: order.id,
        type: order.type,
        offerId: order.offerId,
        walletAddress:
          order.type === "BUY" ? order.buyerWallet : order.sellerWallet,
        buyerWallet: order.buyerWallet,
        sellerWallet: order.sellerWallet,
        token: order.token,
        amountTokens: order.amountTokens,
        amountPKR: order.amountPKR,
        pricePKRPerQuote: order.pricePKRPerQuote,
        payment_method: order.payment_method,
        sellerPaymentMethod: order.sellerPaymentMethod,
        status: order.status,
        createdAt: order.createdAt,
        roomId: order.roomId,
        buyerPaymentConfirmed: order.buyerPaymentConfirmed,
        sellerPaymentReceived: order.sellerPaymentReceived,
        sellerTransferInitiated: order.sellerTransferInitiated,
        buyerCryptoReceived: order.buyerCryptoReceived,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to create order: ${response.status} - ${errorData.error || "Unknown error"}`,
      );
    }

    const data = await response.json();
    return data.order as CreatedOrder;
  } catch (error) {
    console.error("Error creating order in API:", error);
    throw error;
  }
}

/**
 * Update order in server KV storage
 */
export async function updateOrderInAPI(
  orderId: string,
  updates: Partial<CreatedOrder>,
): Promise<CreatedOrder | null> {
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(orderId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error("Failed to update order:", response.status);
      return null;
    }

    const data = await response.json();
    return data.order as CreatedOrder;
  } catch (error) {
    console.error("Error updating order in API:", error);
    return null;
  }
}

/**
 * Delete order from server KV storage
 */
export async function deleteOrderFromAPI(orderId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(orderId)}`, {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 404) {
      console.error("Failed to delete order:", response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting order from API:", error);
    return false;
  }
}

/**
 * Sync order between localStorage and KV storage
 * First tries to get from KV, falls back to localStorage if not found
 */
export async function syncOrderFromStorage(
  orderId: string,
): Promise<CreatedOrder | null> {
  // Try KV first
  const kvOrder = await getOrderFromAPI(orderId);
  if (kvOrder) {
    return kvOrder;
  }

  // Fall back to localStorage
  try {
    const ordersJson = localStorage.getItem("p2p_orders") || "[]";
    const orders = JSON.parse(ordersJson);
    const order = orders.find((o: CreatedOrder) => o.id === orderId);
    if (order) {
      // Sync to KV for next time
      try {
        await createOrderInAPI(order);
      } catch (error) {
        console.warn("Failed to sync order to KV:", error);
      }
      return order;
    }
  } catch (error) {
    console.error("Error reading from localStorage:", error);
  }

  return null;
}

/**
 * Update order in both KV and localStorage (for compatibility)
 */
export async function updateOrderInBothStorages(
  orderId: string,
  updates: Partial<CreatedOrder>,
): Promise<CreatedOrder | null> {
  // Update in KV
  const kvOrder = await updateOrderInAPI(orderId, updates);

  // Also update in localStorage for offline support
  try {
    const ordersJson = localStorage.getItem("p2p_orders") || "[]";
    const orders = JSON.parse(ordersJson);
    const index = orders.findIndex((o: CreatedOrder) => o.id === orderId);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      localStorage.setItem("p2p_orders", JSON.stringify(orders));
    }
  } catch (error) {
    console.warn("Failed to update localStorage:", error);
  }

  return kvOrder;
}
