import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { resolveApiUrl } from "@/lib/api-client";

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

export interface RewardDistribution {
  amount: number;
  tokenMint: string;
  payerWallet: string;
  recipientWallet: string;
  status: string;
}

interface UseStakingReturn {
  stakes: Stake[];
  loading: boolean;
  error: string | null;
  rewardPayerWallet: string;
  createStake: (
    tokenMint: string,
    amount: number,
    periodDays: number,
  ) => Promise<Stake>;
  withdrawStake: (
    stakeId: string,
  ) => Promise<{ stake: Stake; totalAmount: number; reward?: RewardDistribution }>;
  refreshStakes: () => Promise<void>;
  getRewardStatus: () => Promise<any>;
}

function calculateReward(amount: number, periodDays: number): number {
  // 10% APY
  const yearlyReward = amount * 0.1;
  const dailyRate = yearlyReward / 365;
  return dailyRate * periodDays;
}

function generateStakeId(): string {
  return `stake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook to manage staking operations using Supabase database
 * Stakes are persisted in Supabase and accessible from any device
 */
export function useStaking(): UseStakingReturn {
  const { wallet } = useWallet();
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map database row to Stake interface
  const mapRowToStake = (row: any): Stake => ({
    id: row.id,
    walletAddress: row.wallet_address,
    tokenMint: row.token_mint,
    amount: row.amount,
    stakePeriodDays: row.stake_period_days,
    startTime: row.start_time,
    endTime: row.end_time,
    rewardAmount: row.reward_amount,
    status: row.status,
    withdrawnAt: row.withdrawn_at,
    createdAt: row.created_at,
    timeRemainingMs:
      row.status === "active" ? Math.max(0, row.end_time - Date.now()) : 0,
  });

  // Load stakes from PHP API
  const refreshStakes = useCallback(async () => {
    if (!wallet?.publicKey) {
      setStakes([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        resolveApiUrl(`/backend/api/staking-list.php?wallet=${encodeURIComponent(wallet.publicKey)}`),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch stakes: ${response.status}`);
      }

      const result = await response.json();
      const mappedStakes = (result.data || []).map(mapRowToStake);
      setStakes(mappedStakes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStakes([]);
    } finally {
      setLoading(false);
    }
  }, [wallet?.publicKey]);

  // Create new stake via PHP API
  const createStake = useCallback(
    async (
      tokenMint: string,
      amount: number,
      periodDays: number,
    ): Promise<Stake> => {
      if (!wallet?.publicKey) throw new Error("No wallet");
      if (!wallet?.secretKey) throw new Error("Wallet secret key not available");

      if (![30, 60, 90].includes(periodDays)) {
        throw new Error("Invalid period. Must be 30, 60, or 90 days");
      }

      // For now, we'll use basic authentication with wallet address
      // In production, implement proper message signing
      const message = `Create stake:${wallet.publicKey}:${Date.now()}`;

      try {
        const response = await fetch(
          resolveApiUrl("/backend/api/staking-create.php"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              wallet: wallet.publicKey,
              tokenMint,
              amount,
              periodDays,
              message,
              signature: "verified", // Placeholder - would be actual signature
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to create stake: ${response.status}`);
        }

        const result = await response.json();
        const newStake = mapRowToStake(result.data);
        setStakes((prev) => [...prev, newStake]);
        return newStake;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
      }
    },
    [wallet?.publicKey, wallet?.secretKey],
  );

  // Withdraw from stake via PHP API
  const withdrawStake = useCallback(
    async (stakeId: string) => {
      if (!wallet?.publicKey) throw new Error("No wallet");
      if (!wallet?.secretKey) throw new Error("Wallet secret key not available");

      const stake = stakes.find((s) => s.id === stakeId);
      if (!stake) throw new Error("Stake not found");

      if (stake.walletAddress !== wallet.publicKey) {
        throw new Error("Unauthorized");
      }

      if (stake.status !== "active") {
        throw new Error("Stake is not active");
      }

      // For now, we'll use basic authentication with wallet address
      // In production, implement proper message signing
      const message = `Withdraw stake:${stakeId}:${wallet.publicKey}:${Date.now()}`;

      try {
        const response = await fetch(
          resolveApiUrl("/backend/api/staking-withdraw.php"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              wallet: wallet.publicKey,
              stakeId,
              message,
              signature: "verified", // Placeholder - would be actual signature
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to withdraw stake: ${response.status}`);
        }

        const result = await response.json();
        const updatedStake = mapRowToStake(result.data.stake);
        setStakes((prev) =>
          prev.map((s) => (s.id === stakeId ? updatedStake : s)),
        );

        return {
          stake: updatedStake,
          totalAmount: result.data.totalAmount,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
      }
    },
    [wallet?.publicKey, wallet?.secretKey, stakes],
  );

  // Load stakes on mount and when wallet changes
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
