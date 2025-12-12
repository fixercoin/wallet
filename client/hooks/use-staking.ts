import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@/contexts/WalletContext";
import { resolveApiUrl } from "@/lib/api-client";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import {
  buildTokenTransferTransaction,
  sendTokenTransferTransaction,
  confirmTokenTransfer,
  getTokenDecimals,
} from "@/lib/spl-token-transfer";
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
  vaultWallet: string;
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
  getAvailableBalance: (tokenMint: string) => number;
  getTotalStaked: (tokenMint: string) => number;
}

function calculateReward(amount: number, periodDays: number): number {
  // 10% APY
  const yearlyReward = amount * 0.1;
  const dailyRate = yearlyReward / 365;
  return dailyRate * periodDays;
}

/**
 * Hook to manage staking operations with real SPL token transfers
 * Tokens are actually transferred to/from the vault wallet
 */
export function useStaking(): UseStakingReturn {
  const { wallet, tokens, updateTokenBalance, refreshTokens } = useWallet();
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rewardPayerWallet, setRewardPayerWallet] = useState<string>("");
  const [vaultWallet, setVaultWallet] = useState<string>("");

  // Map API response to Stake interface
  const mapRowToStake = (row: any): Stake => ({
    id: row.id,
    walletAddress: row.walletAddress,
    tokenMint: row.tokenMint,
    amount: row.amount,
    stakePeriodDays: row.stakePeriodDays,
    startTime: row.startTime,
    endTime: row.endTime,
    rewardAmount: row.rewardAmount,
    status: row.status,
    withdrawnAt: row.withdrawnAt,
    createdAt: row.createdAt,
    timeRemainingMs:
      row.status === "active" ? Math.max(0, row.endTime - Date.now()) : 0,
  });

  // Load stakes from API
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

  // Create new stake with real token transfer
  const createStake = useCallback(
    async (
      tokenMint: string,
      amount: number,
      periodDays: number,
    ): Promise<Stake> => {
      if (!wallet?.publicKey) throw new Error("No wallet connected");

      const validPeriods = [
        10 / (24 * 60), // 10 minutes
        10, // 10 days
        30, // 30 days
        60, // 60 days
        90, // 90 days
      ];
      if (!validPeriods.some((p) => Math.abs(p - periodDays) < 0.0001)) {
        throw new Error(
          "Invalid period. Must be 10 minutes, 10 days, 30 days, 60 days, or 90 days",
        );
      }

      try {
        const provider = ensureFixoriumProvider();
        if (!provider) {
          throw new Error("Wallet provider not available");
        }

        // Ensure wallet is connected
        await provider.connect();

        // Get vault wallet address from reward config
        const configResponse = await fetch(
          resolveApiUrl("/api/staking/config"),
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          },
        );

        let vaultAddress = vaultWallet;
        if (configResponse.ok) {
          const config = await configResponse.json();
          vaultAddress = config.data?.vaultWallet || config.vaultWallet;
          if (vaultAddress) {
            setVaultWallet(vaultAddress);
          }
        }

        if (!vaultAddress) {
          console.warn(
            "Vault wallet not found in config response, using fallback",
          );
          vaultAddress = "5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU";
        }

        // Get token decimals
        const decimals = await getTokenDecimals(new PublicKey(tokenMint));

        // Build transfer transaction (user → vault)
        const transferTx = await buildTokenTransferTransaction({
          fromWallet: new PublicKey(wallet.publicKey),
          toWallet: new PublicKey(vaultAddress),
          mint: new PublicKey(tokenMint),
          amount,
          decimals,
        });

        // Send and sign the transfer transaction
        const transferSignature = await sendTokenTransferTransaction(
          transferTx,
          provider,
        );

        // Confirm the transfer on-chain
        const isConfirmed = await confirmTokenTransfer(transferSignature, 30);

        if (!isConfirmed) {
          throw new Error(
            "Token transfer failed to confirm on blockchain. Please try again.",
          );
        }

        // Create message for signing
        const message = `Create stake:${wallet.publicKey}:${Date.now()}`;

        // Sign the message
        const signatureBytes = await provider.signMessage(message);
        const messageSignature = bs58.encode(signatureBytes);

        // Call staking create endpoint with transfer signature
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
            transferTxSignature: transferSignature,
            message,
            messageSignature,
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

        // Update token balance in wallet context (tokens are now in vault)
        const token = tokens.find((t) => t.mint === tokenMint);
        if (token) {
          const newBalance = Math.max(0, token.balance - amount);
          updateTokenBalance(tokenMint, newBalance);
        }

        // Refresh tokens from blockchain
        setTimeout(() => {
          refreshTokens().catch((err) => {
            console.error("Error refreshing tokens after staking:", err);
          });
        }, 2000);

        return newStake;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
      }
    },
    [wallet?.publicKey, tokens, updateTokenBalance, refreshTokens, vaultWallet],
  );

  // Withdraw from stake
  const withdrawStake = useCallback(
    async (stakeId: string) => {
      if (!wallet?.publicKey) throw new Error("No wallet connected");

      const stake = stakes.find((s) => s.id === stakeId);
      if (!stake) throw new Error("Stake not found");

      if (stake.walletAddress !== wallet.publicKey) {
        throw new Error("Unauthorized - you do not own this stake");
      }

      if (stake.status !== "active") {
        throw new Error("Stake is not active");
      }

      const now = Date.now();
      if (now < stake.endTime) {
        const timeRemaining = (stake.endTime - now) / 1000 / 60;
        throw new Error(
          `Staking period has not ended. ${timeRemaining.toFixed(0)} minutes remaining.`,
        );
      }

      try {
        const provider = ensureFixoriumProvider();
        if (!provider) {
          throw new Error("Wallet provider not available");
        }

        await provider.connect();

        // Create message for signing
        const message = `Withdraw stake:${stakeId}:${wallet.publicKey}:${Date.now()}`;

        // Sign the message to prove ownership
        const signatureBytes = await provider.signMessage(message);
        const messageSignature = bs58.encode(signatureBytes);

        // Call withdraw endpoint
        // The backend will:
        // 1. Verify the signature proves wallet ownership
        // 2. Build the return transaction (vault → user with tokens + rewards)
        // 3. Sign the transaction with the vault private key
        // 4. Submit the signed transaction to the blockchain
        const response = await fetch(resolveApiUrl("/api/staking/withdraw"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wallet: wallet.publicKey,
            stakeId,
            message,
            signature: messageSignature,
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
        const totalAmount = stake.amount + stake.rewardAmount;

        setStakes((prev) =>
          prev.map((s) => (s.id === stakeId ? updatedStake : s)),
        );

        // Update token balance
        const token = tokens.find((t) => t.mint === stake.tokenMint);
        if (token) {
          const newBalance = token.balance + totalAmount;
          updateTokenBalance(stake.tokenMint, newBalance);
        }

        return {
          stake: updatedStake,
          totalAmount,
          reward: result.data.reward,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(msg);
      }
    },
    [wallet?.publicKey, stakes, tokens, updateTokenBalance],
  );

  // Get reward status
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

  // Calculate total staked for a token
  const getTotalStaked = useCallback(
    (tokenMint: string) => {
      return stakes
        .filter(
          (stake) => stake.tokenMint === tokenMint && stake.status === "active",
        )
        .reduce((sum, stake) => sum + stake.amount, 0);
    },
    [stakes],
  );

  // Calculate available balance (balance - staked)
  const getAvailableBalance = useCallback(
    (tokenMint: string) => {
      const token = tokens.find((t) => t.mint === tokenMint);
      const totalStaked = getTotalStaked(tokenMint);
      return Math.max(0, (token?.balance || 0) - totalStaked);
    },
    [tokens, getTotalStaked],
  );

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
    vaultWallet,
    createStake,
    withdrawStake,
    refreshStakes,
    getRewardStatus,
    getTotalStaked,
    getAvailableBalance,
  };
}
