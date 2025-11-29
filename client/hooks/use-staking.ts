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

  // Load stakes from Supabase
  const refreshStakes = useCallback(async () => {
    if (!wallet?.publicKey) {
      setStakes([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("stakes")
        .select("*")
        .eq("wallet_address", wallet.publicKey);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const mappedStakes = (data || []).map(mapRowToStake);
      setStakes(mappedStakes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStakes([]);
    } finally {
      setLoading(false);
    }
  }, [wallet?.publicKey]);

  // Create new stake in Supabase
  const createStake = useCallback(
    async (
      tokenMint: string,
      amount: number,
      periodDays: number,
    ): Promise<Stake> => {
      if (!wallet?.publicKey) throw new Error("No wallet");

      if (![30, 60, 90].includes(periodDays)) {
        throw new Error("Invalid period. Must be 30, 60, or 90 days");
      }

      const now = Date.now();
      const endTime = now + periodDays * 24 * 60 * 60 * 1000;
      const rewardAmount = calculateReward(amount, periodDays);
      const stakeId = generateStakeId();

      const { data, error: insertError } = await supabase
        .from("stakes")
        .insert({
          id: stakeId,
          wallet_address: wallet.publicKey,
          token_mint: tokenMint,
          amount,
          stake_period_days: periodDays,
          start_time: now,
          end_time: endTime,
          reward_amount: rewardAmount,
          status: "active",
          created_at: now,
          updated_at: now,
        })
        .select();

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (!data || data.length === 0) {
        throw new Error("Failed to create stake");
      }

      const newStake = mapRowToStake(data[0]);
      setStakes((prev) => [...prev, newStake]);
      return newStake;
    },
    [wallet?.publicKey],
  );

  // Withdraw from stake in Supabase
  const withdrawStake = useCallback(
    async (stakeId: string) => {
      if (!wallet?.publicKey) throw new Error("No wallet");

      const stake = stakes.find((s) => s.id === stakeId);
      if (!stake) throw new Error("Stake not found");

      if (stake.walletAddress !== wallet.publicKey) {
        throw new Error("Unauthorized");
      }

      if (stake.status !== "active") {
        throw new Error("Stake is not active");
      }

      const now = Date.now();
      if (now < stake.endTime) {
        throw new Error("Staking period has not ended yet");
      }

      const { data, error: updateError } = await supabase
        .from("stakes")
        .update({
          status: "withdrawn",
          withdrawn_at: now,
          updated_at: now,
        })
        .eq("id", stakeId)
        .select();

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (!data || data.length === 0) {
        throw new Error("Failed to withdraw stake");
      }

      const updatedStake = mapRowToStake(data[0]);
      setStakes((prev) =>
        prev.map((s) => (s.id === stakeId ? updatedStake : s)),
      );

      return {
        stake: updatedStake,
        totalAmount: stake.amount + stake.rewardAmount,
      };
    },
    [wallet?.publicKey, stakes],
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
