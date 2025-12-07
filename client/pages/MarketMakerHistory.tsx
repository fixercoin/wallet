import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import {
  botOrdersStorage,
  BotSession,
  BotOrder,
  TokenType,
} from "@/lib/bot-orders-storage";
import { dexscreenerAPI } from "@/lib/services/dexscreener";

const TOKEN_CONFIGS: Record<TokenType, { spread: number }> = {
  FIXERCOIN: { spread: 0.000002 },
  SOL: { spread: 2 },
};

export default function MarketMakerHistory() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<BotSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<BotSession | null>(
    null,
  );
  const [sessionPrices, setSessionPrices] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    const allSessions = botOrdersStorage.getAllSessions();
    setSessions(allSessions.sort((a, b) => b.createdAt - a.createdAt));

    // Fetch live prices for all sessions
    allSessions.forEach((session) => {
      fetchSessionPrice(session);
    });
  }, []);

  const fetchSessionPrice = async (session: BotSession) => {
    try {
      const token = await dexscreenerAPI.getTokenByMint(session.tokenMint);
      if (token && token.priceUsd) {
        const price = parseFloat(token.priceUsd);
        setSessionPrices((prev) => ({
          ...prev,
          [session.id]: price,
        }));
      }
    } catch (error) {
      console.error("Error fetching price for session:", session.id, error);
    }
  };

  const formatTokenPrice = (price: number, token: string): string => {
    if (token === "FIXERCOIN") {
      return price.toFixed(8);
    }
    return price.toFixed(2);
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(2);
  };

  const formatAmount = (amount: number, decimals: number = 2): string => {
    return amount.toFixed(decimals);
  };

  const handleSessionClick = (session: BotSession) => {
    setSelectedSession(session);
  };

  const handleOrderClick = (session: BotSession, order: BotOrder) => {
    navigate(`/market-maker/running/${session.id}`);
  };

  const handleBackFromOrders = () => {
    setSelectedSession(null);
  };

  const calculateSessionStats = (session: BotSession) => {
    const completedBuyOrders = session.buyOrders.filter(
      (o) => o.status === "completed",
    ).length;
    const completedSellOrders = session.sellOrders.filter(
      (o) => o.status === "completed",
    ).length;
    const totalProfit = session.sellOrders.reduce((acc, order) => {
      if (order.status === "completed" && order.actualSellPrice) {
        return (
          acc +
          (order.actualSellPrice - order.buyPrice) * (order.tokenAmount || 0)
        );
      }
      return acc;
    }, 0);

    return {
      completedBuyOrders,
      completedSellOrders,
      totalProfit,
      totalTransactions: completedBuyOrders + completedSellOrders,
    };
  };

  if (selectedSession) {
    const stats = calculateSessionStats(selectedSession);

    return (
      <div className="w-full md:max-w-lg mx-auto px-4 py-6 min-h-screen bg-gray-900">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackFromOrders}
            className="h-8 w-8 p-0 rounded-[2px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold text-sm text-white uppercase">
            {selectedSession.token} - Session
          </div>
        </div>

        <Card className="mb-6 bg-transparent border border-gray-700/50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Created</span>
                <span className="font-semibold text-white">
                  {new Date(selectedSession.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Status</span>
                <span
                  className={`font-semibold uppercase text-xs ${
                    selectedSession.status === "running"
                      ? "text-green-400"
                      : "text-yellow-400"
                  }`}
                >
                  {selectedSession.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Number of Makers</span>
                <span className="font-semibold text-white">
                  {selectedSession.numberOfMakers}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Order Amount</span>
                <span className="font-semibold text-white">
                  {formatAmount(selectedSession.orderAmount, 4)} SOL
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-transparent border border-gray-700/50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
                  Live Price
                </div>
                <div className="text-2xl font-bold text-green-400">
                  $
                  {sessionPrices[selectedSession.id]
                    ? formatTokenPrice(
                        sessionPrices[selectedSession.id],
                        selectedSession.token,
                      )
                    : "Loading..."}
                </div>
              </div>
              {sessionPrices[selectedSession.id] && (
                <div className="text-center border-t border-gray-700/50 pt-3">
                  <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">
                    Target Price
                  </div>
                  <div className="text-2xl font-bold text-emerald-300">
                    $
                    {formatTokenPrice(
                      sessionPrices[selectedSession.id] +
                        TOKEN_CONFIGS[selectedSession.token].spread,
                      selectedSession.token,
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Spread: $
                    {formatTokenPrice(
                      TOKEN_CONFIGS[selectedSession.token].spread,
                      selectedSession.token,
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-transparent border border-gray-700/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-2">Buy Orders</div>
                <div className="text-2xl font-bold text-blue-400">
                  {stats.completedBuyOrders}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-2">Sell Orders</div>
                <div className="text-2xl font-bold text-green-400">
                  {stats.completedSellOrders}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {stats.totalProfit !== 0 && (
          <Card className="mb-6 bg-transparent border border-gray-700/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-2">Total Profit</div>
                <div
                  className={`text-2xl font-bold ${
                    stats.totalProfit > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatAmount(stats.totalProfit, 6)} SOL
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedSession.buyOrders.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3 text-sm uppercase">
              Buy Orders ({selectedSession.buyOrders.length})
            </h3>
            <div className="space-y-2">
              {selectedSession.buyOrders.map((order) => (
                <Card
                  key={order.id}
                  className="cursor-pointer bg-transparent border-blue-500/20 hover:border-blue-500/50 transition-colors"
                  onClick={() => handleOrderClick(selectedSession, order)}
                >
                  <CardContent className="pt-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-400">
                            Order {order.id.slice(-6)}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold uppercase ${
                            order.status === "completed"
                              ? "text-green-400"
                              : "text-yellow-400"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Price</span>
                        <span className="text-white">
                          $
                          {formatTokenPrice(
                            order.buyPrice,
                            selectedSession.token,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Amount (USDC)</span>
                        <span className="text-white">
                          {formatAmount(order.solAmount, 4)}
                        </span>
                      </div>
                      {order.tokenAmount && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Tokens</span>
                          <span className="text-white">
                            {formatAmount(order.tokenAmount, 2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedSession.sellOrders.length > 0 && (
          <div>
            <h3 className="text-white font-semibold mb-3 text-sm uppercase">
              Sell Orders ({selectedSession.sellOrders.length})
            </h3>
            <div className="space-y-2">
              {selectedSession.sellOrders.map((order) => (
                <Card
                  key={order.id}
                  className="cursor-pointer bg-transparent border-green-500/20 hover:border-green-500/50 transition-colors"
                  onClick={() => handleOrderClick(selectedSession, order)}
                >
                  <CardContent className="pt-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          <span className="text-gray-400">
                            Order {order.id.slice(-6)}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold uppercase ${
                            order.status === "completed"
                              ? "text-green-400"
                              : "text-yellow-400"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Buy Price</span>
                        <span className="text-white">
                          $
                          {formatTokenPrice(
                            order.buyPrice,
                            selectedSession.token,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Sell Price</span>
                        <span className="text-white">
                          $
                          {formatTokenPrice(
                            order.actualSellPrice || order.targetSellPrice,
                            selectedSession.token,
                          )}
                        </span>
                      </div>
                      {order.tokenAmount && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Tokens</span>
                          <span className="text-white">
                            {formatAmount(order.tokenAmount, 2)}
                          </span>
                        </div>
                      )}
                      {order.solAmount && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">USDC Received</span>
                          <span className="text-white">
                            {formatAmount(order.solAmount, 4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {selectedSession.buyOrders.length === 0 &&
          selectedSession.sellOrders.length === 0 && (
            <Card className="bg-transparent border border-gray-700/50">
              <CardContent className="pt-6">
                <div className="text-center text-gray-400 text-sm">
                  No orders for this session yet
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    );
  }

  return (
    <div className="w-full md:max-w-lg mx-auto px-4 py-6 min-h-screen bg-gray-900">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="h-8 w-8 p-0 rounded-[2px]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold text-sm text-white uppercase">
          Market Maker History
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="bg-transparent border border-gray-700/50">
          <CardContent className="pt-6">
            <div className="text-center text-gray-400 text-sm py-8">
              No bot sessions yet. Start a market maker bot to see history here.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const stats = calculateSessionStats(session);
            return (
              <Card
                key={session.id}
                className="cursor-pointer bg-transparent border border-gray-700/50 hover:border-green-500/50 transition-colors"
                onClick={() => handleSessionClick(session)}
              >
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-white">
                          {session.token}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(session.createdAt).toLocaleDateString()} at{" "}
                          {new Date(session.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase px-2 py-1 rounded ${
                          session.status === "running"
                            ? "bg-green-500/20 text-green-400"
                            : session.status === "paused"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>

                    {sessionPrices[session.id] && (
                      <div className="border-t border-gray-700/50 pt-3 mt-3">
                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div className="text-center">
                            <div className="text-gray-400 mb-1">Live Price</div>
                            <div className="font-semibold text-green-400">
                              $
                              {formatTokenPrice(
                                sessionPrices[session.id],
                                session.token,
                              )}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400 mb-1">
                              Target Price
                            </div>
                            <div className="font-semibold text-emerald-300">
                              $
                              {formatTokenPrice(
                                sessionPrices[session.id] +
                                  TOKEN_CONFIGS[session.token].spread,
                                session.token,
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-xs mt-3 border-t border-gray-700 pt-3">
                      <div className="text-center">
                        <div className="text-gray-400 mb-1">Makers</div>
                        <div className="font-semibold text-white">
                          {session.numberOfMakers}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 mb-1">Buy Orders</div>
                        <div className="font-semibold text-blue-400">
                          {stats.completedBuyOrders}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400 mb-1">Sell Orders</div>
                        <div className="font-semibold text-green-400">
                          {stats.completedSellOrders}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
