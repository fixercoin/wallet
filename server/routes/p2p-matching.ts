/**
 * P2P Order Matching API Routes
 * Handles finding and managing matched order pairs
 */

import { RequestHandler } from "express";
import { getKVStorage } from "../lib/kv-storage";
import {
  findMatches,
  MatchedPair,
  MatchingCriteria,
} from "../lib/p2p-matching-engine";
import { getMerchantStats } from "../lib/p2p-reputation";

const MATCHED_PAIRS_PREFIX = "p2p_matched_";

/**
 * Get matches for a specific order
 * GET /api/p2p/matches?orderId=xxx
 */
export const handleGetMatches: RequestHandler = async (req, res) => {
  try {
    const { orderId, criteria } = req.query;

    if (!orderId) {
      return res.status(400).json({ error: "orderId required" });
    }

    const kv = getKVStorage();

    // Get the order
    const orderKey = `orders:${orderId}`;
    const orderData = await kv.get(orderKey);
    if (!orderData) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = JSON.parse(orderData);

    // Get all orders (limited to active ones)
    const listResult = await kv.list();
    const keys = listResult.keys || [];
    const allOrders: any[] = [];

    for (const key of keys) {
      if (
        key.name.startsWith("orders:") &&
        !key.name.includes("wallet:") &&
        key.name !== orderKey
      ) {
        const data = await kv.get(key.name);
        if (data) {
          const o = JSON.parse(data);
          if (o.status === "PENDING" || o.status === "active") {
            allOrders.push(o);
          }
        }
      }
    }

    // Parse criteria
    let matchingCriteria: MatchingCriteria = {};
    if (criteria && typeof criteria === "string") {
      try {
        matchingCriteria = JSON.parse(criteria);
      } catch (e) {
        // Ignore invalid criteria
      }
    }

    // Find matches
    const matches = findMatches(order, allOrders, matchingCriteria);

    // Enrich matches with merchant stats
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        const sellerStats = await getMerchantStats(match.sellerWallet);
        const buyerStats = await getMerchantStats(match.buyerWallet);

        return {
          ...match,
          sellerStats: {
            rating: sellerStats?.rating || 0,
            level: sellerStats?.level || "NOVICE",
            completionRate: sellerStats?.completionRate || 0,
            totalTrades: sellerStats?.totalTrades || 0,
          },
          buyerStats: {
            rating: buyerStats?.rating || 0,
            level: buyerStats?.level || "NOVICE",
            completionRate: buyerStats?.completionRate || 0,
            totalTrades: buyerStats?.totalTrades || 0,
          },
        };
      }),
    );

    res.json({
      orderId,
      order,
      matches: enrichedMatches,
      totalMatches: enrichedMatches.length,
    });
  } catch (error) {
    console.error("[P2P Matching] Error getting matches:", error);
    res.status(500).json({ error: "Failed to get matches" });
  }
};

/**
 * Create a matched pair (initiate trade)
 * POST /api/p2p/matches
 * Body: { buyOrderId, sellOrderId }
 */
export const handleCreateMatch: RequestHandler = async (req, res) => {
  try {
    const { buyOrderId, sellOrderId } = req.body;

    if (!buyOrderId || !sellOrderId) {
      return res
        .status(400)
        .json({ error: "buyOrderId and sellOrderId required" });
    }

    const kv = getKVStorage();

    // Get both orders
    const buyOrder = await kv.get(`orders:${buyOrderId}`);
    const sellOrder = await kv.get(`orders:${sellOrderId}`);

    if (!buyOrder || !sellOrder) {
      return res.status(404).json({ error: "One or both orders not found" });
    }

    const buy = JSON.parse(buyOrder);
    const sell = JSON.parse(sellOrder);

    // Validate orders are compatible
    if (
      buy.status !== "PENDING" ||
      sell.status !== "PENDING" ||
      buy.type !== "BUY" ||
      sell.type !== "SELL" ||
      buy.token !== sell.token ||
      buy.payment_method !== sell.payment_method
    ) {
      return res.status(400).json({ error: "Orders are not compatible" });
    }

    // Create matched pair
    const matchedPair: MatchedPair = {
      id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      buyOrderId,
      sellOrderId,
      buyerWallet: buy.walletAddress,
      sellerWallet: sell.walletAddress,
      token: buy.token,
      amount: Math.min(
        buy.maxAmountPKR || buy.amountPKR,
        sell.maxAmountPKR || sell.amountPKR,
      ),
      pricePKRPerToken: (buy.pricePKRPerQuote + sell.pricePKRPerQuote) / 2,
      totalPKR: Math.min(
        buy.maxAmountPKR || buy.amountPKR,
        sell.maxAmountPKR || sell.amountPKR,
      ),
      paymentMethod: buy.payment_method,
      status: "PENDING",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save matched pair
    const matchKey = `${MATCHED_PAIRS_PREFIX}${matchedPair.id}`;
    await kv.put(matchKey, JSON.stringify(matchedPair));

    // Update orders to MATCHED status
    buy.status = "MATCHED";
    buy.matchedWith = sellOrderId;
    sell.status = "MATCHED";
    sell.matchedWith = buyOrderId;

    await kv.put(`orders:${buyOrderId}`, JSON.stringify(buy));
    await kv.put(`orders:${sellOrderId}`, JSON.stringify(sell));

    // Create trade room for communication
    const tradeRoomId = `room-${matchedPair.id}`;
    const tradeRoom = {
      id: tradeRoomId,
      matchedPairId: matchedPair.id,
      buyerWallet: matchedPair.buyerWallet,
      sellerWallet: matchedPair.sellerWallet,
      status: "ACTIVE",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await kv.put(`trade_rooms:${tradeRoomId}`, JSON.stringify(tradeRoom));

    res.json({
      matchedPair,
      tradeRoomId,
    });
  } catch (error) {
    console.error("[P2P Matching] Error creating match:", error);
    res.status(500).json({ error: "Failed to create match" });
  }
};

/**
 * Get a matched pair
 * GET /api/p2p/matches/:matchId
 */
export const handleGetMatch: RequestHandler = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({ error: "matchId required" });
    }

    const kv = getKVStorage();
    const matchKey = `${MATCHED_PAIRS_PREFIX}${matchId}`;
    const data = await kv.get(matchKey);

    if (!data) {
      return res.status(404).json({ error: "Match not found" });
    }

    const matchedPair = JSON.parse(data) as MatchedPair;

    // Enrich with merchant stats
    const sellerStats = await getMerchantStats(matchedPair.sellerWallet);
    const buyerStats = await getMerchantStats(matchedPair.buyerWallet);

    res.json({
      ...matchedPair,
      sellerStats,
      buyerStats,
    });
  } catch (error) {
    console.error("[P2P Matching] Error getting match:", error);
    res.status(500).json({ error: "Failed to get match" });
  }
};

