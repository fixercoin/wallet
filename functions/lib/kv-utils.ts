/**
 * Cloudflare KV Storage Utilities
 * Handles all KV operations for staking and rewards
 */

import { Stake, RewardDistribution } from "./reward-config";

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
}

// Store keys format:
// stakes:<stakeId> = JSON.stringify(Stake)
// stakes:wallet:<walletAddress> = JSON.stringify(string[]) - array of stake IDs
// rewards:<rewardId> = JSON.stringify(RewardDistribution)
// rewards:wallet:<walletAddress> = JSON.stringify(string[]) - array of reward IDs

export class KVStore {
  constructor(private kv: KVNamespace) {}

  /**
   * Get all stakes for a wallet
   */
  async getStakesByWallet(walletAddress: string): Promise<Stake[]> {
    const stakeIds = await this.getStakeIdsForWallet(walletAddress);
    const stakes: Stake[] = [];

    for (const stakeId of stakeIds) {
      const stake = await this.getStake(stakeId);
      if (stake) {
        stakes.push(stake);
      }
    }

    return stakes;
  }

  /**
   * Get a single stake by ID
   */
  async getStake(stakeId: string): Promise<Stake | null> {
    const json = await this.kv.get(`stakes:${stakeId}`);
    return json ? JSON.parse(json) : null;
  }

  /**
   * Create a new stake
   */
  async createStake(stake: Stake): Promise<Stake> {
    // Store the stake
    await this.kv.put(`stakes:${stake.id}`, JSON.stringify(stake));

    // Add to wallet's stake list
    const stakeIds = await this.getStakeIdsForWallet(stake.walletAddress);
    stakeIds.push(stake.id);
    await this.kv.put(
      `stakes:wallet:${stake.walletAddress}`,
      JSON.stringify(stakeIds),
    );

    return stake;
  }

  /**
   * Update stake status
   */
  async updateStake(stakeId: string, updates: Partial<Stake>): Promise<void> {
    const stake = await this.getStake(stakeId);
    if (!stake) {
      throw new Error("Stake not found");
    }

    const updated: Stake = {
      ...stake,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.kv.put(`stakes:${stakeId}`, JSON.stringify(updated));
  }

  /**
   * Get all rewards for a wallet
   */
  async getRewardsByWallet(walletAddress: string): Promise<RewardDistribution[]> {
    const rewardIds = await this.getRewardIdsForWallet(walletAddress);
    const rewards: RewardDistribution[] = [];

    for (const rewardId of rewardIds) {
      const reward = await this.getReward(rewardId);
      if (reward) {
        rewards.push(reward);
      }
    }

    return rewards;
  }

  /**
   * Get a single reward by ID
   */
  async getReward(rewardId: string): Promise<RewardDistribution | null> {
    const json = await this.kv.get(`rewards:${rewardId}`);
    return json ? JSON.parse(json) : null;
  }

  /**
   * Record a reward distribution
   */
  async recordReward(reward: RewardDistribution): Promise<RewardDistribution> {
    // Store the reward
    await this.kv.put(`rewards:${reward.id}`, JSON.stringify(reward));

    // Add to wallet's reward list
    const rewardIds = await this.getRewardIdsForWallet(reward.walletAddress);
    rewardIds.push(reward.id);
    await this.kv.put(
      `rewards:wallet:${reward.walletAddress}`,
      JSON.stringify(rewardIds),
    );

    return reward;
  }

  /**
   * Update reward status
   */
  async updateReward(
    rewardId: string,
    updates: Partial<RewardDistribution>,
  ): Promise<void> {
    const reward = await this.getReward(rewardId);
    if (!reward) {
      throw new Error("Reward not found");
    }

    const updated: RewardDistribution = {
      ...reward,
      ...updates,
    };

    await this.kv.put(`rewards:${rewardId}`, JSON.stringify(updated));
  }

  /**
   * Get stake IDs for wallet
   */
  private async getStakeIdsForWallet(walletAddress: string): Promise<string[]> {
    const json = await this.kv.get(`stakes:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  /**
   * Get reward IDs for wallet
   */
  private async getRewardIdsForWallet(walletAddress: string): Promise<string[]> {
    const json = await this.kv.get(`rewards:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }
}
