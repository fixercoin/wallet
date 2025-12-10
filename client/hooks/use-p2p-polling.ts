import { useEffect, useRef, useCallback } from "react";
import { P2POrder } from "@/lib/p2p-orders";
import { getOrdersByWallet } from "@/lib/p2p-orders";

export interface UseP2PPollingOptions {
  walletAddress?: string;
  status?: string;
  pollInterval?: number;
  enabled?: boolean;
}

/**
 * Hook for polling P2P orders in real-time
 * Uses 3-5 second polling intervals to check for order updates
 */
export function useP2PPolling(
  onOrdersUpdate: (orders: P2POrder[]) => void,
  options: UseP2PPollingOptions = {},
) {
  const {
    walletAddress,
    status,
    pollInterval = 3000,
    enabled = true,
  } = options;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const pollOrders = useCallback(async () => {
    if (!walletAddress || !enabled) {
      return;
    }

    try {
      const orders = await getOrdersByWallet(walletAddress, status);

      if (isMountedRef.current) {
        onOrdersUpdate(orders);
      }
    } catch (error) {
      console.error("[P2P Polling] Error polling orders:", error);
    }
  }, [walletAddress, status, enabled, onOrdersUpdate]);

  useEffect(() => {
    if (!walletAddress || !enabled) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Initial poll
    pollOrders();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(pollOrders, pollInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [walletAddress, pollInterval, enabled, pollOrders]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!pollingIntervalRef.current && walletAddress && enabled) {
      pollOrders();
      pollingIntervalRef.current = setInterval(pollOrders, pollInterval);
    }
  }, [walletAddress, enabled, pollInterval, pollOrders]);

  return {
    stopPolling,
    startPolling,
  };
}
