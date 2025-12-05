/**
 * P2P Escrow Management
 * Handles fund holding and escrow operations
 */

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

const API_BASE = "/api/p2p/escrow";

/**
 * Create a new escrow for an order
 */
export async function createEscrow(
  orderId: string,
  buyerWallet: string,
  sellerWallet: string,
  amountPKR: number,
  amountTokens: number,
  token: string,
): Promise<Escrow> {
  try {
    const body = {
      orderId,
      buyerWallet,
      sellerWallet,
      amountPKR,
      amountTokens,
      token,
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
      throw new Error(error.error || "Failed to create escrow");
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error("[P2P Escrow] Error creating escrow:", e);
    throw e;
  }
}

/**
 * Get an escrow by ID
 */
export async function getEscrow(escrowId: string): Promise<Escrow | null> {
  try {
    const response = await fetch(
      `${API_BASE}?id=${encodeURIComponent(escrowId)}`,
    );
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch escrow");
    }
    const result = await response.json();
    return result.data || null;
  } catch (e) {
    console.error("[P2P Escrow] Error getting escrow:", e);
    return null;
  }
}

/**
 * Get all escrows for an order
 */
export async function getEscrowsByOrder(orderId: string): Promise<Escrow[]> {
  try {
    const response = await fetch(
      `${API_BASE}?orderId=${encodeURIComponent(orderId)}`,
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch escrows");
    }
    const result = await response.json();
    return result.data || [];
  } catch (e) {
    console.error("[P2P Escrow] Error getting escrows:", e);
    return [];
  }
}

/**
 * Update escrow status
 */
export async function updateEscrowStatus(
  escrowId: string,
  status: "LOCKED" | "RELEASED" | "REFUNDED" | "DISPUTED",
): Promise<Escrow> {
  try {
    const body = {
      escrowId,
      status,
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
      throw new Error(error.error || "Failed to update escrow");
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error("[P2P Escrow] Error updating escrow:", e);
    throw e;
  }
}
