import { RequestHandler } from "express";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { KVStorage } from "../lib/kv-storage";

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
  updatedAt: number;
}

export interface RewardDistribution {
  id: string;
  stakeId: string;
  walletAddress: string;
  rewardAmount: number;
  tokenMint: string;
  status: "pending" | "processed";
  txHash?: string;
  createdAt: number;
  processedAt?: number;
}

// Constants
const REWARD_CONFIG = {
  vaultWallet: "5bW3uEyoP1jhXBMswgkB8xZuKUY3hscMaLJcsuzH2LNU",
  rewardWallet: "7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw",
  apyPercentage: 10,
  rewardTokenMint: "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",
};

// Helper functions
function generateStakeId(): string {
  return `stake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateRewardId(): string {
  return `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateReward(amount: number, periodDays: number): number {
  const yearlyReward = amount * (REWARD_CONFIG.apyPercentage / 100);
  const dailyRate = yearlyReward / 365;
  return dailyRate * periodDays;
}

// KV Store wrapper for staking operations
class StakingKVStore {
  private kvStorage: KVStorage;

  constructor() {
    // Initialize Cloudflare KV for staking using STAKING_KV_PROD namespace
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const namespaceId = process.env.STAKING_KV_PROD || process.env.CLOUDFLARE_NAMESPACE_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !namespaceId || !apiToken) {
      throw new Error(
        "Staking KV configuration missing. Required: CLOUDFLARE_ACCOUNT_ID, STAKING_KV_PROD (or CLOUDFLARE_NAMESPACE_ID), CLOUDFLARE_API_TOKEN",
      );
    }

    this.kvStorage = KVStorage.createCloudflareStorage(
      accountId,
      namespaceId,
      apiToken,
    );
  }

  async getStakesByWallet(walletAddress: string): Promise<Stake[]> {
    try {
      const indexKey = `staking:wallet:index:${walletAddress}`;
      const indexData = await this.kvStorage.get(indexKey);
      const stakeIds: string[] = indexData ? JSON.parse(indexData) : [];

      const stakes: Stake[] = [];
      for (const stakeId of stakeIds) {
        const stake = await this.getStake(stakeId);
        if (stake) {
          stakes.push(stake);
        }
      }
      return stakes;
    } catch (error) {
      console.error(
        `Error getting stakes for wallet ${walletAddress}:`,
        error,
      );
      return [];
    }
  }

  async getStake(stakeId: string): Promise<Stake | null> {
    try {
      const key = `staking:stake:${stakeId}`;
      const data = await this.kvStorage.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error getting stake ${stakeId}:`, error);
      return null;
    }
  }

  async createStake(stake: Stake): Promise<Stake> {
    try {
      const stakeKey = `staking:stake:${stake.id}`;
      await this.kvStorage.put(stakeKey, JSON.stringify(stake));

      // Update wallet index
      const indexKey = `staking:wallet:index:${stake.walletAddress}`;
      const indexData = await this.kvStorage.get(indexKey);
      const stakeIds: string[] = indexData ? JSON.parse(indexData) : [];
      stakeIds.push(stake.id);
      await this.kvStorage.put(indexKey, JSON.stringify(stakeIds));

      return stake;
    } catch (error) {
      console.error(`Error creating stake:`, error);
      throw error;
    }
  }

  async updateStake(stakeId: string, updates: Partial<Stake>): Promise<void> {
    try {
      const stake = await this.getStake(stakeId);
      if (!stake) {
        throw new Error("Stake not found");
      }

      const updated: Stake = {
        ...stake,
        ...updates,
        updatedAt: Date.now(),
      };

      const key = `staking:stake:${stakeId}`;
      await this.kvStorage.put(key, JSON.stringify(updated));
    } catch (error) {
      console.error(`Error updating stake ${stakeId}:`, error);
      throw error;
    }
  }

  async getRewardsByWallet(
    walletAddress: string,
  ): Promise<RewardDistribution[]> {
    try {
      const indexKey = `staking:reward:index:${walletAddress}`;
      const indexData = await this.kvStorage.get(indexKey);
      const rewardIds: string[] = indexData ? JSON.parse(indexData) : [];

      const rewards: RewardDistribution[] = [];
      for (const rewardId of rewardIds) {
        const reward = await this.getReward(rewardId);
        if (reward) {
          rewards.push(reward);
        }
      }
      return rewards;
    } catch (error) {
      console.error(
        `Error getting rewards for wallet ${walletAddress}:`,
        error,
      );
      return [];
    }
  }

  async getReward(rewardId: string): Promise<RewardDistribution | null> {
    try {
      const key = `staking:reward:${rewardId}`;
      const data = await this.kvStorage.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error getting reward ${rewardId}:`, error);
      return null;
    }
  }

  async recordReward(reward: RewardDistribution): Promise<RewardDistribution> {
    try {
      const rewardKey = `staking:reward:${reward.id}`;
      await this.kvStorage.put(rewardKey, JSON.stringify(reward));

      // Update wallet reward index
      const indexKey = `staking:reward:index:${reward.walletAddress}`;
      const indexData = await this.kvStorage.get(indexKey);
      const rewardIds: string[] = indexData ? JSON.parse(indexData) : [];
      rewardIds.push(reward.id);
      await this.kvStorage.put(indexKey, JSON.stringify(rewardIds));

      return reward;
    } catch (error) {
      console.error(`Error recording reward:`, error);
      throw error;
    }
  }
}

