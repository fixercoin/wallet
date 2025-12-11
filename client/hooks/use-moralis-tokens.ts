import { useState, useCallback } from "react";
import { resolveApiUrl } from "@/lib/api-client";

export interface MoralisTokenBalance {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  uiAmount: number;
  logoURI: string;
  isSpam: boolean;
}

interface UseMoralisTokensResult {
  tokens: MoralisTokenBalance[];
  loading: boolean;
  error: string | null;
  fetchTokens: (walletAddress: string) => Promise<void>;
}

/**
 * Hook for fetching SPL token balances using Moralis REST API
 * Much faster than RPC-based token fetching
 */
export function useMoralisTokens(): UseMoralisTokensResult {
  const [tokens, setTokens] = useState<MoralisTokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async (walletAddress: string) => {
    if (!walletAddress) {
      setError("Wallet address required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = resolveApiUrl();
      const response = await fetch(
        `${apiUrl}/api/wallet/moralis-tokens?address=${encodeURIComponent(walletAddress)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as any;
        throw new Error(
          errorData.error || `Failed to fetch tokens: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as {
        tokens?: MoralisTokenBalance[];
      };
      setTokens(data.tokens || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[useMoralisTokens] Error:", message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    tokens,
    loading,
    error,
    fetchTokens,
  };
}
