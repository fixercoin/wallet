/**
 * P2P Advanced Search & Filter Routes
 * Provides sophisticated order search and filtering capabilities
 */

import { RequestHandler } from "express";
import { getKVStorage } from "../lib/kv-storage";
import {
  filterOrders,
  searchOrders,
  getPriceStats,
  getAvailableTokens,
  getAvailablePaymentMethods,
  P2PFilterOptions,
} from "../lib/p2p-filters";
import { getMerchantStats } from "../lib/p2p-reputation";

/**
 * Search and filter orders
 * GET /api/p2p/search
 */
export const handleP2PSearch: RequestHandler = async (req, res) => {
  try {
    const {
      q,
      type,
      token,
      status,
      minPrice,
      maxPrice,
      minAmount,
      maxAmount,
      paymentMethod,
      minRating,
      minLevel,
      minCompletion,
      sortBy,
      limit,
      offset,
    } = req.query;

    // Get all orders from KV
    const kv = getKVStorage();
    const listResult = await kv.list();
    const keys = listResult.keys || [];

    const orders: any[] = [];
    for (const key of keys) {
      if (
        key.name.startsWith("orders:") &&
        !key.name.includes("wallet:")
      ) {
        const data = await kv.get(key.name);
        if (data) {
          const order = JSON.parse(data);
          // Enrich with merchant stats
          const stats = await getMerchantStats(order.walletAddress || order.creator_wallet);
          if (stats) {
            order.merchantStats = {
              rating: stats.rating,
              level: stats.level,
              completionRate: stats.completionRate,
              totalTrades: stats.totalTrades,
            };
          }
          orders.push(order);
        }
      }
    }

    // Build filter options
    const filterOptions: P2PFilterOptions = {
      type: type ? (String(type).toUpperCase() as any) : undefined,
      token: token ? String(token).toUpperCase() : undefined,
      status: status ? String(status) : undefined,
      minPrice: minPrice ? parseFloat(String(minPrice)) : undefined,
      maxPrice: maxPrice ? parseFloat(String(maxPrice)) : undefined,
      minAmountPKR: minAmount ? parseFloat(String(minAmount)) : undefined,
      maxAmountPKR: maxAmount ? parseFloat(String(maxAmount)) : undefined,
      paymentMethod: paymentMethod ? String(paymentMethod) : undefined,
      minMerchantRating: minRating ? parseFloat(String(minRating)) : undefined,
      minTraderLevel: minLevel ? (String(minLevel) as any) : undefined,
      minCompletionRate: minCompletion ? parseFloat(String(minCompletion)) : undefined,
      sortBy: sortBy ? String(sortBy) as any : "NEWEST",
      limit: limit ? parseInt(String(limit)) : 50,
      offset: offset ? parseInt(String(offset)) : 0,
    };

    // Search or filter
    let results;
    if (q) {
      results = searchOrders(orders, String(q), filterOptions);
    } else {
      results = filterOrders(orders, filterOptions);
    }

    res.json({
      results,
      total: results.length,
      query: q,
      filters: filterOptions,
    });
  } catch (error) {
    console.error("[P2P Search] Error searching orders:", error);
    res.status(500).json({ error: "Failed to search orders" });
  }
};

/**
 * Get price statistics for a token
 * GET /api/p2p/stats/price?token=SOL&type=SELL
 */
export const handleGetPriceStats: RequestHandler = async (req, res) => {
  try {
    const { token, type } = req.query;

    if (!token || !type) {
      return res
        .status(400)
        .json({ error: "token and type parameters required" });
    }

    // Get all orders
    const kv = getKVStorage();
    const listResult = await kv.list();
    const keys = listResult.keys || [];

    const orders: any[] = [];
    for (const key of keys) {
      if (
        key.name.startsWith("orders:") &&
        !key.name.includes("wallet:")
      ) {
        const data = await kv.get(key.name);
        if (data) {
          orders.push(JSON.parse(data));
        }
      }
    }

    const stats = getPriceStats(
      orders,
      String(token).toUpperCase(),
      String(type).toUpperCase() as "BUY" | "SELL",
    );

    res.json({
      token,
      type,
      stats,
    });
  } catch (error) {
    console.error("[P2P Stats] Error getting price stats:", error);
    res.status(500).json({ error: "Failed to get price stats" });
  }
};

/**
 * Get available filters metadata
 * GET /api/p2p/filters/available
 */
