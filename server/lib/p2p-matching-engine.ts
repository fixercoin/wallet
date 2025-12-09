/**
 * P2P Order Matching Engine
 * Implements smart matching algorithm similar to Binance P2P
 * Matches BUY and SELL orders based on:
 * - Price compatibility (buyer accepts seller's price or better)
 * - Amount range compatibility
 * - Payment method match
 * - Token match
 */

export interface MatchedPair {
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
  status:
    | "PENDING"
    | "PAYMENT_CONFIRMED"
    | "ASSETS_TRANSFERRED"
    | "COMPLETED"
    | "CANCELLED";
  createdAt: number;
  updatedAt: number;
  escrowId?: string;
}

export interface MatchingCriteria {
  maxPriceDeviation?: number; // Max % price difference (default 2%)
  minAmount?: number; // Minimum trade amount in PKR
  maxAmount?: number; // Maximum trade amount in PKR
}

/**
 * Calculate if buyer's max price >= seller's min price
 */
function isPriceCompatible(
  buyerMaxPrice: number,
  sellerMinPrice: number,
  maxDeviation: number = 2,
): boolean {
  const deviationPercent =
    ((sellerMinPrice - buyerMaxPrice) / buyerMaxPrice) * 100;
  return deviationPercent <= maxDeviation;
}

/**
 * Check if trade amounts overlap
 */
function isAmountCompatible(
  buyerMinPKR: number,
  buyerMaxPKR: number,
  sellerMinPKR: number,
  sellerMaxPKR: number,
): { compatible: boolean; tradeAmount: number } {
  // Find overlapping range
  const overlapMin = Math.max(buyerMinPKR, sellerMinPKR);
  const overlapMax = Math.min(buyerMaxPKR, sellerMaxPKR);

  if (overlapMin <= overlapMax) {
    // Use seller's amount preference if within buyer's range, otherwise use overlap midpoint
    const tradeAmount = Math.min(sellerMaxPKR, buyerMaxPKR);
    return { compatible: true, tradeAmount };
  }

  return { compatible: false, tradeAmount: 0 };
}

/**
 * Main matching algorithm
 * Returns best matches for a given order
 */
export function findMatches(
  order: any,
  allOrders: any[],
  criteria: MatchingCriteria = {},
): MatchedPair[] {
  const {
    maxPriceDeviation = 2,
    minAmount = 100,
    maxAmount = 1000000,
  } = criteria;

  const matches: MatchedPair[] = [];

  // Can only match BUY with SELL orders
  const oppositeType = order.type === "BUY" ? "SELL" : "BUY";

  // Filter to eligible orders
  const candidates = allOrders.filter(
    (o) =>
      o.id !== order.id &&
      o.type === oppositeType &&
      o.status === "PENDING" &&
      o.token === order.token &&
      o.payment_method === order.payment_method &&
      o.walletAddress !== order.walletAddress, // No self-matching
  );

  // Score and sort candidates
  const scored = candidates.map((candidate) => {
    let score = 0;

    // Exact amount match gets highest score
    const buyOrder = order.type === "BUY" ? order : candidate;
    const sellOrder = order.type === "SELL" ? order : candidate;

    const amountCompat = isAmountCompatible(
      buyOrder.minAmountPKR || 100,
      buyOrder.maxAmountPKR || 1000000,
      sellOrder.minAmountPKR || 100,
      sellOrder.maxAmountPKR || 1000000,
    );

    if (!amountCompat.compatible) {
      return { candidate, score: -1 };
    }

    // Amount overlap score (prefer larger overlap)
    score += amountCompat.tradeAmount / 10000;

    // Price compatibility score
    const buyerPrice = buyOrder.pricePKRPerQuote;
    const sellerPrice = sellOrder.pricePKRPerQuote;

    if (isPriceCompatible(buyerPrice, sellerPrice, maxPriceDeviation)) {
      // Prefer closer prices
      const priceDiff = Math.abs(buyerPrice - sellerPrice);
      score += (maxPriceDeviation - (priceDiff / sellerPrice) * 100) * 10;
    } else {
      return { candidate, score: -1 };
    }

    // Faster responders get slight boost (newer orders)
    score += (Date.now() - candidate.createdAt) / 1000000;

    return { candidate, score };
  });

  // Sort by score descending, filter valid matches
  scored
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5) // Return top 5 matches
    .forEach(({ candidate }) => {
      const buyOrder = order.type === "BUY" ? order : candidate;
      const sellOrder = order.type === "SELL" ? order : candidate;

      const amountCompat = isAmountCompatible(
        buyOrder.minAmountPKR || 100,
        buyOrder.maxAmountPKR || 1000000,
        sellOrder.minAmountPKR || 100,
        sellOrder.maxAmountPKR || 1000000,
      );

      // Use average price for matched pair
      const matchPrice =
        (buyOrder.pricePKRPerQuote + sellOrder.pricePKRPerQuote) / 2;

      matches.push({
        id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        buyerWallet: buyOrder.walletAddress,
        sellerWallet: sellOrder.walletAddress,
        token: order.token,
        amount: amountCompat.tradeAmount,
        pricePKRPerToken: matchPrice,
        totalPKR: amountCompat.tradeAmount,
        paymentMethod: order.payment_method,
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

  return matches;
}

/**
 * Get all potential matches for an order across the entire order book
 */
export async function getOrderMatches(
  order: any,
  allOrders: any[],
  criteria: MatchingCriteria = {},
): Promise<MatchedPair[]> {
  return findMatches(order, allOrders, criteria);
}
