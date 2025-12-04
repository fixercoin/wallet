/**
 * Cloudflare KV Storage Utilities
 * Handles all KV operations for staking, rewards, payment methods, and orders
 */

import { Stake, RewardDistribution } from "./reward-config";

export interface PaymentMethod {
  id: string;
  walletAddress: string;
  userName: string;
  paymentMethod: "EASYPAISA";
  accountName: string;
  accountNumber: string;
  solanawWalletAddress: string;
  createdAt: number;
  updatedAt: number;
}

export interface P2POrder {
  id: string;
  walletAddress: string;
  type: "BUY" | "SELL";
  token: string;
  amountTokens: number;
  amountPKR: number;
  paymentMethodId: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  createdAt: number;
  updatedAt: number;
}

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
  constructor(private kv: KVNamespace) {
    if (!kv) {
      throw new Error(
        "KV namespace is required. Ensure STAKING_KV is bound in wrangler.toml",
      );
    }
  }

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
  async getRewardsByWallet(
    walletAddress: string,
  ): Promise<RewardDistribution[]> {
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
  private async getRewardIdsForWallet(
    walletAddress: string,
  ): Promise<string[]> {
    const json = await this.kv.get(`rewards:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  /**
   * Get all payment methods for a wallet
   */
  async getPaymentMethodsByWallet(
    walletAddress: string,
  ): Promise<PaymentMethod[]> {
    const paymentMethodIds = await this.getPaymentMethodIdsForWallet(
      walletAddress,
    );
    const paymentMethods: PaymentMethod[] = [];

    for (const methodId of paymentMethodIds) {
      const method = await this.getPaymentMethod(methodId);
      if (method) {
        paymentMethods.push(method);
      }
    }

    return paymentMethods;
  }

  /**
   * Get a single payment method by ID
   */
  async getPaymentMethod(methodId: string): Promise<PaymentMethod | null> {
    const json = await this.kv.get(`payment_methods:${methodId}`);
    return json ? JSON.parse(json) : null;
  }

  /**
   * Create or update a payment method
   */
  async savePaymentMethod(
    method: Omit<PaymentMethod, "id" | "createdAt" | "updatedAt">,
    methodId?: string,
  ): Promise<PaymentMethod> {
    const id =
      methodId ||
      `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const existing = methodId ? await this.getPaymentMethod(methodId) : null;

    const paymentMethod: PaymentMethod = {
      ...method,
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await this.kv.put(
      `payment_methods:${id}`,
      JSON.stringify(paymentMethod),
    );

    const paymentMethodIds = await this.getPaymentMethodIdsForWallet(
      method.walletAddress,
    );

    if (!paymentMethodIds.includes(id)) {
      paymentMethodIds.push(id);
      await this.kv.put(
        `payment_methods:wallet:${method.walletAddress}`,
        JSON.stringify(paymentMethodIds),
      );
    }

    return paymentMethod;
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(
    methodId: string,
    walletAddress: string,
  ): Promise<void> {
    await this.kv.delete(`payment_methods:${methodId}`);

    const paymentMethodIds = await this.getPaymentMethodIdsForWallet(
      walletAddress,
    );
    const filtered = paymentMethodIds.filter((id) => id !== methodId);
    await this.kv.put(
      `payment_methods:wallet:${walletAddress}`,
      JSON.stringify(filtered),
    );
  }

  /**
   * Get all orders for a wallet
   */
  async getOrdersByWallet(walletAddress: string): Promise<P2POrder[]> {
    const orderIds = await this.getOrderIdsForWallet(walletAddress);
    const orders: P2POrder[] = [];

    for (const orderId of orderIds) {
      const order = await this.getOrder(orderId);
      if (order) {
        orders.push(order);
      }
    }

    return orders;
  }

  /**
   * Get a single order by ID
   */
  async getOrder(orderId: string): Promise<P2POrder | null> {
    const json = await this.kv.get(`orders:${orderId}`);
    return json ? JSON.parse(json) : null;
  }

  /**
   * Create or update an order
   */
  async saveOrder(
    order: Omit<P2POrder, "id" | "createdAt" | "updatedAt">,
    orderId?: string,
  ): Promise<P2POrder> {
    const id = orderId || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const existing = orderId ? await this.getOrder(orderId) : null;

    const p2pOrder: P2POrder = {
      ...order,
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await this.kv.put(`orders:${id}`, JSON.stringify(p2pOrder));

    const orderIds = await this.getOrderIdsForWallet(order.walletAddress);

    if (!orderIds.includes(id)) {
      orderIds.push(id);
      await this.kv.put(
        `orders:wallet:${order.walletAddress}`,
        JSON.stringify(orderIds),
      );
    }

    return p2pOrder;
  }

  /**
   * Delete an order
   */
  async deleteOrder(orderId: string, walletAddress: string): Promise<void> {
    await this.kv.delete(`orders:${orderId}`);

    const orderIds = await this.getOrderIdsForWallet(walletAddress);
    const filtered = orderIds.filter((id) => id !== orderId);
    await this.kv.put(
      `orders:wallet:${walletAddress}`,
      JSON.stringify(filtered),
    );
  }

  /**
   * Get payment method IDs for wallet
   */
  private async getPaymentMethodIdsForWallet(
    walletAddress: string,
  ): Promise<string[]> {
    const json = await this.kv.get(`payment_methods:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  /**
   * Get order IDs for wallet
   */
  private async getOrderIdsForWallet(walletAddress: string): Promise<string[]> {
    const json = await this.kv.get(`orders:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }
}
