/**
 * useP2PMatching Hook
 * Handles smart order matching with real-time polling
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { getMatchesForOrder, MatchedOrder } from "@/lib/p2p-matching-api";
import { P2POrder } from "@/lib/p2p-orders";

export interface UseP2PMatchingOptions {
  orderId?: string;
  walletAddress?: string;
  pollInterval?: number;
  enabled?: boolean;
  onMatchesUpdate?: (matches: MatchedOrder[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for real-time P2P order matching
 * Polls for matches and notifies on updates
 */
export function useP2PMatching(options: UseP2PMatchingOptions = {}) {
  const {
    orderId,
    walletAddress,
    pollInterval = 5000, // 5 second poll interval
    enabled = true,
    onMatchesUpdate,
    onError,
  } = options;

  const [matches, setMatches] = useState<MatchedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const lastMatchCountRef = useRef(0);

  const fetchMatches = useCallback(async () => {
    if (!orderId || !enabled) {
      return;
    }

    try {
      setLoading(true);

      const result = await getMatchesForOrder(orderId);
      const newMatches = result.matches || [];

      if (isMountedRef.current) {
        setMatches(newMatches);
        setError(null);

        // Notify on new matches
        if (
          newMatches.length > lastMatchCountRef.current &&
          onMatchesUpdate
        ) {
          onMatchesUpdate(newMatches);
        }

        lastMatchCountRef.current = newMatches.length;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (isMountedRef.current) {
        setError(error);

        if (onError) {
          onError(error);
        }

        console.error("[P2P Matching Hook] Error fetching matches:", error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [orderId, enabled, onMatchesUpdate, onError]);

  // Set up polling
  useEffect(() => {
    if (!orderId || !enabled) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchMatches();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(fetchMatches, pollInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [orderId, enabled, pollInterval, fetchMatches]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!pollingIntervalRef.current && orderId && enabled) {
      fetchMatches();
      pollingIntervalRef.current = setInterval(fetchMatches, pollInterval);
    }
  }, [orderId, enabled, pollInterval, fetchMatches]);

  const refetchMatches = useCallback(async () => {
    await fetchMatches();
  }, [fetchMatches]);

  return {
    matches,
    loading,
    error,
    refetchMatches,
    stopPolling,
    startPolling,
  };
}

/**
 * Hook for watching all matched pairs for a wallet
 */
export function useWalletMatches(options: Omit<UseP2PMatchingOptions, "orderId"> = {}) {
  const [matches, setMatches] = useState<MatchedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { walletAddress, pollInterval = 5000, enabled = true, onMatchesUpdate, onError } = options;

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchMatches = useCallback(async () => {
    if (!walletAddress || !enabled) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // This would need an API endpoint to get all matches for a wallet
      // For now, this is a placeholder
      console.log("[P2P Matching] Fetching matches for wallet:", walletAddress);

      if (isMountedRef.current && onMatchesUpdate) {
        onMatchesUpdate(matches);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (isMountedRef.current) {
        setError(error);
        if (onError) {
          onError(error);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [walletAddress, enabled, matches, onMatchesUpdate, onError]);

  useEffect(() => {
    if (!walletAddress || !enabled) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    fetchMatches();
    pollingIntervalRef.current = setInterval(fetchMatches, pollInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [walletAddress, enabled, pollInterval, fetchMatches]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return {
    matches,
    loading,
    error,
  };
}
