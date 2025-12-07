/**
 * P2P Advanced Order Filters & Search
 * Provides sophisticated filtering and search for P2P orders
 */

export interface P2PFilterOptions {
  type?: "BUY" | "SELL";
  token?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  minAmountPKR?: number;
  maxAmountPKR?: number;
  paymentMethod?: string;
  minMerchantRating?: number; // Filter by trader rating
  minTraderLevel?: "NOVICE" | "INTERMEDIATE" | "ADVANCED" | "PRO";
  minCompletionRate?: number; // e.g., 95 for 95%
  sortBy?: "PRICE_ASC" | "PRICE_DESC" | "NEWEST" | "RATING";
  limit?: number;
  offset?: number;
}

export interface P2PSearchResult {
  id: string;
  type: "BUY" | "SELL";
  token: string;
  walletAddress: string;
  pricePKRPerQuote: number;
  minAmountPKR: number;
  maxAmountPKR: number;
  paymentMethod: string;
  status: string;
  createdAt: number;
  merchantStats?: {
    rating: number;
    level: string;
    completionRate: number;
    totalTrades: number;
  };
  matchScore?: number; // 0-100 relevance score
}

/**
 * Filter orders based on criteria
 */
export function filterOrders(
  orders: any[],
  options: P2PFilterOptions,
): P2PSearchResult[] {
  let filtered = [...orders];

  // Type filter
  if (options.type) {
    filtered = filtered.filter((o) => o.type === options.type);
  }

  // Token filter
  if (options.token) {
    filtered = filtered.filter(
      (o) => o.token?.toUpperCase() === options.token?.toUpperCase(),
    );
  }

  // Status filter
  if (options.status) {
    filtered = filtered.filter((o) => o.status === options.status);
  }

  // Price range filter
  if (options.minPrice !== undefined) {
    filtered = filtered.filter(
      (o) => (o.pricePKRPerQuote || 0) >= options.minPrice,
    );
  }
  if (options.maxPrice !== undefined) {
    filtered = filtered.filter(
      (o) => (o.pricePKRPerQuote || 0) <= options.maxPrice,
    );
  }

  // Amount range filter
  if (options.minAmountPKR !== undefined) {
    filtered = filtered.filter((o) => {
      const maxAmount = o.maxAmountPKR || o.amountPKR || 0;
      return maxAmount >= options.minAmountPKR;
    });
  }
  if (options.maxAmountPKR !== undefined) {
    filtered = filtered.filter((o) => {
      const minAmount = o.minAmountPKR || o.amountPKR || 0;
      return minAmount <= options.maxAmountPKR;
    });
  }

  // Payment method filter
  if (options.paymentMethod) {
    filtered = filtered.filter(
      (o) =>
        o.payment_method === options.paymentMethod ||
        o.paymentMethod === options.paymentMethod,
    );
  }

  // Merchant rating filter
  if (options.minMerchantRating !== undefined) {
    filtered = filtered.filter((o) => {
      const rating = o.merchantStats?.rating || 0;
      return rating >= options.minMerchantRating;
    });
  }

  // Trader level filter
  if (options.minTraderLevel) {
    const levelRank = {
      NOVICE: 0,
      INTERMEDIATE: 1,
      ADVANCED: 2,
      PRO: 3,
    };

    const minRank = levelRank[options.minTraderLevel];
    filtered = filtered.filter((o) => {
      const level = o.merchantStats?.level || "NOVICE";
      return levelRank[level as keyof typeof levelRank] >= minRank;
    });
  }

  // Completion rate filter
  if (options.minCompletionRate !== undefined) {
    filtered = filtered.filter((o) => {
      const rate = o.merchantStats?.completionRate || 0;
      return rate >= options.minCompletionRate;
    });
  }

  // Sorting
  const sorted = sortOrders(filtered, options.sortBy);

  // Pagination
  const offset = options.offset || 0;
  const limit = options.limit || 50;

  return sorted.slice(offset, offset + limit).map((o) => ({
    id: o.id,
    type: o.type,
    token: o.token,
    walletAddress: o.walletAddress || o.creator_wallet,
    pricePKRPerQuote: o.pricePKRPerQuote,
    minAmountPKR: o.minAmountPKR || 0,
    maxAmountPKR: o.maxAmountPKR || o.amountPKR || 0,
    paymentMethod: o.payment_method || o.paymentMethod,
    status: o.status,
    createdAt: o.createdAt,
    merchantStats: o.merchantStats,
  }));
}

/**
 * Sort orders by criteria
 */
