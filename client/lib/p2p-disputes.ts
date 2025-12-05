/**
 * P2P Disputes Management
 * Handles dispute creation and resolution
 */

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

const API_BASE = "/api/p2p/disputes";

/**
 * Create a new dispute
 */
export async function createDispute(
  escrowId: string,
  orderId: string,
  initiatedBy: string,
  reason: string,
  evidence?: string[],
): Promise<Dispute> {
  try {
    const body = {
      escrowId,
      orderId,
      initiatedBy,
      reason,
      evidence: evidence || [],
    };

    const response = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create dispute");
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error("[P2P Disputes] Error creating dispute:", e);
    throw e;
  }
}

/**
 * Get a dispute by ID
 */
export async function getDispute(disputeId: string): Promise<Dispute | null> {
  try {
    const response = await fetch(
      `${API_BASE}?id=${encodeURIComponent(disputeId)}`,
    );
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch dispute");
    }
    const result = await response.json();
    return result.data || null;
  } catch (e) {
    console.error("[P2P Disputes] Error getting dispute:", e);
    return null;
  }
}

/**
 * Get all disputes
 */
export async function getAllDisputes(): Promise<Dispute[]> {
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch disputes");
    }
    const result = await response.json();
    return result.data || [];
  } catch (e) {
    console.error("[P2P Disputes] Error getting disputes:", e);
    return [];
  }
}

/**
 * Get open disputes only
 */
export async function getOpenDisputes(): Promise<Dispute[]> {
  try {
    const response = await fetch(`${API_BASE}?filter=open`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch open disputes");
    }
    const result = await response.json();
    return result.data || [];
  } catch (e) {
    console.error("[P2P Disputes] Error getting open disputes:", e);
    return [];
  }
}

/**
 * Resolve a dispute (admin only)
 */
export async function resolveDispute(
  disputeId: string,
  resolution: "RELEASE_TO_SELLER" | "REFUND_TO_BUYER" | "SPLIT",
  resolvedBy: string,
): Promise<Dispute> {
  try {
    const body = {
      disputeId,
      resolution,
      resolvedBy,
    };

    const response = await fetch(API_BASE, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to resolve dispute");
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error("[P2P Disputes] Error resolving dispute:", e);
    throw e;
  }
}
