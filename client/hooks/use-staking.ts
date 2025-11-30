import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { resolveApiUrl } from "@/lib/api-client";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import bs58 from "bs58";

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
  withdrawStake: (stakeId: string) => Promise<{
    stake: Stake;
    totalAmount: number;
    reward?: RewardDistribution;
  }>;
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
  const { wallet, tokens, updateTokenBalance, refreshTokens } = useWallet();
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardPayerWallet, setRewardPayerWallet] = useState<string>("");

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

  // Load stakes from Cloudflare API
  const refreshStakes = useCallback(async () => {
    if (!wallet?.publicKey) {
      setStakes([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        resolveApiUrl(
          `/api/staking/list?wallet=${encodeURIComponent(wallet.publicKey)}`,
        ),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to fetch stakes: ${response.status}`,
        );
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

  // Create new stake via Cloudflare API
  const createStake = useCallback(
    async (
      tokenMint: string,
      amount: number,
      periodDays: number,
    ): Promise<Stake> => {
      if (!wallet?.publicKey) throw new Error("No wallet");
      if (!wallet?.secretKey)
        throw new Error("Wallet secret key not available");

      if (![30, 60, 90].includes(periodDays)) {
        throw new Error("Invalid period. Must be 30, 60, or 90 days");
      }

      const message = `Create stake:${wallet.publicKey}:${Date.now()}`;

      try {
        // Sign the message using the Fixorium provider
        const provider = ensureFixoriumProvider();
        if (!provider) {
          throw new Error("Wallet provider not available");
        }

        // Ensure wallet is connected before signing
        await provider.connect();

        // Sign the message
        const signatureBytes = await provider.signMessage(message);

        // Encode signature as base58
        const signatureBase58 = bs58.encode(signatureBytes);

        const response = await fetch(resolveApiUrl("/api/staking/create"), {
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
            signature: signatureBase58,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to create stake: ${response.status}`,
          );
        }

        const result = await response.json();
        const newStake = mapRowToStake(result.data);
        setStakes((prev) => [...prev, newStake]);

        // Update token balance in wallet context
        const token = tokens.find((t) => t.mint === tokenMint);
        if (token) {
          const newBalance = Math.max(0, token.balance - amount);
          updateTokenBalance(tokenMint, newBalance);
        }

        return newStake;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
      }
    },
    [wallet?.publicKey, wallet?.secretKey, tokens, updateTokenBalance],
  );

  // Withdraw from stake via Cloudflare API
  const withdrawStake = useCallback(
    async (stakeId: string) => {
      if (!wallet?.publicKey) throw new Error("No wallet");
      if (!wallet?.secretKey)
        throw new Error("Wallet secret key not available");

      const stake = stakes.find((s) => s.id === stakeId);
      if (!stake) throw new Error("Stake not found");

      if (stake.walletAddress !== wallet.publicKey) {
        throw new Error("Unauthorized");
      }

      if (stake.status !== "active") {
        throw new Error("Stake is not active");
      }

      const message = `Withdraw stake:${stakeId}:${wallet.publicKey}:${Date.now()}`;

      try {
        // Sign the message using the Fixorium provider
        const provider = ensureFixoriumProvider();
        if (!provider) {
          throw new Error("Wallet provider not available");
        }

        // Ensure wallet is connected before signing
        await provider.connect();

        // Sign the message
        const signatureBytes = await provider.signMessage(message);

        // Encode signature as base58
        const signatureBase58 = bs58.encode(signatureBytes);

        const response = await fetch(resolveApiUrl("/api/staking/withdraw"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wallet: wallet.publicKey,
            stakeId,
            message,
            signature: signatureBase58,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to withdraw stake: ${response.status}`,
          );
        }

        const result = await response.json();
        const updatedStake = mapRowToStake(result.data.stake);
        setStakes((prev) =>
          prev.map((s) => (s.id === stakeId ? updatedStake : s)),
        );

        // Update token balance in wallet context - add back staked amount + reward
        const token = tokens.find((t) => t.mint === stake.tokenMint);
        if (token) {
          const totalAmount = result.data.totalAmount || stake.amount + stake.rewardAmount;
          const newBalance = token.balance + totalAmount;
          updateTokenBalance(stake.tokenMint, newBalance);
        }

        return {
          stake: updatedStake,
          totalAmount: result.data.totalAmount,
          reward: result.data.reward,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
      }
    },
    [wallet?.publicKey, wallet?.secretKey, stakes, tokens, updateTokenBalance],
  );

  // Get reward status for wallet
  const getRewardStatus = useCallback(async () => {
    if (!wallet?.publicKey) {
      return null;
    }

    try {
      const response = await fetch(
        resolveApiUrl(
          `/api/staking/rewards-status?wallet=${encodeURIComponent(wallet.publicKey)}`,
        ),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch reward status");
      }

      const result = await response.json();
      if (result.data?.rewardPayerWallet) {
        setRewardPayerWallet(result.data.rewardPayerWallet);
      }
      return result.data;
    } catch (err) {
      console.error("Error fetching reward status:", err);
      return null;
    }
  }, [wallet?.publicKey]);

  // Load stakes on mount and when wallet changes
  useEffect(() => {
    refreshStakes();
    getRewardStatus();
  }, [refreshStakes, getRewardStatus]);

  return {
    stakes,
    loading,
    error,
    rewardPayerWallet,
    createStake,
    withdrawStake,
    refreshStakes,
    getRewardStatus,
  };
}
