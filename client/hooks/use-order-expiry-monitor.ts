import { useEffect, useRef, useCallback } from "react";
import {
  notifyOrderExpiring,
  notifyOrderExpired,
  isOrderAboutToExpire,
  getMinutesRemaining,
} from "@/lib/p2p-notifications";

interface Order {
  id: string;
  status: string;
  expiresAt?: number;
  createdAt?: number;
}

/**
 * Hook to monitor orders for expiration
 * Shows notifications when orders are about to expire or have expired
 */
export function useOrderExpiryMonitor(orders: Order[]) {
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  const monitoringRef = useRef<boolean>(false);

  const checkOrderExpiry = useCallback(() => {
    if (!orders || orders.length === 0) {
      return;
    }

    orders.forEach((order) => {
      if (!order.expiresAt) {
        return;
      }

      const now = Date.now();
      const isExpired = now > order.expiresAt;
      const notified = notifiedOrdersRef.current.has(order.id);

      // Notify if order has expired
      if (
        isExpired &&
        order.status !== "EXPIRED" &&
        !notified &&
        (order.status === "PENDING" ||
          order.status === "active" ||
          order.status === "pending")
      ) {
        notifyOrderExpired(order.id);
        notifiedOrdersRef.current.add(order.id);
      }

      // Notify if order is about to expire (within 2 minutes)
      if (
        isOrderAboutToExpire(order.expiresAt) &&
        !notified &&
        (order.status === "PENDING" ||
          order.status === "active" ||
          order.status === "pending")
      ) {
        const minutesRemaining = getMinutesRemaining(order.expiresAt);
        notifyOrderExpiring(order.id, minutesRemaining);
        notifiedOrdersRef.current.add(order.id);
      }

      // Clear notification flag for expired orders from notification set
      if (order.status === "EXPIRED" && notified) {
        // Keep them marked so we don't re-notify
      }
    });
  }, [orders]);

  useEffect(() => {
    if (monitoringRef.current) {
      return;
    }

    monitoringRef.current = true;

    // Check immediately
    checkOrderExpiry();

    // Check every 30 seconds for expiring orders
    const interval = setInterval(checkOrderExpiry, 30000);

    return () => {
      clearInterval(interval);
      monitoringRef.current = false;
    };
  }, [checkOrderExpiry]);

  return {
    resetNotifications: () => notifiedOrdersRef.current.clear(),
  };
}
