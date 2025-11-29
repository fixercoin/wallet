import { useState, useEffect, useRef } from "react";

export interface NetworkSignalState {
  bars: number; // 0-4, 0 = offline, 4 = excellent
  latency: number | null; // milliseconds
  isOnline: boolean;
}

/**
 * Hook to monitor network signal strength based on ping latency
 * Returns 0-4 bars indicating connection quality
 * 4 bars: < 100ms (excellent)
 * 3 bars: 100-300ms (good)
 * 2 bars: 300-800ms (fair)
 * 1 bar: > 800ms (poor)
 * 0 bars: offline
 */
export const useNetworkSignal = (): NetworkSignalState => {
  const [signal, setSignal] = useState<NetworkSignalState>({
    bars: 4,
    latency: null,
    isOnline: true,
  });

  const latencyHistoryRef = useRef<number[]>([]);
  const MAX_HISTORY = 5; // Keep last 5 measurements for averaging

  const measureLatency = async (): Promise<number | null> => {
    try {
      const startTime = performance.now();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(
        new URL("/api/ping", window.location.origin).href,
        {
          method: "HEAD",
          signal: controller.signal,
          // Prevent caching so we always get fresh response
          headers: {
            "Cache-Control": "no-cache",
          },
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 204) {
        // Some endpoints return 204, some 200, both are fine for ping
        return null;
      }

      const latency = Math.round(performance.now() - startTime);
      return latency;
    } catch (error) {
      console.warn("[NetworkSignal] Ping failed:", error);
      return null;
    }
  };

  const calculateBars = (latency: number): number => {
    if (latency < 100) return 4;
    if (latency < 300) return 3;
    if (latency < 800) return 2;
    return 1;
  };

  const getAverageLatency = (): number => {
    if (latencyHistoryRef.current.length === 0) return 0;
    const sum = latencyHistoryRef.current.reduce((a, b) => a + b, 0);
    return Math.round(sum / latencyHistoryRef.current.length);
  };

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const checkSignal = async () => {
      try {
        const latency = await measureLatency();

        if (!isMounted) return;

        if (latency !== null) {
          // Add to history
          latencyHistoryRef.current.push(latency);
          if (latencyHistoryRef.current.length > MAX_HISTORY) {
            latencyHistoryRef.current.shift();
          }

          const avgLatency = getAverageLatency();
          const bars = calculateBars(avgLatency);

          setSignal({
            bars,
            latency: avgLatency,
            isOnline: true,
          });
        } else {
          // Network request failed
          setSignal((prev) => ({
            ...prev,
            bars: 0,
            latency: null,
            isOnline: false,
          }));
        }
      } catch (error) {
        console.error("[NetworkSignal] Error checking signal:", error);
        if (isMounted) {
          setSignal((prev) => ({
            ...prev,
            bars: 0,
            isOnline: false,
          }));
        }
      }
    };

    // Initial check
    checkSignal();

    // Check every 10 seconds
    intervalId = setInterval(checkSignal, 10000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return signal;
};
