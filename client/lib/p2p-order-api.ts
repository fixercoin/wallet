/**
 * P2P Order API Management
 * Uses Cloudflare KV through Express API endpoints for persistent storage
 * Replaces localStorage with server-side KV storage
 */

import type { CreatedOrder } from "./p2p-order-creation";

const API_BASE = "/api/p2p/orders";

/**
 * Get order from server KV storage with localStorage fallback
 */
export async function getOrderFromAPI(
  orderId: string,
): Promise<CreatedOrder | null> {
  try {
    const url = `${API_BASE}/${encodeURIComponent(orderId)}`;
    console.log(`[P2P Order API] Fetching order from: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[P2P Order API] Order not found in KV: ${orderId}, checking localStorage...`);

        // Try to recover from localStorage and sync to KV
        try {
          const ordersJson = localStorage.getItem("p2p_orders") || "[]";
          const orders = JSON.parse(ordersJson);
          const order = orders.find((o: CreatedOrder) => o.id === orderId);

          if (order) {
            console.warn(`[P2P Order API] ✅ Found order in localStorage: ${orderId}, syncing to KV...`);
            // Attempt to sync to KV for future lookups
            try {
              await createOrderInAPI(order);
              console.log(`[P2P Order API] ✅ Successfully synced order to KV: ${orderId}`);
            } catch (syncError) {
              console.warn(`[P2P Order API] Failed to sync to KV (non-critical): ${syncError instanceof Error ? syncError.message : String(syncError)}`);
              // Still return the order even if sync fails
            }
            return order;
          }
        } catch (localError) {
          console.warn(`[P2P Order API] localStorage fallback error: ${localError instanceof Error ? localError.message : String(localError)}`);
        }

        console.error(`[P2P Order API] Order not found anywhere: ${orderId}`);
        return null;
      }
      const errorText = await response.text();
      console.error(
        `[P2P Order API] Failed to fetch order ${orderId}: ${response.status} - ${errorText}`,
      );
      return null;
    }

    const data = await response.json();
    const orders = data.orders || [];

    if (orders.length > 0) {
      console.log(`[P2P Order API] ✅ Found order: ${orderId}`);
      return orders[0] as CreatedOrder;
    }

    console.warn(`[P2P Order API] No orders returned for: ${orderId}`);
    return null;
  } catch (error) {
    console.error(
      `[P2P Order API] Error fetching order: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Final fallback: try localStorage
    try {
      const ordersJson = localStorage.getItem("p2p_orders") || "[]";
      const orders = JSON.parse(ordersJson);
      const order = orders.find((o: CreatedOrder) => o.id === orderId);
      if (order) {
        console.warn(`[P2P Order API] Retrieved from localStorage due to network error: ${orderId}`);
        return order;
      }
    } catch (e) {
      // Ignore localStorage errors
    }

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
 * Create order in server KV storage + backup to localStorage
 */
export async function createOrderInAPI(
  order: CreatedOrder,
): Promise<CreatedOrder> {
  try {
    // Always backup to localStorage first for redundancy
    try {
      const ordersJson = localStorage.getItem("p2p_orders") || "[]";
      const orders = JSON.parse(ordersJson);
      const existingIndex = orders.findIndex((o: CreatedOrder) => o.id === order.id);

      if (existingIndex >= 0) {
        orders[existingIndex] = order;
      } else {
        orders.push(order);
      }

      localStorage.setItem("p2p_orders", JSON.stringify(orders));
      console.log(`[P2P Order API] ✅ Backed up order to localStorage: ${order.id}`);
    } catch (localError) {
      console.warn(`[P2P Order API] Failed to backup to localStorage: ${localError instanceof Error ? localError.message : String(localError)}`);
      // Continue anyway - KV save is still attempted
    }

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
      console.error(
        `[P2P Order API] Failed to create order in KV: ${response.status} - ${errorData.error}`,
      );
      // Return the order anyway since it's backed up in localStorage
      return order;
    }

    const data = await response.json();
    console.log(`[P2P Order API] ✅ Order created in KV: ${order.id}`);
    return data.order as CreatedOrder;
  } catch (error) {
    console.error("Error creating order in API:", error);
    // Order is backed up in localStorage, so return it anyway
    return order;
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
