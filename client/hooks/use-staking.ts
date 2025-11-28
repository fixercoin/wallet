import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";

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

const STORAGE_KEY = "fixorium_stakes";

function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEY}_${walletAddress}`;
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
 * Hook to manage staking operations using localStorage
 * Stakes are persisted locally and survive page refreshes
 */
export function useStaking(): UseStakingReturn {
  const { wallet } = useWallet();
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load stakes from localStorage
  const refreshStakes = useCallback(async () => {
    if (!wallet?.publicKey) {
      setStakes([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const storageKey = getStorageKey(wallet.publicKey);
      const stored = localStorage.getItem(storageKey);
      const loadedStakes = stored ? JSON.parse(stored) : [];
      setStakes(loadedStakes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStakes([]);
    } finally {
      setLoading(false);
    }
  }, [wallet?.publicKey]);

  // Create new stake and save to localStorage
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

      const newStake: Stake = {
        id: generateStakeId(),
        walletAddress: wallet.publicKey,
        tokenMint,
        amount,
        stakePeriodDays: periodDays,
        startTime: now,
        endTime,
        rewardAmount,
        status: "active",
        createdAt: now,
        timeRemainingMs: periodDays * 24 * 60 * 60 * 1000,
      };

      // Add to state
      const updatedStakes = [...stakes, newStake];
      setStakes(updatedStakes);

      // Persist to localStorage
      const storageKey = getStorageKey(wallet.publicKey);
      localStorage.setItem(storageKey, JSON.stringify(updatedStakes));

      return newStake;
    },
    [wallet?.publicKey, stakes],
  );

  // Withdraw from stake and update localStorage
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

      // Update stake status
      const updatedStakes = stakes.map((s) =>
        s.id === stakeId
          ? { ...s, status: "withdrawn" as const, withdrawnAt: now }
          : s,
      );
      setStakes(updatedStakes);

      // Persist to localStorage
      const storageKey = getStorageKey(wallet.publicKey);
      localStorage.setItem(storageKey, JSON.stringify(updatedStakes));

      return {
        stake: updatedStakes.find((s) => s.id === stakeId) || stake,
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
