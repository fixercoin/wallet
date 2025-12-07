/**
 * P2P Merchant Reputation System
 * Tracks trader statistics: completion rate, response time, trade volume
 */

import { getKVStorage } from "./kv-storage";

export interface MerchantStats {
  walletAddress: string;
  totalTrades: number;
  completedTrades: number;
  cancelledTrades: number;
  disputedTrades: number;
  completionRate: number; // percentage (0-100)
  averageResponseTimeMinutes: number;
  totalVolumePKR: number;
  totalVolumeCrypto: number;
  lastTradeAt: number;
  createdAt: number;
  updatedAt: number;
  rating: number; // 1-5 stars
  level: "NOVICE" | "INTERMEDIATE" | "ADVANCED" | "PRO";
}

export interface TradeRecord {
  tradeId: string;
  walletAddress: string;
  otherPartyWallet: string;
  type: "BUY" | "SELL";
  token: string;
  amountTokens: number;
  volumePKR: number;
  status: "COMPLETED" | "CANCELLED" | "DISPUTED";
  responseTimeMinutes: number;
  rating?: number;
  feedback?: string;
  createdAt: number;
}

const STATS_KEY_PREFIX = "p2p_merchant_stats_";
const TRADES_KEY_PREFIX = "p2p_merchant_trades_";

/**
 * Get merchant statistics
 */
export async function getMerchantStats(walletAddress: string): Promise<MerchantStats | null> {
  try {
    const kv = getKVStorage();
    const key = `${STATS_KEY_PREFIX}${walletAddress}`;
    const data = await kv.get(key);

    if (!data) {
      // Return default stats for new merchant
      return {
        walletAddress,
        totalTrades: 0,
        completedTrades: 0,
        cancelledTrades: 0,
        disputedTrades: 0,
        completionRate: 0,
        averageResponseTimeMinutes: 0,
        totalVolumePKR: 0,
        totalVolumeCrypto: 0,
        lastTradeAt: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        rating: 0,
        level: "NOVICE",
      };
    }

    return JSON.parse(data);
  } catch (error) {
    console.error("[P2P Reputation] Error getting merchant stats:", error);
    return null;
  }
}

/**
 * Record a completed trade
 */
export async function recordTrade(
  trade: TradeRecord,
): Promise<void> {
  try {
    const kv = getKVStorage();

    // Update trade record
    const tradesKey = `${TRADES_KEY_PREFIX}${trade.walletAddress}`;
    const tradesData = await kv.get(tradesKey);
    const trades: TradeRecord[] = tradesData ? JSON.parse(tradesData) : [];
    trades.push(trade);

    // Keep last 1000 trades
    if (trades.length > 1000) {
      trades.splice(0, trades.length - 1000);
    }

    await kv.put(tradesKey, JSON.stringify(trades));

    // Update merchant stats
    const stats = await getMerchantStats(trade.walletAddress);
    if (!stats) return;

    stats.totalTrades += 1;
    if (trade.status === "COMPLETED") {
      stats.completedTrades += 1;
    } else if (trade.status === "CANCELLED") {
      stats.cancelledTrades += 1;
    } else if (trade.status === "DISPUTED") {
      stats.disputedTrades += 1;
    }

    stats.completionRate = (stats.completedTrades / stats.totalTrades) * 100;
    stats.totalVolumePKR += trade.volumePKR;
    stats.totalVolumeCrypto += trade.amountTokens;
    stats.lastTradeAt = trade.createdAt;
    stats.averageResponseTimeMinutes =
      (stats.averageResponseTimeMinutes * (stats.totalTrades - 1) +
        trade.responseTimeMinutes) /
      stats.totalTrades;
    stats.updatedAt = Date.now();

    // Calculate rating (1-5 stars)
    stats.rating = calculateRating(stats);

    // Assign level based on trades and completion rate
    stats.level = determineLevel(stats);

    const statsKey = `${STATS_KEY_PREFIX}${trade.walletAddress}`;
    await kv.put(statsKey, JSON.stringify(stats));

    console.log(`[P2P Reputation] Updated stats for ${trade.walletAddress}`);
  } catch (error) {
    console.error("[P2P Reputation] Error recording trade:", error);
  }
}

/**
 * Calculate merchant rating (1-5 stars)
 */
function calculateRating(stats: MerchantStats): number {
  // Base rating on completion rate
  let rating = (stats.completionRate / 100) * 5;

  // Penalize for disputes (max -1 star)
  const disputeRate = (stats.disputedTrades / stats.totalTrades) * 100;
  rating -= (disputeRate / 100) * 1;

  // Bonus for high volume (max +0.5 stars)
  if (stats.totalVolumePKR > 1000000) {
    rating += 0.5;
  }

  // Bonus for fast response time (max +0.5 stars)
  if (stats.averageResponseTimeMinutes < 5) {
    rating += 0.5;
  }

  return Math.min(5, Math.max(1, rating));
}

/**
 * Determine merchant level
 */
function determineLevel(stats: MerchantStats): MerchantStats["level"] {
  const { totalTrades, completionRate } = stats;

  if (totalTrades < 10 || completionRate < 95) {
    return "NOVICE";
  }
  if (totalTrades < 50 || completionRate < 98) {
    return "INTERMEDIATE";
  }
  if (totalTrades < 200 || completionRate < 99) {
    return "ADVANCED";
  }
  return "PRO";
}

/**
 * Get merchant trade history
 */
export async function getMerchantTrades(
  walletAddress: string,
  limit: number = 50,
): Promise<TradeRecord[]> {
  try {
    const kv = getKVStorage();
    const tradesKey = `${TRADES_KEY_PREFIX}${walletAddress}`;
    const data = await kv.get(tradesKey);

    if (!data) {
      return [];
    }

    const trades = JSON.parse(data) as TradeRecord[];
    return trades.slice(-limit).reverse(); // Return recent trades
  } catch (error) {
    console.error("[P2P Reputation] Error getting merchant trades:", error);
    return [];
  }
}

/**
 * Get top merchants by rating
 */
export async function getTopMerchants(
  limit: number = 10,
): Promise<MerchantStats[]> {
  try {
    // Note: This is a simplified version since KV doesn't support complex queries
    // In production, you'd want to use a database with indexing
    const kv = getKVStorage();
    const listResult = await kv.list();
    const keys = listResult.keys || [];

    const merchants: MerchantStats[] = [];

    for (const key of keys) {
      if (key.name.startsWith(STATS_KEY_PREFIX)) {
        const data = await kv.get(key.name);
        if (data) {
          merchants.push(JSON.parse(data));
        }
      }
    }

    return merchants
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  } catch (error) {
    console.error("[P2P Reputation] Error getting top merchants:", error);
    return [];
  }
}