function sortOrders(orders: any[], sortBy?: string): any[] {
  const sorted = [...orders];

  switch (sortBy) {
    case "PRICE_ASC":
      return sorted.sort(
        (a, b) => (a.pricePKRPerQuote || 0) - (b.pricePKRPerQuote || 0),
      );

    case "PRICE_DESC":
      return sorted.sort(
        (a, b) => (b.pricePKRPerQuote || 0) - (a.pricePKRPerQuote || 0),
      );

    case "NEWEST":
      return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    case "RATING":
      return sorted.sort(
        (a, b) =>
          (b.merchantStats?.rating || 0) - (a.merchantStats?.rating || 0),
      );

    default:
      return sorted;
  }
}

/**
 * Search orders by keywords
 */
export function searchOrders(
  orders: any[],
  query: string,
  options: Partial<P2PFilterOptions> = {},
): P2PSearchResult[] {
  const queryLower = query.toLowerCase().trim();

  if (!queryLower) {
    return filterOrders(orders, options as P2PFilterOptions);
  }

  // Search by: wallet address, token name, payment method
  const matching = orders.filter((o) => {
    const wallet = (o.walletAddress || o.creator_wallet || "").toLowerCase();
    const token = (o.token || "").toLowerCase();
    const method = (o.payment_method || o.paymentMethod || "").toLowerCase();

    return (
      wallet.includes(queryLower) ||
      token.includes(queryLower) ||
      method.includes(queryLower)
    );
  });

  return filterOrders(matching, options as P2PFilterOptions);
}

/**
 * Get price statistics for a token/order type
 */
export function getPriceStats(
  orders: any[],
  token: string,
  type: "BUY" | "SELL",
): {
  min: number;
  max: number;
  average: number;
  median: number;
} {
  const prices = orders
    .filter(
      (o) =>
        o.token === token &&
        o.type === type &&
        (o.status === "PENDING" || o.status === "active"),
    )
    .map((o) => o.pricePKRPerQuote)
    .filter((p) => p && p > 0);

  if (prices.length === 0) {
    return { min: 0, max: 0, average: 0, median: 0 };
  }

  const sorted = prices.sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const average = prices.reduce((a, b) => a + b, 0) / prices.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  return { min, max, average, median };
}

/**
 * Get available tokens from orders
 */
export function getAvailableTokens(orders: any[]): string[] {
  const tokens = new Set(orders.map((o) => o.token).filter((t) => t));
  return Array.from(tokens).sort();
}

/**
 * Get available payment methods
 */
export function getAvailablePaymentMethods(orders: any[]): string[] {
  const methods = new Set(
    orders.map((o) => o.payment_method || o.paymentMethod).filter((m) => m),
  );
  return Array.from(methods).sort();
}

/**
 * Calculate match score for filtering/ranking
 */
export function calculateMatchScore(
  userPreferences: Partial<P2PFilterOptions>,
  order: any,
): number {
  let score = 0;

  // Price match (max 30 points)
  if (
    userPreferences.minPrice !== undefined &&
    userPreferences.maxPrice !== undefined
  ) {
    const priceRange = userPreferences.maxPrice - userPreferences.minPrice;
    const orderPrice = order.pricePKRPerQuote || 0;
    const distFromMin = orderPrice - userPreferences.minPrice;

    if (distFromMin >= 0 && distFromMin <= priceRange) {
      score += 30 * (1 - distFromMin / priceRange);
    }
  }

  // Merchant rating (max 35 points)
  if (userPreferences.minMerchantRating !== undefined) {
    const rating = order.merchantStats?.rating || 0;
    if (rating >= userPreferences.minMerchantRating) {
      score += 35 * (rating / 5);
    }
  }

  // Completion rate (max 20 points)
  if (userPreferences.minCompletionRate !== undefined) {
    const rate = order.merchantStats?.completionRate || 0;
    if (rate >= userPreferences.minCompletionRate) {
      score += 20 * (rate / 100);
    }
  }

  // Amount match (max 15 points)
  if (
    userPreferences.minAmountPKR !== undefined &&
    userPreferences.maxAmountPKR !== undefined
  ) {
    const userRange =
      userPreferences.maxAmountPKR - userPreferences.minAmountPKR;
    const orderMin = order.minAmountPKR || 0;
    const orderMax = order.maxAmountPKR || order.amountPKR || 0;

    // Check if ranges overlap
    const overlapStart = Math.max(userPreferences.minAmountPKR, orderMin);
    const overlapEnd = Math.min(userPreferences.maxAmountPKR, orderMax);

    if (overlapStart <= overlapEnd) {
      const overlapSize = overlapEnd - overlapStart;
      score += 15 * (overlapSize / userRange);
    }
  }

  return Math.min(100, score);
}