export const handleGetAvailableFilters: RequestHandler = async (req, res) => {
  try {
    // Get all orders
    const kv = getKVStorage();
    const listResult = await kv.list();
    const keys = listResult.keys || [];

    const orders: any[] = [];
    for (const key of keys) {
      if (
        key.name.startsWith("orders:") &&
        !key.name.includes("wallet:")
      ) {
        const data = await kv.get(key.name);
        if (data) {
          orders.push(JSON.parse(data));
        }
      }
    }

    const tokens = getAvailableTokens(orders);
    const paymentMethods = getAvailablePaymentMethods(orders);

    // Get price ranges
    const buyStats = getPriceStats(orders, tokens[0] || "SOL", "BUY");
    const sellStats = getPriceStats(orders, tokens[0] || "SOL", "SELL");

    res.json({
      tokens,
      paymentMethods,
      priceRanges: {
        buy: buyStats,
        sell: sellStats,
      },
      levels: ["NOVICE", "INTERMEDIATE", "ADVANCED", "PRO"],
      sortOptions: [
        "PRICE_ASC",
        "PRICE_DESC",
        "NEWEST",
        "RATING",
      ],
    });
  } catch (error) {
    console.error("[P2P Filters] Error getting available filters:", error);
    res.status(500).json({ error: "Failed to get filters" });
  }
};

/**
 * Get trending orders (most active)
 * GET /api/p2p/trending?type=SELL&token=SOL&limit=10
 */
export const handleGetTrendingOrders: RequestHandler = async (req, res) => {
  try {
    const { type = "SELL", token = "SOL", limit = 10 } = req.query;

    // Get all orders
    const kv = getKVStorage();
    const listResult = await kv.list();
    const keys = listResult.keys || [];

    const orders: any[] = [];
    for (const key of keys) {
      if (
        key.name.startsWith("orders:") &&
        !key.name.includes("wallet:")
      ) {
        const data = await kv.get(key.name);
        if (data) {
          const order = JSON.parse(data);
          // Enrich with merchant stats
          const stats = await getMerchantStats(order.walletAddress || order.creator_wallet);
          if (stats) {
            order.merchantStats = {
              rating: stats.rating,
              level: stats.level,
              completionRate: stats.completionRate,
              totalTrades: stats.totalTrades,
            };
          }
          orders.push(order);
        }
      }
    }

    // Filter and sort by rating + recency
    const trending = orders
      .filter(
        (o) =>
          o.type === type &&
          o.token === token &&
          (o.status === "PENDING" || o.status === "active"),
      )
      .sort((a, b) => {
        // Primary: sort by merchant rating
        const ratingDiff =
          (b.merchantStats?.rating || 0) -
          (a.merchantStats?.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;

        // Secondary: sort by recency
        return (b.createdAt || 0) - (a.createdAt || 0);
      })
      .slice(0, parseInt(String(limit)));

    res.json({
      trending,
      type,
      token,
      total: trending.length,
    });
  } catch (error) {
    console.error("[P2P Trending] Error getting trending orders:", error);
    res.status(500).json({ error: "Failed to get trending orders" });
  }
};

/**
 * Get orders by merchant reputation
 * GET /api/p2p/merchants?minLevel=PRO&minRating=4.5
 */
export const handleGetMerchantOrders: RequestHandler = async (req, res) => {
  try {
    const { minLevel, minRating, type, token, limit = 20 } = req.query;

    // Get all orders
    const kv = getKVStorage();
    const listResult = await kv.list();
    const keys = listResult.keys || [];

    const orders: any[] = [];
    for (const key of keys) {
      if (
        key.name.startsWith("orders:") &&
        !key.name.includes("wallet:")
      ) {
        const data = await kv.get(key.name);
        if (data) {
          const order = JSON.parse(data);
          // Enrich with merchant stats
          const stats = await getMerchantStats(order.walletAddress || order.creator_wallet);
          if (stats) {
            order.merchantStats = {
              rating: stats.rating,
              level: stats.level,
              completionRate: stats.completionRate,
              totalTrades: stats.totalTrades,
            };
          }
          orders.push(order);
        }
      }
    }

    // Filter by merchant reputation
    let filtered = orders;

    if (minLevel) {
      const levelRank = {
        NOVICE: 0,
        INTERMEDIATE: 1,
        ADVANCED: 2,
        PRO: 3,
      };
      const minRankValue = levelRank[String(minLevel) as keyof typeof levelRank];

      filtered = filtered.filter((o) => {
        const level = o.merchantStats?.level || "NOVICE";
        return (
          levelRank[level as keyof typeof levelRank] >= minRankValue
        );
      });
    }

    if (minRating) {
      const minRatingValue = parseFloat(String(minRating));
      filtered = filtered.filter((o) => {
        return (o.merchantStats?.rating || 0) >= minRatingValue;
      });
    }

    if (type) {
      filtered = filtered.filter((o) => o.type === type);
    }

    if (token) {
      filtered = filtered.filter((o) => o.token === token);
    }

    // Sort by rating
    filtered.sort(
      (a, b) =>
        (b.merchantStats?.rating || 0) -
        (a.merchantStats?.rating || 0),
    );

    const result = filtered.slice(0, parseInt(String(limit)));

    res.json({
      merchants: result,
      total: result.length,
      filters: {
        minLevel,
        minRating,
        type,
        token,
      },
    });
  } catch (error) {
    console.error("[P2P Merchants] Error getting merchant orders:", error);
    res.status(500).json({ error: "Failed to get merchant orders" });
  }
};
