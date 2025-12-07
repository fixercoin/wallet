/**
 * P2P Order Matching API Client
 * Client-side interface for smart order matching
 */

export interface MatchedOrder {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerWallet: string;
  sellerWallet: string;
  token: string;
  amount: number;
  pricePKRPerToken: number;
  totalPKR: number;
  paymentMethod: string;
  status: "PENDING" | "PAYMENT_CONFIRMED" | "ASSETS_TRANSFERRED" | "COMPLETED" | "CANCELLED";
  createdAt: number;
  updatedAt: number;
  sellerStats?: {
    rating: number;
    level: string;
    completionRate: number;
    totalTrades: number;
  };
  buyerStats?: {
    rating: number;
    level: string;
    completionRate: number;
    totalTrades: number;
  };
}

export interface MerchantProfile {
  walletAddress: string;
  totalTrades: number;
  completedTrades: number;
  completionRate: number;
  averageResponseTimeMinutes: number;
  totalVolumePKR: number;
  rating: number;
  level: "NOVICE" | "INTERMEDIATE" | "ADVANCED" | "PRO";
}

const API_BASE = "/api/p2p";

/**
 * Get matches for a specific order
 */
export async function getMatchesForOrder(
  orderId: string,
  criteria?: any,
): Promise<{ matches: MatchedOrder[]; order: any }> {
  try {
    const params = new URLSearchParams();
    params.append("orderId", orderId);
    if (criteria) {
      params.append("criteria", JSON.stringify(criteria));
    }

    const response = await fetch(
      `${API_BASE}/matches?${params.toString()}`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch matches");
    }

    const result = await response.json();
    return {
      matches: result.matches || [],
      order: result.order,
    };
  } catch (e) {
    console.error("[P2P Matching] Error getting matches:", e);
    throw e;
  }
}

/**
 * Create a matched pair (initiate trade)
 */
export async function createMatchedPair(
  buyOrderId: string,
  sellOrderId: string,
): Promise<{ matchedPair: MatchedOrder; tradeRoomId: string }> {
  try {
    const response = await fetch(`${API_BASE}/matches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        buyOrderId,
        sellOrderId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create matched pair");
    }

    return response.json();
  } catch (e) {
    console.error("[P2P Matching] Error creating matched pair:", e);
    throw e;
  }
}

/**
 * Get matched pair details
 */
export async function getMatchedPair(
  matchId: string,
): Promise<MatchedOrder> {
  try {
    const response = await fetch(`${API_BASE}/matches/${matchId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch matched pair");
    }

    return response.json();
  } catch (e) {
    console.error("[P2P Matching] Error getting matched pair:", e);
    throw e;
  }
}

/**
 * Update matched pair status
 */
export async function updateMatchedPairStatus(
  matchId: string,
  status: string,
): Promise<MatchedOrder> {
  try {
    const response = await fetch(`${API_BASE}/matches/${matchId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update matched pair");
    }

    return response.json();
  } catch (e) {
    console.error("[P2P Matching] Error updating matched pair:", e);
    throw e;
  }
}

/**
 * List all matches for a wallet
 */
export async function getMatchesForWallet(
  walletAddress: string,
  status?: string,
): Promise<MatchedOrder[]> {
  try {
    const params = new URLSearchParams();
    params.append("wallet", walletAddress);
    if (status) {
      params.append("status", status);
    }

    const response = await fetch(
      `${API_BASE}/matches/list/all?${params.toString()}`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch matches");
    }

    const result = await response.json();
    return result.matches || [];
  } catch (e) {
    console.error("[P2P Matching] Error getting wallet matches:", e);
    return [];
  }
}

/**
 * Cancel a matched pair
 */
export async function cancelMatchedPair(matchId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/matches/${matchId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to cancel matched pair");
    }
  } catch (e) {
    console.error("[P2P Matching] Error cancelling matched pair:", e);
    throw e;
  }
}

/**
 * Format match for display
 */
export function formatMatchedPair(match: MatchedOrder, userWallet?: string): {
  isBuyer: boolean;
  otherPartyWallet: string;
  otherPartyStats: any;
  displayPrice: string;
  displayAmount: string;
  formattedDate: string;
} {
  const isBuyer = userWallet === match.buyerWallet;
  const otherPartyWallet = isBuyer ? match.sellerWallet : match.buyerWallet;
  const otherPartyStats = isBuyer ? match.sellerStats : match.buyerStats;

  return {
    isBuyer,
    otherPartyWallet,
    otherPartyStats,
    displayPrice: match.pricePKRPerToken.toFixed(2),
    displayAmount: match.amount.toFixed(2),
    formattedDate: new Date(match.createdAt).toLocaleDateString(),
  };
}
