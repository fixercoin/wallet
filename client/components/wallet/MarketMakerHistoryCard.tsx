import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Clock, X } from "lucide-react";
import {
  botOrdersStorage,
  BotOrder,
  BotSession,
} from "@/lib/bot-orders-storage";

interface MarketMakerHistoryCardProps {
  selectedToken: string;
}

export const MarketMakerHistoryCard: React.FC<MarketMakerHistoryCardProps> = ({
  selectedToken,
}) => {
  const [session, setSession] = useState<BotSession | null>(null);
  const [allOrders, setAllOrders] = useState<BotOrder[]>([]);

  useEffect(() => {
    const updateOrders = () => {
      const currentSession = botOrdersStorage.getCurrentSession();
      setSession(currentSession);

      if (currentSession) {
        const combined = [
          ...currentSession.buyOrders,
          ...currentSession.sellOrders,
        ].sort((a, b) => b.timestamp - a.timestamp);
        setAllOrders(combined);
      }
    };

    updateOrders();

    // Auto-refresh orders every 3 seconds to show execution updates
    const refreshInterval = setInterval(updateOrders, 3000);

    return () => clearInterval(refreshInterval);
  }, [selectedToken]);

  if (!session || allOrders.length === 0) {
    return (
      <div className="bg-transparent border border-gray-700 rounded-lg p-4">
        <div className="text-center text-gray-400 text-sm py-4">
          <Clock className="h-5 w-5 mx-auto mb-2 opacity-50" />
          No order history yet
        </div>
      </div>
    );
  }

  const formatPrice = (price: number): string => {
    if (selectedToken === "FIXERCOIN") {
      return price.toFixed(8);
    }
    return price.toFixed(2);
  };

  const formatAmount = (amount: number): string => {
    return amount.toFixed(8);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded">
            COMPLETED
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded">
            PENDING
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
            FAILED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="bg-transparent border border-gray-700 rounded-lg">
      <CardContent className="pt-6 pb-4 px-6">
        <div className="space-y-4">
          <div className="font-semibold text-sm text-white uppercase px-2">
            Recent Executions
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allOrders.slice(0, 10).map((order) => (
              <div key={order.id} className="px-2 py-2 border-b border-gray-700/50 last:border-b-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    {order.type === "buy" ? (
                      <TrendingUp className="h-4 w-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-xs uppercase text-white">
                        {order.type === "buy" ? "BUY" : "SELL"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(order.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-400 text-xs mb-1">Price</div>
                    <div className="text-white font-semibold">
                      {formatPrice(order.buyPrice)}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-400 text-xs mb-1">
                      {order.type === "buy" ? "SOL Amount" : "Token Amount"}
                    </div>
                    <div className="text-white font-semibold">
                      {order.type === "buy"
                        ? formatAmount(order.solAmount)
                        : order.tokenAmount
                          ? formatAmount(order.tokenAmount)
                          : "0"}
                    </div>
                  </div>

                  {order.type === "sell" && order.actualSellPrice && (
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Sell Price</div>
                      <div className="text-white font-semibold">
                        {formatPrice(order.actualSellPrice)}
                      </div>
                    </div>
                  )}

                  {order.type === "sell" && order.solAmount && (
                    <div>
                      <div className="text-gray-400 text-xs mb-1">SOL Received</div>
                      <div className="text-white font-semibold">
                        {formatAmount(order.solAmount)}
                      </div>
                    </div>
                  )}

                  {order.signature && (
                    <div className="col-span-2">
                      <div className="text-gray-400 text-xs mb-1">Transaction</div>
                      <div className="text-white font-mono text-xs truncate">
                        {order.signature.substring(0, 16)}...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
