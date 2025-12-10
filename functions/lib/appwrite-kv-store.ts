/**
 * Appwrite KV Store Adapter for Cloudflare Functions
 * Provides KV-like interface using Appwrite API for Functions environment
 */

import {
  PaymentMethod,
  P2POrder,
  OrderNotification,
  Escrow,
  Dispute,
} from "./reward-config";

interface AppwriteDocument {
  $id: string;
  [key: string]: any;
}

interface AppwriteListResponse {
  documents: AppwriteDocument[];
  total: number;
}

/**
 * AppwriteKVStore provides the same interface as KVStore but uses Appwrite API
 */
export class AppwriteKVStore {
  private endpoint: string;
  private projectId: string;
  private apiKey: string;
  private databaseId: string;

  constructor(
    endpoint: string,
    projectId: string,
    apiKey: string,
    databaseId: string
  ) {
    this.endpoint = endpoint;
    this.projectId = projectId;
    this.apiKey = apiKey;
    this.databaseId = databaseId;
  }

  private getHeaders(): Record<string, string> {
    return {
      "X-Appwrite-Project": this.projectId,
      "X-Appwrite-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  private getCollectionForKey(key: string): string {
    const prefix = key.split(":")[0];

    const collectionMap: Record<string, string> = {
      stakes: "p2p_orders", // Reuse orders collection for backwards compatibility
      rewards: "p2p_orders",
      orders: "p2p_orders",
      payment_methods: "p2p_payment_methods",
      notifications: "p2p_notifications",
      escrow: "p2p_escrow",
      dispute: "p2p_disputes",
      p2p_matched: "p2p_matches",
      p2p: "p2p_rooms",
      p2p_merchant_stats: "p2p_merchant_stats",
    };

    return collectionMap[prefix] || "p2p_orders";
  }

  private sanitizeDocId(key: string): string {
    // Convert key to valid Appwrite document ID
    return key.replace(/:/g, "_").substring(0, 255);
  }

  async get(key: string): Promise<string | null> {
    try {
      const collection = this.getCollectionForKey(key);
      const docId = this.sanitizeDocId(key);

      const response = await fetch(
        `${this.endpoint}/v1/databases/${this.databaseId}/collections/${collection}/documents/${docId}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        console.error(
          `Appwrite GET error for key ${key}:`,
          response.status,
          await response.text()
        );
        return null;
      }

      const doc = await response.json();
      return doc.value || JSON.stringify(doc);
    } catch (error) {
      console.error(`Error getting key ${key} from Appwrite:`, error);
      return null;
    }
  }

  async put(key: string, value: string): Promise<void> {
    try {
      const collection = this.getCollectionForKey(key);
      const docId = this.sanitizeDocId(key);

      // Try to get existing document first
      const existingResponse = await fetch(
        `${this.endpoint}/v1/databases/${this.databaseId}/collections/${collection}/documents/${docId}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      const isUpdate = existingResponse.ok;
      const method = isUpdate ? "PATCH" : "POST";
      const url = isUpdate
        ? `${this.endpoint}/v1/databases/${this.databaseId}/collections/${collection}/documents/${docId}`
        : `${this.endpoint}/v1/databases/${this.databaseId}/collections/${collection}/documents`;

      const body: any = { value };
      if (!isUpdate) {
        body.$id = docId;
      }

      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `Appwrite ${method} error: ${response.status} ${await response.text()}`
        );
      }
    } catch (error) {
      console.error(`Error putting key ${key} to Appwrite:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const collection = this.getCollectionForKey(key);
      const docId = this.sanitizeDocId(key);

      const response = await fetch(
        `${this.endpoint}/v1/databases/${this.databaseId}/collections/${collection}/documents/${docId}`,
        {
          method: "DELETE",
          headers: this.getHeaders(),
        }
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(
          `Appwrite DELETE error: ${response.status} ${await response.text()}`
        );
      }
    } catch (error) {
      console.error(`Error deleting key ${key} from Appwrite:`, error);
      throw error;
    }
  }

  async list(options?: {
    prefix?: string;
    limit?: number;
  }): Promise<{ keys: Array<{ name: string }>; total?: number }> {
    try {
      const collection = this.getCollectionForKey(options?.prefix || "orders");
      const limit = Math.min(options?.limit || 25, 100);

      const params = new URLSearchParams();
      params.append("limit", limit.toString());

      const response = await fetch(
        `${this.endpoint}/v1/databases/${this.databaseId}/collections/${collection}/documents?${params.toString()}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        console.error(
          `Appwrite LIST error:`,
          response.status,
          await response.text()
        );
        return { keys: [] };
      }

      const data = (await response.json()) as AppwriteListResponse;
      return {
        keys: data.documents.map((doc) => ({ name: doc.key || doc.$id })),
        total: data.total,
      };
    } catch (error) {
      console.error(`Error listing keys from Appwrite:`, error);
      return { keys: [] };
    }
  }