/**
 * Update matched pair status
 * PUT /api/p2p/matches/:matchId
 * Body: { status }
 */
export const handleUpdateMatch: RequestHandler = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { status } = req.body;

    if (!matchId || !status) {
      return res.status(400).json({ error: "matchId and status required" });
    }

    const kv = getKVStorage();
    const matchKey = `${MATCHED_PAIRS_PREFIX}${matchId}`;
    const data = await kv.get(matchKey);

    if (!data) {
      return res.status(404).json({ error: "Match not found" });
    }

    const matchedPair = JSON.parse(data) as MatchedPair;
    matchedPair.status = status;
    matchedPair.updatedAt = Date.now();

    await kv.put(matchKey, JSON.stringify(matchedPair));

    res.json(matchedPair);
  } catch (error) {
    console.error("[P2P Matching] Error updating match:", error);
    res.status(500).json({ error: "Failed to update match" });
  }
};

/**
 * List all matches for a wallet
 * GET /api/p2p/matches?wallet=xxx
 */
export const handleListMatches: RequestHandler = async (req, res) => {
  try {
    const { wallet, status } = req.query;

    const kv = getKVStorage();
    const listResult = await kv.list();
    const keys = listResult.keys || [];

    const matches: MatchedPair[] = [];

    for (const key of keys) {
      if (key.name.startsWith(MATCHED_PAIRS_PREFIX)) {
        const data = await kv.get(key.name);
        if (data) {
          const match = JSON.parse(data) as MatchedPair;

          // Filter by wallet
          if (
            wallet &&
            match.buyerWallet !== wallet &&
            match.sellerWallet !== wallet
          ) {
            continue;
          }

          // Filter by status
          if (status && match.status !== status) {
            continue;
          }

          matches.push(match);
        }
      }
    }

    // Sort by newest first
    matches.sort((a, b) => b.createdAt - a.createdAt);

    res.json({
      matches,
      total: matches.length,
    });
  } catch (error) {
    console.error("[P2P Matching] Error listing matches:", error);
    res.status(500).json({ error: "Failed to list matches" });
  }
};

/**
 * Cancel a matched pair
 * DELETE /api/p2p/matches/:matchId
 */
export const handleCancelMatch: RequestHandler = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({ error: "matchId required" });
    }

    const kv = getKVStorage();
    const matchKey = `${MATCHED_PAIRS_PREFIX}${matchId}`;
    const data = await kv.get(matchKey);

    if (!data) {
      return res.status(404).json({ error: "Match not found" });
    }

    const matchedPair = JSON.parse(data) as MatchedPair;

    // Update orders back to PENDING
    const buyOrder = await kv.get(`orders:${matchedPair.buyOrderId}`);
    const sellOrder = await kv.get(`orders:${matchedPair.sellOrderId}`);

    if (buyOrder) {
      const buy = JSON.parse(buyOrder);
      buy.status = "PENDING";
      delete buy.matchedWith;
      await kv.put(`orders:${matchedPair.buyOrderId}`, JSON.stringify(buy));
    }

    if (sellOrder) {
      const sell = JSON.parse(sellOrder);
      sell.status = "PENDING";
      delete sell.matchedWith;
      await kv.put(`orders:${matchedPair.sellOrderId}`, JSON.stringify(sell));
    }

    // Delete matched pair
    await kv.delete(matchKey);

    res.json({ success: true, matchId });
  } catch (error) {
    console.error("[P2P Matching] Error cancelling match:", error);
    res.status(500).json({ error: "Failed to cancel match" });
  }
};
