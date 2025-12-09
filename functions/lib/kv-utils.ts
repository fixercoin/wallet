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
  status: "PENDING" | "COMPLETED" | "CANCELLED" | "ESCROW_LOCKED" | "DISPUTED";
  createdAt: number;
  updatedAt: number;
  escrowId?: string;
  matchedWith?: string;
  minAmountPKR?: number;
  maxAmountPKR?: number;
  minAmountTokens?: number;
  maxAmountTokens?: number;
  pricePKRPerQuote?: number;
  sellerWallet?: string;
  buyerWallet?: string;
}

export interface OrderNotification {
  id: string;
  orderId: string;
  recipientWallet: string;
  senderWallet: string;
  type:
    | "order_created"
    | "new_buy_order"
    | "new_sell_order"
    | "payment_confirmed"
    | "seller_payment_received"
    | "transfer_initiated"
    | "crypto_received"
    | "order_cancelled"
    | "order_accepted"
    | "order_rejected"
    | "order_completed_by_seller";
  orderType: "BUY" | "SELL";
  message: string;
  orderData: {
    token: string;
    amountTokens: number;
    amountPKR: number;
  };
  read: boolean;
  createdAt: number;
}

export interface Escrow {
  id: string;
  orderId: string;
  buyerWallet: string;
  sellerWallet: string;
  amountPKR: number;
  amountTokens: number;
  token: string;
  status: "LOCKED" | "RELEASED" | "REFUNDED" | "DISPUTED";
  createdAt: number;
  updatedAt: number;
  releasedAt?: number;
}

export interface Dispute {
  id: string;
  escrowId: string;
  orderId: string;
  initiatedBy: string;
  reason: string;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  resolution?: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT";
  resolvedBy?: string;
  resolvedAt?: number;
  evidence: string[];
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
    const paymentMethodIds =
      await this.getPaymentMethodIdsForWallet(walletAddress);
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
      methodId || `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const existing = methodId ? await this.getPaymentMethod(methodId) : null;

    const paymentMethod: PaymentMethod = {
      ...method,
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await this.kv.put(`payment_methods:${id}`, JSON.stringify(paymentMethod));

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

    const paymentMethodIds =
      await this.getPaymentMethodIdsForWallet(walletAddress);
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
    order: Omit<P2POrder, "id" | "createdAt" | "updatedAt"> & {
      [key: string]: any;
    },
    orderId?: string,
  ): Promise<P2POrder> {
    const id =
      orderId ||
      `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const existing = orderId ? await this.getOrder(orderId) : null;

