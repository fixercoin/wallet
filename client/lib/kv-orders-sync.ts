/**
 * Cloudflare KV Orders Sync Utility
 * Syncs order operations with both localStorage and Cloudflare KV
 */

const API_BASE =
  process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || "/api";

interface OrderSyncOperation {
  orderId: string;
  walletAddress: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
}

/**
 * Update order status in KV storage (API-based)
 */
export async function syncOrderStatusToKV(
  operation: OrderSyncOperation,
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE}/p2p/orders/${operation.orderId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: operation.status,
        }),
      },
    );

    if (!response.ok) {
      console.warn(
        `Failed to sync order ${operation.orderId} status to API:`,
        response.status,
      );
    }
  } catch (error) {
    console.warn("Error syncing order status to API:", error);
  }
}

/**
 * Delete order from KV storage (API-based)
 */
export async function syncOrderCancelToKV(
  orderId: string,
  walletAddress: string,
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE}/p2p/orders/${encodeURIComponent(orderId)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      console.warn(
        `Failed to delete order ${orderId} from API:`,
        response.status,
      );
    }
  } catch (error) {
    console.warn("Error deleting order from API:", error);
  }
}

/**
 * Get pending orders from localStorage
 */
export function getPendingOrdersFromLS(): any[] {
  try {
    const raw = localStorage.getItem("orders_pending") || "[]";
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Get completed orders from localStorage
 */
export function getCompletedOrdersFromLS(): any[] {
  try {
    const raw = localStorage.getItem("orders_completed") || "[]";
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Remove order from localStorage
 */
export function removeOrderFromLS(orderId: string): void {
  const pending = getPendingOrdersFromLS();
  const filtered = pending.filter((o: any) => o.id !== orderId);
  localStorage.setItem("orders_pending", JSON.stringify(filtered));
}

/**
 * Add order to completed in localStorage
 */
export function addCompletedOrderToLS(order: any): void {
  const completed = getCompletedOrdersFromLS();
  const orderWithStatus = {
    ...order,
    status: "completed",
    completedAt: Date.now(),
    buyerVerified: true,
    sellerVerified: true,
  };
  completed.unshift(orderWithStatus);
  localStorage.setItem("orders_completed", JSON.stringify(completed));
}

/**
 * Mark order as completed (localStorage + KV)
 */
export async function completeOrder(
  order: any,
  walletAddress: string,
): Promise<void> {
  addCompletedOrderToLS(order);
  removeOrderFromLS(order.id);
  await syncOrderStatusToKV({
    orderId: order.id,
    walletAddress,
    status: "COMPLETED",
  });
}

/**
 * Cancel order (localStorage + KV)
 */
export async function cancelOrder(
  orderId: string,
  walletAddress: string,
): Promise<void> {
  removeOrderFromLS(orderId);
  await syncOrderCancelToKV(orderId, walletAddress);
}

/**
 * Get filtered pending orders (excluding completed)
 */
export function getFilteredPendingOrders(type?: "BUY" | "SELL"): any[] {
  const pending = getPendingOrdersFromLS();
  const completed = getCompletedOrdersFromLS();
  const completedIds = new Set(completed.map((o: any) => o.id));

  const filtered = pending.filter((order: any) => !completedIds.has(order.id));

  if (type) {
    return filtered.filter((order: any) => {
      if (type === "BUY") {
        return order.type === "BUY";
      } else if (type === "SELL") {
        return (
          order.type === "SELL" || (order.amountTokens && !order.amountPKR)
        );
      }
      return true;
    });
  }

  return filtered;
}