  // Implement KVStore methods for compatibility
  async getStakesByWallet(walletAddress: string): Promise<any[]> {
    const json = await this.get(`stakes:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  async getStake(stakeId: string): Promise<any | null> {
    const json = await this.get(`stakes:${stakeId}`);
    return json ? JSON.parse(json) : null;
  }

  async createStake(stake: any): Promise<any> {
    const stakeIds = await this.getStakesByWallet(stake.walletAddress);
    stakeIds.push(stake.id);
    await this.put(
      `stakes:wallet:${stake.walletAddress}`,
      JSON.stringify(stakeIds)
    );
    await this.put(`stakes:${stake.id}`, JSON.stringify(stake));
    return stake;
  }

  async updateStake(stakeId: string, updates: any): Promise<void> {
    const stake = await this.getStake(stakeId);
    if (!stake) throw new Error("Stake not found");
    const updated = { ...stake, ...updates, updatedAt: Date.now() };
    await this.put(`stakes:${stakeId}`, JSON.stringify(updated));
  }

  async getRewardsByWallet(walletAddress: string): Promise<any[]> {
    const json = await this.get(`rewards:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  async getReward(rewardId: string): Promise<any | null> {
    const json = await this.get(`rewards:${rewardId}`);
    return json ? JSON.parse(json) : null;
  }

  async recordReward(reward: any): Promise<any> {
    const rewardIds = await this.getRewardsByWallet(reward.walletAddress);
    rewardIds.push(reward.id);
    await this.put(
      `rewards:wallet:${reward.walletAddress}`,
      JSON.stringify(rewardIds)
    );
    await this.put(`rewards:${reward.id}`, JSON.stringify(reward));
    return reward;
  }

  async updateReward(rewardId: string, updates: any): Promise<void> {
    const reward = await this.getReward(rewardId);
    if (!reward) throw new Error("Reward not found");
    const updated = { ...reward, ...updates };
    await this.put(`rewards:${rewardId}`, JSON.stringify(updated));
  }

  async getPaymentMethodsByWallet(
    walletAddress: string
  ): Promise<PaymentMethod[]> {
    const json = await this.get(`payment_methods:wallet:${walletAddress}`);
    const methodIds = json ? JSON.parse(json) : [];
    const methods: PaymentMethod[] = [];

    for (const methodId of methodIds) {
      const method = await this.getPaymentMethod(methodId);
      if (method) methods.push(method);
    }

    return methods;
  }

  async getPaymentMethod(methodId: string): Promise<PaymentMethod | null> {
    const json = await this.get(`payment_methods:${methodId}`);
    return json ? JSON.parse(json) : null;
  }

  async savePaymentMethod(
    method: Omit<PaymentMethod, "id" | "createdAt" | "updatedAt">,
    methodId?: string
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

    await this.put(`payment_methods:${id}`, JSON.stringify(paymentMethod));

    const methodIds = await this.getPaymentMethodIdsForWallet(method.walletAddress);
    if (!methodIds.includes(id)) {
      methodIds.push(id);
      await this.put(
        `payment_methods:wallet:${method.walletAddress}`,
        JSON.stringify(methodIds)
      );
    }

    return paymentMethod;
  }

  async deletePaymentMethod(methodId: string, walletAddress: string): Promise<void> {
    await this.delete(`payment_methods:${methodId}`);
    const methodIds = await this.getPaymentMethodIdsForWallet(walletAddress);
    const filtered = methodIds.filter((id: string) => id !== methodId);
    await this.put(
      `payment_methods:wallet:${walletAddress}`,
      JSON.stringify(filtered)
    );
  }

  private async getPaymentMethodIdsForWallet(
    walletAddress: string
  ): Promise<string[]> {
    const json = await this.get(`payment_methods:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  async getOrdersByWallet(walletAddress: string): Promise<P2POrder[]> {
    const json = await this.get(`orders:wallet:${walletAddress}`);
    const orderIds = json ? JSON.parse(json) : [];
    const orders: P2POrder[] = [];

    for (const orderId of orderIds) {
      const order = await this.getOrder(orderId);
      if (order) orders.push(order);
    }

    return orders;
  }

  async getOrder(orderId: string): Promise<P2POrder | null> {
    const json = await this.get(`orders:${orderId}`);
    return json ? JSON.parse(json) : null;
  }

  async saveOrder(
    order: Omit<P2POrder, "id" | "createdAt" | "updatedAt"> & {
      [key: string]: any;
    },
    orderId?: string
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

    await this.put(`orders:${id}`, JSON.stringify(p2pOrder));

    const orderIds = await this.getOrderIdsForWallet(order.walletAddress);
    if (!orderIds.includes(id)) {
      orderIds.push(id);
      await this.put(
        `orders:wallet:${order.walletAddress}`,
        JSON.stringify(orderIds)
      );
    }

    return p2pOrder;
  }

  async deleteOrder(orderId: string, walletAddress: string): Promise<void> {
    await this.delete(`orders:${orderId}`);
    const orderIds = await this.getOrderIdsForWallet(walletAddress);
    const filtered = orderIds.filter((id: string) => id !== orderId);
    await this.put(
      `orders:wallet:${walletAddress}`,
      JSON.stringify(filtered)
    );
  }

  async updateOrderStatus(
    orderId: string,
    status: "PENDING" | "COMPLETED" | "CANCELLED"
  ): Promise<P2POrder | null> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    const updated: P2POrder = {
      ...order,
      status,
      updatedAt: Date.now(),
    };

    await this.put(`orders:${orderId}`, JSON.stringify(updated));
    return updated;
  }

  async getPendingOrdersByWallet(walletAddress: string): Promise<P2POrder[]> {
    const orders = await this.getOrdersByWallet(walletAddress);
    return orders.filter((o) => o.status === "PENDING");
  }

  async getCompletedOrdersByWallet(walletAddress: string): Promise<P2POrder[]> {
    const orders = await this.getOrdersByWallet(walletAddress);
    return orders.filter((o) => o.status === "COMPLETED");
  }

  private async getOrderIdsForWallet(walletAddress: string): Promise<string[]> {
    const json = await this.get(`orders:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  async getNotificationsByWallet(
    walletAddress: string
  ): Promise<OrderNotification[]> {
    const json = await this.get(`notifications:wallet:${walletAddress}`);
    const notifIds = json ? JSON.parse(json) : [];
    const notifications: OrderNotification[] = [];

    for (const notifId of notifIds) {
      const notif = await this.getNotification(notifId);
      if (notif) notifications.push(notif);
    }

    return notifications;
  }

  async getNotification(
    notificationId: string
  ): Promise<OrderNotification | null> {
    const json = await this.get(`notifications:${notificationId}`);
    return json ? JSON.parse(json) : null;
  }

  async saveNotification(
    notification: Omit<OrderNotification, "id" | "createdAt">,
    notificationId?: string
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

    await this.put(`notifications:${id}`, JSON.stringify(orderNotification));

    const notifIds = await this.getNotificationIdsForWallet(
      notification.recipientWallet
    );
    if (!notifIds.includes(id)) {
      notifIds.push(id);
      await this.put(
        `notifications:wallet:${notification.recipientWallet}`,
        JSON.stringify(notifIds)
      );
    }

    return orderNotification;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const notif = await this.getNotification(notificationId);
    if (!notif) throw new Error("Notification not found");

    const updated: OrderNotification = { ...notif, read: true };
    await this.put(`notifications:${notificationId}`, JSON.stringify(updated));
  }

  async getBroadcastNotifications(
    type: "sellers" | "buyers"
  ): Promise<OrderNotification[]> {
    const key = `notifications:broadcast:${type}`;
    const json = await this.get(key);
    if (!json) return [];
    const notifications = JSON.parse(json);
    return Array.isArray(notifications) ? notifications : [];
  }

  private async getNotificationIdsForWallet(
    walletAddress: string
  ): Promise<string[]> {
    const json = await this.get(`notifications:wallet:${walletAddress}`);
    return json ? JSON.parse(json) : [];
  }

  async saveEscrow(
    escrow: Omit<Escrow, "id" | "createdAt" | "updatedAt">,
    escrowId?: string
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

    await this.put(`escrow:${id}`, JSON.stringify(newEscrow));

    const escrowIds = await this.getEscrowIdsForOrder(escrow.orderId);
    if (!escrowIds.includes(id)) {
      escrowIds.push(id);
      await this.put(
        `escrow:order:${escrow.orderId}`,
        JSON.stringify(escrowIds)
      );
    }

    return newEscrow;
  }

  async getEscrow(escrowId: string): Promise<Escrow | null> {
    const json = await this.get(`escrow:${escrowId}`);
    return json ? JSON.parse(json) : null;
  }

  async getEscrowsByOrder(orderId: string): Promise<Escrow[]> {
    const json = await this.get(`escrow:order:${orderId}`);
    const escrowIds = json ? JSON.parse(json) : [];
    const escrows: Escrow[] = [];

    for (const escrowId of escrowIds) {
      const escrow = await this.getEscrow(escrowId);
      if (escrow) escrows.push(escrow);
    }

    return escrows;
  }

  private async getEscrowIdsForOrder(orderId: string): Promise<string[]> {
    const json = await this.get(`escrow:order:${orderId}`);
    return json ? JSON.parse(json) : [];
  }

  async updateEscrowStatus(
    escrowId: string,
    status: "LOCKED" | "RELEASED" | "REFUNDED" | "DISPUTED"
  ): Promise<Escrow | null> {
    const escrow = await this.getEscrow(escrowId);
    if (!escrow) throw new Error("Escrow not found");

    const updated: Escrow = {
      ...escrow,
      status,
      updatedAt: Date.now(),
      ...(status === "RELEASED" && { releasedAt: Date.now() }),
    };

    await this.put(`escrow:${escrowId}`, JSON.stringify(updated));
    return updated;
  }

  async createDispute(
    dispute: Omit<Dispute, "id" | "createdAt" | "updatedAt">
  ): Promise<Dispute> {
    const id = `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const newDispute: Dispute = {
      ...dispute,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.put(`dispute:${id}`, JSON.stringify(newDispute));

    const disputeIds = await this.getDisputeIds();
    disputeIds.push(id);
    await this.put(`disputes:all`, JSON.stringify(disputeIds));

    return newDispute;
  }

  async getDispute(disputeId: string): Promise<Dispute | null> {
    const json = await this.get(`dispute:${disputeId}`);
    return json ? JSON.parse(json) : null;
  }

  async getAllDisputes(): Promise<Dispute[]> {
    const json = await this.get(`disputes:all`);
    const disputeIds = json ? JSON.parse(json) : [];
    const disputes: Dispute[] = [];

    for (const disputeId of disputeIds) {
      const dispute = await this.getDispute(disputeId);
      if (dispute) disputes.push(dispute);
    }

    return disputes;
  }

  async getOpenDisputes(): Promise<Dispute[]> {
    const allDisputes = await this.getAllDisputes();
    return allDisputes.filter((d) => d.status === "OPEN");
  }

  async resolveDispute(
    disputeId: string,
    resolution: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT",
    resolvedBy: string
  ): Promise<Dispute | null> {
    const dispute = await this.getDispute(disputeId);
    if (!dispute) throw new Error("Dispute not found");

    const updated: Dispute = {
      ...dispute,
      status: "RESOLVED",
      resolution,
      resolvedBy,
      resolvedAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.put(`dispute:${disputeId}`, JSON.stringify(updated));
    return updated;
  }

  private async getDisputeIds(): Promise<string[]> {
    const json = await this.get(`disputes:all`);
    return json ? JSON.parse(json) : [];
  }
}