    const p2pOrder: P2POrder = {
      ...order,
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    } as P2POrder;

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
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: "PENDING" | "COMPLETED" | "CANCELLED",
  ): Promise<P2POrder | null> {
    const order = await this.getOrder(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const updated: P2POrder = {
      ...order,
      status,
      updatedAt: Date.now(),
    };

    await this.kv.put(`orders:${orderId}`, JSON.stringify(updated));
    return updated;
  }

  /**
   * Get pending orders for a wallet
   */
  async getPendingOrdersByWallet(walletAddress: string): Promise<P2POrder[]> {
    const orders = await this.getOrdersByWallet(walletAddress);
    return orders.filter((o) => o.status === "PENDING");
  }

  /**
   * Get completed orders for a wallet
   */
  async getCompletedOrdersByWallet(walletAddress: string): Promise<P2POrder[]> {
    const orders = await this.getOrdersByWallet(walletAddress);
    return orders.filter((o) => o.status === "COMPLETED");
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

  /**
   * Get all notifications for a wallet
   */
  async getNotificationsByWallet(
    walletAddress: string,
  ): Promise<OrderNotification[]> {
    const notificationIds =
      await this.getNotificationIdsForWallet(walletAddress);
    const notifications: OrderNotification[] = [];

    for (const notifId of notificationIds) {
      const notif = await this.getNotification(notifId);
      if (notif) {
        notifications.push(notif);
      }
    }

    return notifications;
  }

  /**
   * Get a single notification by ID
   */
  async getNotification(
    notificationId: string,
  ): Promise<OrderNotification | null> {
    const json = await this.kv.get(`notifications:${notificationId}`);
    return json ? JSON.parse(json) : null;
  }

  /**
   * Save a notification
   */
  async saveNotification(
    notification: Omit<OrderNotification, "id" | "createdAt">,
    notificationId?: string,
  ): Promise<OrderNotification> {
    const id =
      notificationId ||
      `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const orderNotification: OrderNotification = {
      ...notification,
      id,
      createdAt: now,
    };

    await this.kv.put(`notifications:${id}`, JSON.stringify(orderNotification));

    const notificationIds = await this.getNotificationIdsForWallet(
      notification.recipientWallet,
    );

    if (!notificationIds.includes(id)) {
      notificationIds.push(id);
      await this.kv.put(
        `notifications:wallet:${notification.recipientWallet}`,
        JSON.stringify(notificationIds),
      );
    }

    return orderNotification;
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    const notif = await this.getNotification(notificationId);
    if (!notif) {
      throw new Error("Notification not found");
    }

    const updated: OrderNotification = {
      ...notif,
      read: true,
    };

    await this.kv.put(
      `notifications:${notificationId}`,
      JSON.stringify(updated),
    );
  }

  /**
   * Get broadcast notifications for sellers or buyers
   */
  async getBroadcastNotifications(
    type: "sellers" | "buyers",
  ): Promise<OrderNotification[]> {
    const key = `notifications:broadcast:${type}`;
    const json = await this.kv.get(key);
    if (!json) {
      return [];
    }
    const notifications = JSON.parse(json);
    return Array.isArray(notifications) ? notifications : [];
  }

  /**
   * Get notification IDs for wallet
   */
  private async getNotificationIdsForWallet(
    walletAddress: string,
  ): Promise<string[]> {
    const json = await this.kv.get(`notifications:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  /**
   * Create or update an escrow
   */
  async saveEscrow(
    escrow: Omit<Escrow, "id" | "createdAt" | "updatedAt">,
    escrowId?: string,
  ): Promise<Escrow> {
    const id =
      escrowId ||
      `escrow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const existing = escrowId ? await this.getEscrow(escrowId) : null;

    const newEscrow: Escrow = {
      ...escrow,
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await this.kv.put(`escrow:${id}`, JSON.stringify(newEscrow));

    const escrowIds = await this.getEscrowIdsForOrder(escrow.orderId);
    if (!escrowIds.includes(id)) {
      escrowIds.push(id);
      await this.kv.put(
        `escrow:order:${escrow.orderId}`,
        JSON.stringify(escrowIds),
      );
    }

    return newEscrow;
  }

  /**
   * Get an escrow by ID
   */
  async getEscrow(escrowId: string): Promise<Escrow | null> {
    const json = await this.kv.get(`escrow:${escrowId}`);
    return json ? JSON.parse(json) : null;
  }

  /**
   * Get all escrows for an order
   */
  async getEscrowsByOrder(orderId: string): Promise<Escrow[]> {
    const escrowIds = await this.getEscrowIdsForOrder(orderId);
    const escrows: Escrow[] = [];

    for (const escrowId of escrowIds) {
      const escrow = await this.getEscrow(escrowId);
      if (escrow) {
        escrows.push(escrow);
      }
    }

    return escrows;
  }

  /**
   * Get escrow IDs for order
   */
  private async getEscrowIdsForOrder(orderId: string): Promise<string[]> {
    const json = await this.kv.get(`escrow:order:${orderId}`);
    return json ? JSON.parse(json) : [];
  }

  /**
   * Update escrow status
   */
  async updateEscrowStatus(
    escrowId: string,
    status: "LOCKED" | "RELEASED" | "REFUNDED" | "DISPUTED",
  ): Promise<Escrow | null> {
    const escrow = await this.getEscrow(escrowId);
    if (!escrow) {
      throw new Error("Escrow not found");
    }

    const updated: Escrow = {
      ...escrow,
      status,
      updatedAt: Date.now(),
      ...(status === "RELEASED" && { releasedAt: Date.now() }),
    };

    await this.kv.put(`escrow:${escrowId}`, JSON.stringify(updated));
    return updated;
  }

  /**
   * Create a dispute
   */
  async createDispute(
    dispute: Omit<Dispute, "id" | "createdAt" | "updatedAt">,
  ): Promise<Dispute> {
    const id = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const newDispute: Dispute = {
      ...dispute,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.kv.put(`dispute:${id}`, JSON.stringify(newDispute));

    const disputeIds = await this.getDisputeIds();
    disputeIds.push(id);
    await this.kv.put(`disputes:all`, JSON.stringify(disputeIds));

    return newDispute;
  }

  /**
   * Get a dispute by ID
   */
  async getDispute(disputeId: string): Promise<Dispute | null> {
    const json = await this.kv.get(`dispute:${disputeId}`);
    return json ? JSON.parse(json) : null;
  }

  /**
   * Get all disputes
   */
  async getAllDisputes(): Promise<Dispute[]> {
    const disputeIds = await this.getDisputeIds();
    const disputes: Dispute[] = [];

    for (const disputeId of disputeIds) {
      const dispute = await this.getDispute(disputeId);
      if (dispute) {
        disputes.push(dispute);
      }
    }

    return disputes;
  }

  /**
   * Get open disputes
   */
  async getOpenDisputes(): Promise<Dispute[]> {
    const allDisputes = await this.getAllDisputes();
    return allDisputes.filter((d) => d.status === "OPEN");
  }

  /**
   * Resolve a dispute
   */
  async resolveDispute(
    disputeId: string,
    resolution: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT",
    resolvedBy: string,
  ): Promise<Dispute | null> {
    const dispute = await this.getDispute(disputeId);
    if (!dispute) {
      throw new Error("Dispute not found");
    }

    const updated: Dispute = {
      ...dispute,
      status: "RESOLVED",
      resolution,
      resolvedBy,
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.kv.put(`dispute:${disputeId}`, JSON.stringify(updated));
    return updated;
  }

  /**
   * Get dispute IDs
   */
  private async getDisputeIds(): Promise<string[]> {
    const json = await this.kv.get(`disputes:all`);
    return json ? JSON.parse(json) : [];
  }
}
