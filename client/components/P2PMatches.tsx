/**
 * P2P Matched Orders Component
 * Displays matched trading pairs with smart matching algorithm results
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";
import {
  getMatchesForWallet,
  createMatchedPair,
  MatchedOrder,
} from "@/lib/p2p-matching-api";

interface P2PMatchesProps {
  orderType?: "BUY" | "SELL";
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const P2PMatches: React.FC<P2PMatchesProps> = ({
  orderType,
  autoRefresh = true,
  refreshInterval = 5000,
}) => {
  const { wallet } = useWallet();
  const [matches, setMatches] = useState<MatchedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingMatch, setAcceptingMatch] = useState<string | null>(null);

  const loadMatches = async () => {
    if (!wallet?.publicKey) {
      setMatches([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fetchedMatches = await getMatchesForWallet(
        wallet.publicKey,
        "PENDING",
      );

      // Filter by order type if specified
      if (orderType) {
        const filtered = fetchedMatches.filter((m) => {
          if (orderType === "BUY") {
            return m.buyerWallet === wallet.publicKey;
          } else {
            return m.sellerWallet === wallet.publicKey;
          }
        });
        setMatches(filtered);
      } else {
        setMatches(fetchedMatches);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load matches";
      setError(errorMsg);
      console.error("[P2P Matches] Error loading matches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, [wallet?.publicKey]);

  // Auto-refresh matches
  useEffect(() => {
    if (!autoRefresh || !wallet?.publicKey) return;

    const interval = setInterval(loadMatches, refreshInterval);
    return () => clearInterval(interval);
  }, [wallet?.publicKey, autoRefresh, refreshInterval]);

  const handleAcceptMatch = async (match: MatchedOrder) => {
    try {
      setAcceptingMatch(match.id);

      // In a real implementation, this would create a trade room
      // For now, just update the match status
      await createMatchedPair(match.buyOrderId, match.sellOrderId);

      toast.success("Match accepted! Trade room created.");
      await loadMatches();
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to accept match";
      toast.error(errorMsg);
    } finally {
      setAcceptingMatch(null);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-green-500";
    if (rating >= 4) return "text-blue-500";
    if (rating >= 3) return "text-yellow-500";
    return "text-red-500";
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "PRO":
        return "bg-purple-900 text-purple-100";
      case "ADVANCED":
        return "bg-blue-900 text-blue-100";
      case "INTERMEDIATE":
        return "bg-cyan-900 text-cyan-100";
      default:
        return "bg-gray-700 text-gray-100";
    }
  };

  if (!wallet) {
    return (
      <Card className="w-full bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <p className="text-center text-gray-400">
            Connect your wallet to see matched orders
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="w-full bg-gray-800 border-gray-700">
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
          <span className="text-gray-300">Loading matches...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0) {
    return (
      <Card className="w-full bg-gray-800 border-gray-700">
        <CardContent className="pt-6">
          <p className="text-center text-gray-400">
            No matched orders available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const isBuyer = match.buyerWallet === wallet.publicKey;
        const otherPartyWallet = isBuyer
          ? match.sellerWallet
          : match.buyerWallet;
        const otherPartyStats = isBuyer ? match.sellerStats : match.buyerStats;

        return (
          <Card
            key={match.id}
            className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors"
          >
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="font-semibold text-white">
                        {isBuyer ? "Seller" : "Buyer"}:{" "}
                        {otherPartyWallet.slice(0, 8)}...
                      </h3>
                      <p className="text-xs text-gray-400">
                        {match.token} Trade
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`${getLevelBadgeColor(otherPartyStats?.level || "NOVICE")}`}
                  >
                    {otherPartyStats?.level || "NOVICE"}
                  </Badge>
                </div>

                {/* Trader Stats */}
                {otherPartyStats && (
                  <div className="grid grid-cols-3 gap-2 bg-gray-900 rounded p-3">
                    <div>
                      <p className="text-xs text-gray-400">Rating</p>
                      <p
                        className={`font-semibold flex items-center gap-1 ${getRatingColor(otherPartyStats.rating)}`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                        {otherPartyStats.rating.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Completion</p>
                      <p className="font-semibold text-green-400">
                        {otherPartyStats.completionRate.toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Trades</p>
                      <p className="font-semibold text-blue-400">
                        {otherPartyStats.totalTrades}
                      </p>
                    </div>
                  </div>
                )}

                {/* Trade Details */}
                <div className="grid grid-cols-2 gap-4 bg-gray-900 rounded p-3">
                  <div>
                    <p className="text-xs text-gray-400">Amount</p>
                    <p className="font-semibold text-white">
                      {match.amount.toFixed(2)} PKR
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Price</p>
                    <p className="font-semibold text-white">
                      ₨{match.pricePKRPerToken.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Payment</p>
                    <p className="font-semibold text-white">
                      {match.paymentMethod}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Status</p>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      <span className="text-sm font-semibold">
                        {match.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => handleAcceptMatch(match)}
                  disabled={acceptingMatch === match.id}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold"
                >
                  {acceptingMatch === match.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Accept Match & Create Trade Room
                    </>
                  )}
                </Button>

                {/* Match Score */}
                <div className="text-xs text-gray-500 text-center">
                  Created {new Date(match.createdAt).toLocaleDateString()} at{" "}
                  {new Date(match.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
