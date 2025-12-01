import { RequestHandler } from "express";
import nacl from "tweetnacl";
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

// In-memory store for development (fallback, primary uses KV)
const stakes: Map<string, Stake> = new Map();
const stakesByWallet: Map<string, string[]> = new Map();
const rewards: Map<string, RewardDistribution> = new Map();
const rewardsByWallet: Map<string, string[]> = new Map();

// Constants
const REWARD_CONFIG = {
  rewardWallet: "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM",
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

// KV Storage wrapper class for server-side use
class KVStoreServer {
  private stakes: Map<string, Stake> = new Map();
  private stakesByWallet: Map<string, string[]> = new Map();
  private rewards: Map<string, RewardDistribution> = new Map();
  private rewardsByWallet: Map<string, string[]> = new Map();

  async getStakesByWallet(walletAddress: string): Promise<Stake[]> {
    const stakeIds = this.stakesByWallet.get(walletAddress) || [];
    const stakes: Stake[] = [];

    for (const stakeId of stakeIds) {
      const stake = this.stakes.get(stakeId);
      if (stake) {
        stakes.push(stake);
      }
    }

    return stakes;
  }

  async getStake(stakeId: string): Promise<Stake | null> {
    return this.stakes.get(stakeId) || null;
  }

  async createStake(stake: Stake): Promise<Stake> {
    this.stakes.set(stake.id, stake);

    const stakeIds = this.stakesByWallet.get(stake.walletAddress) || [];
    stakeIds.push(stake.id);
    this.stakesByWallet.set(stake.walletAddress, stakeIds);

    return stake;
  }

  async updateStake(stakeId: string, updates: Partial<Stake>): Promise<void> {
    const stake = this.stakes.get(stakeId);
    if (!stake) {
      throw new Error("Stake not found");
    }

    const updated: Stake = {
      ...stake,
      ...updates,
      updatedAt: Date.now(),
    };

    this.stakes.set(stakeId, updated);
  }

  async getRewardsByWallet(walletAddress: string): Promise<RewardDistribution[]> {
    const rewardIds = this.rewardsByWallet.get(walletAddress) || [];
    const rewards: RewardDistribution[] = [];

    for (const rewardId of rewardIds) {
      const reward = this.rewards.get(rewardId);
      if (reward) {
        rewards.push(reward);
      }
    }

    return rewards;
  }

  async getReward(rewardId: string): Promise<RewardDistribution | null> {
    return this.rewards.get(rewardId) || null;
  }

  async recordReward(reward: RewardDistribution): Promise<RewardDistribution> {
    this.rewards.set(reward.id, reward);

    const rewardIds = this.rewardsByWallet.get(reward.walletAddress) || [];
    rewardIds.push(reward.id);
    this.rewardsByWallet.set(reward.walletAddress, rewardIds);

    return reward;
  }
}

const kvStore = new KVStoreServer()

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

    // Get all stakes for the wallet
    const stakeIds = stakesByWallet.get(walletAddress) || [];
    const walletStakes: Stake[] = [];

    for (const stakeId of stakeIds) {
      const stake = stakes.get(stakeId);
      if (stake) {
        walletStakes.push(stake);
      }
    }

    return res.status(200).json({
      success: true,
      data: walletStakes,
      count: walletStakes.length,
    });
  } catch (error) {
    console.error("Error in handleListStakes:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
};

// POST /api/staking/withdraw - Withdraw from a stake
export const handleWithdrawStake: RequestHandler = async (req, res) => {
  try {
    const { wallet, stakeId, message, signature } = req.body;

    if (!wallet || !stakeId) {
      return res.status(400).json({
        error: "Missing required fields: wallet, stakeId",
      });
    }

    // Verify signature
    if (!verifySignature(message, signature, wallet)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Get the stake
    const stake = stakes.get(stakeId);

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

    // Update stake status
    const updatedStake: Stake = {
      ...stake,
      status: "withdrawn",
      withdrawnAt: now,
      updatedAt: now,
    };
    stakes.set(stakeId, updatedStake);

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

    rewards.set(rewardId, reward);

    // Add to wallet's reward list
    const walletRewards = rewardsByWallet.get(wallet) || [];
    walletRewards.push(rewardId);
    rewardsByWallet.set(wallet, walletRewards);

    return res.status(200).json({
      success: true,
      data: {
        stake: updatedStake,
        totalAmount: stake.amount + stake.rewardAmount,
        reward: {
          amount: stake.rewardAmount,
          tokenMint: stake.tokenMint,
          payerWallet: REWARD_CONFIG.rewardWallet,
          recipientWallet: wallet,
          status: "ready_for_distribution",
        },
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

    // Get all rewards for the wallet
    const rewardIds = rewardsByWallet.get(walletAddress) || [];
    const walletRewards: RewardDistribution[] = [];

    let totalEarned = 0;
    let processedCount = 0;
    let pendingCount = 0;

    for (const rewardId of rewardIds) {
      const reward = rewards.get(rewardId);
      if (reward) {
        walletRewards.push(reward);
        totalEarned += reward.rewardAmount;
        if (reward.status === "processed") {
          processedCount++;
        } else {
          pendingCount++;
        }
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