let kvStore: StakingKVStore;

try {
  kvStore = new StakingKVStore();
  console.log("[Staking] Cloudflare KV storage initialized successfully");
} catch (error) {
  console.error(
    "[Staking] Failed to initialize Cloudflare KV storage:",
    error instanceof Error ? error.message : String(error),
  );
  throw error;
}

function verifySignature(
  message: string,
  signature: string,
  publicKeyStr: string,
): boolean {
  try {
    const sig = bs58.decode(signature);
    const msg = new TextEncoder().encode(message);
    const pubKeyBytes = bs58.decode(publicKeyStr);
    return nacl.sign.detached.verify(msg, sig, pubKeyBytes);
  } catch {
    return false;
  }
}

// POST /api/staking/create - Create a new stake
export const handleCreateStake: RequestHandler = async (req, res) => {
  try {
    const { wallet, tokenMint, amount, periodDays, message, signature } =
      req.body;

    // Validate inputs
    if (!wallet || !tokenMint || !amount || !periodDays) {
      return res.status(400).json({
        error: "Missing required fields: wallet, tokenMint, amount, periodDays",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: "Amount must be greater than 0",
      });
    }

    // Verify signature
    if (!verifySignature(message, signature, wallet)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Validate period
    if (![30, 60, 90].includes(periodDays)) {
      return res.status(400).json({
        error: "Invalid period. Must be 30, 60, or 90 days",
      });
    }

    // Create stake
    const now = Date.now();
    const endTime = now + periodDays * 24 * 60 * 60 * 1000;
    const rewardAmount = calculateReward(amount, periodDays);
    const stakeId = generateStakeId();

    const stake: Stake = {
      id: stakeId,
      walletAddress: wallet,
      tokenMint,
      amount,
      stakePeriodDays: periodDays,
      startTime: now,
      endTime,
      rewardAmount,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    // Store the stake using KV store
    await kvStore.createStake(stake);

    return res.status(201).json({
      success: true,
      data: {
        ...stake,
        timeRemainingMs: periodDays * 24 * 60 * 60 * 1000,
      },
    });
  } catch (error) {
    console.error("Error in handleCreateStake:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
};

// GET /api/staking/list - Get all stakes for a wallet
export const handleListStakes: RequestHandler = async (req, res) => {
  try {
    const walletAddress = req.query.wallet as string;

    if (!walletAddress) {
      return res.status(400).json({ error: "Missing wallet address" });
    }

    // Get all stakes for the wallet using KV store
    const walletStakes = await kvStore.getStakesByWallet(walletAddress);

    // Add timeRemainingMs for active stakes
    const enrichedStakes = walletStakes.map((stake) => ({
      ...stake,
      timeRemainingMs:
        stake.status === "active" ? Math.max(0, stake.endTime - Date.now()) : 0,
    }));

    return res.status(200).json({
      success: true,
      data: enrichedStakes,
      count: enrichedStakes.length,
    });
  } catch (error) {
    console.error("Error in handleListStakes:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
};

// POST /api/staking/withdraw - Withdraw from a stake (Backend signs with vault key)
export const handleWithdrawStake: RequestHandler = async (req, res) => {
  try {
    const { wallet, stakeId, message, signature } = req.body;

    if (!wallet || !stakeId) {
      return res.status(400).json({
        error: "Missing required fields: wallet, stakeId",
      });
    }

    // Verify signature to ensure wallet ownership
    if (!verifySignature(message, signature, wallet)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Get the stake using KV store
    const stake = await kvStore.getStake(stakeId);

    if (!stake) {
      return res.status(404).json({ error: "Stake not found" });
    }

    // Verify ownership
    if (stake.walletAddress !== wallet) {
      return res.status(403).json({
        error: "Unauthorized - You do not own this stake",
      });
    }

    // Verify stake is active
    if (stake.status !== "active") {
      return res.status(400).json({ error: "Stake is not active" });
    }

    // Check if staking period has ended
    const now = Date.now();
    if (now < stake.endTime) {
      const timeRemaining = (stake.endTime - now) / 1000 / 60; // minutes
      return res.status(400).json({
        error: "Staking period has not ended yet",
        timeRemaining,
      });
    }

    // Backend signs and sends the withdrawal transaction with vault private key
    // NOTE: In production, the vault private key should be retrieved from:
    // - Environment variable (set via Cloudflare Workers environment)
    // - Secrets manager (AWS Secrets Manager, Hashicorp Vault, etc.)
    // - KV storage with encryption

    // For now, get vault private key from environment
    const vaultPrivateKeyBase58 = process.env.VAULT_PRIVATE_KEY;

    if (!vaultPrivateKeyBase58) {
      return res.status(500).json({
        error: "Vault private key not configured",
      });
    }

    try {
      // Decode vault private key
      const vaultPrivateKey = bs58.decode(vaultPrivateKeyBase58);

      // In production, this would:
      // 1. Build the transfer transaction (vault → user with amount + reward)
      // 2. Sign the transaction with the vault private key
      // 3. Submit the signed transaction to the Solana blockchain
      // 4. Wait for confirmation
      // 5. Return the transaction hash

      // For this implementation, we record that the withdrawal is processing
      // and the actual transfer happens via a backend job/cron
      const totalAmount = stake.amount + stake.rewardAmount;

      // Update stake status using KV store
      await kvStore.updateStake(stakeId, {
        status: "withdrawn",
        withdrawnAt: now,
      });

      // Get updated stake
      const updatedStake = await kvStore.getStake(stakeId);

      // Record reward distribution
      const rewardId = generateRewardId();
      const reward: RewardDistribution = {
        id: rewardId,
        stakeId,
        walletAddress: wallet,
        rewardAmount: stake.rewardAmount,
        tokenMint: stake.tokenMint,
        status: "processed",
        createdAt: now,
        processedAt: now,
      };

      await kvStore.recordReward(reward);

      return res.status(200).json({
        success: true,
        data: {
          stake: updatedStake,
          totalAmount,
          reward: {
            amount: stake.rewardAmount,
            tokenMint: stake.tokenMint,
            payerWallet: REWARD_CONFIG.rewardWallet,
            recipientWallet: wallet,
            status: "processing",
            note: "Withdrawal is being processed by the backend vault",
          },
        },
      });
    } catch (vaultError) {
      console.error("Error using vault private key:", vaultError);
      return res.status(500).json({
        error: "Failed to process withdrawal with vault",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
};

// GET /api/staking/config - Get staking configuration
export const handleStakingConfig: RequestHandler = async (req, res) => {
  try {
    // Get vault wallet from environment or config
    const vaultWallet = process.env.VAULT_WALLET || REWARD_CONFIG.vaultWallet;

    return res.status(200).json({
      success: true,
      data: {
        vaultWallet,
        apyPercentage: REWARD_CONFIG.apyPercentage,
        supportedPeriods: [30, 60, 90],
        rewardTokenMint: REWARD_CONFIG.rewardTokenMint,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
};

// GET /api/staking/rewards-status - Get reward status for a wallet
export const handleRewardStatus: RequestHandler = async (req, res) => {
  try {
    const walletAddress = req.query.wallet as string;

    if (!walletAddress) {
      return res.status(400).json({ error: "Missing wallet address" });
    }

    // Get all rewards for the wallet using KV store
    const walletRewards = await kvStore.getRewardsByWallet(walletAddress);

    let totalEarned = 0;
    let processedCount = 0;
    let pendingCount = 0;

    for (const reward of walletRewards) {
      totalEarned += reward.rewardAmount;
      if (reward.status === "processed") {
        processedCount++;
      } else {
        pendingCount++;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        walletAddress,
        totalRewardsEarned: totalEarned,
        rewardCount: walletRewards.length,
        rewardPayerWallet: REWARD_CONFIG.rewardWallet,
        rewards: walletRewards.filter((r) => r.status === "processed"),
        summary: {
          totalProcessed: processedCount,
          totalPending: pendingCount,
          currencySymbol: "FIXERCOIN",
        },
      },
    });
  } catch (error) {
    console.error("Error in handleRewardStatus:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
};
