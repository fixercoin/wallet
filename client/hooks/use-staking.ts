import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { resolveApiUrl, fetchWithFallback } from "@/lib/api-client";
import bs58 from "bs58";
import nacl from "tweetnacl";

export interface Stake {
  id: string;
  walletAddress: string;
  tokenMint: string;
  amount: number;
  stakePeriodDays: number;
  startTime: number;
  endTime: number;
  rewardAmount: number;
  status: "active" | "completed" | "withdrawn";
  withdrawnAt?: number;
  createdAt: number;
  timeRemainingMs?: number;
}

interface UseStakingReturn {
  stakes: Stake[];
  loading: boolean;
  error: string | null;
  createStake: (
    tokenMint: string,
    amount: number,
    periodDays: number,
  ) => Promise<Stake>;
  withdrawStake: (
    stakeId: string,
  ) => Promise<{ stake: Stake; totalAmount: number }>;
  refreshStakes: () => Promise<void>;
}

/**
 * Hook to manage staking operations
 */
export function useStaking(): UseStakingReturn {
  const { wallet } = useWallet();
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate auth signature
  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!wallet?.secretKey) throw new Error("No wallet");
      const bytes = new TextEncoder().encode(message);
      const sig = nacl.sign.detached(bytes, wallet.secretKey);
      return bs58.encode(sig);
    },
    [wallet?.secretKey],
  );

  // Fetch user's stakes
  const refreshStakes = useCallback(async () => {
    if (!wallet?.publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const message = `staking-auth:${wallet.publicKey}:${Date.now()}`;
      const signature = await signMessage(message);

      const res = await fetchWithFallback(
        `${resolveApiUrl("/api/staking")}?wallet=${encodeURIComponent(
          wallet.publicKey,
        )}&message=${encodeURIComponent(message)}&signature=${encodeURIComponent(signature)}`,
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Failed to fetch stakes (${res.status})`);
      }

      const data = await res.json();
      setStakes(data.stakes || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [wallet?.publicKey, signMessage]);

  // Create new stake
  const createStake = useCallback(
    async (
      tokenMint: string,
      amount: number,
      periodDays: number,
    ): Promise<Stake> => {
      if (!wallet?.publicKey) throw new Error("No wallet");

      const message = `staking-create:${wallet.publicKey}:${tokenMint}:${amount}:${periodDays}:${Date.now()}`;
      const signature = await signMessage(message);

      const res = await fetchWithFallback(resolveApiUrl("/api/staking"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          wallet: wallet.publicKey,
          tokenMint,
          amount,
          periodDays,
          message,
          signature,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Failed to create stake (${res.status})`);
      }

      const data = await res.json();
      if (!data.success)
        throw new Error(data.error || "Failed to create stake");

      const newStake = data.stake;
      setStakes((prev) => [...prev, newStake]);
      return newStake;
    },
    [wallet?.publicKey, signMessage],
  );

  // Withdraw from stake
  const withdrawStake = useCallback(
    async (stakeId: string) => {
      if (!wallet?.publicKey) throw new Error("No wallet");

      const message = `staking-withdraw:${wallet.publicKey}:${stakeId}:${Date.now()}`;
      const signature = await signMessage(message);

      const res = await fetchWithFallback(resolveApiUrl("/api/staking"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          wallet: wallet.publicKey,
          stakeId,
          message,
          signature,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Failed to withdraw (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to withdraw");

      // Update local state
      setStakes((prev) =>
        prev.map((s) =>
          s.id === stakeId ? { ...s, status: "withdrawn" as const } : s,
        ),
      );

      return {
        stake: data.stake,
        totalAmount: data.totalAmount,
      };
    },
    [wallet?.publicKey, signMessage],
  );

  // Load stakes on mount
  useEffect(() => {
    refreshStakes();
  }, [refreshStakes]);

  return {
    stakes,
    loading,
    error,
    createStake,
    withdrawStake,
    refreshStakes,
  };
}
