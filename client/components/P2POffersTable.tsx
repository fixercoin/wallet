import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";

export interface P2POrder {
  id: string;
  type: "BUY" | "SELL";
  walletAddress?: string;
  creator_wallet?: string;
  token: string;
  amountTokens?: number;
  token_amount?: string;
  amountPKR?: number;
  pkr_amount?: number;
  minAmountPKR?: number;
  maxAmountPKR?: number;
  minAmountTokens?: number;
  maxAmountTokens?: number;
  pricePKRPerQuote?: number;
  payment_method?: string;
  paymentMethodId?: string;
  status:
    | "PENDING"
    | "active"
    | "pending"
    | "completed"
    | "cancelled"
    | "disputed";
  createdAt?: number;
  created_at?: number;
}

interface P2POffersTableProps {
  orderType: "BUY" | "SELL";
  onSelectOffer?: (order: P2POrder) => void;
  onEditOffer?: (order: P2POrder) => void;
  exchangeRate?: number;
}

export const P2POffersTable: React.FC<P2POffersTableProps> = ({
  orderType,
  onSelectOffer,
  exchangeRate = 280,
}) => {
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/p2p/orders?type=${orderType}&status=active`,
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch orders: ${response.status}`);
        }

        const data = await response.json();
        const fetchedOrders = Array.isArray(data.orders) ? data.orders : data;
        setOrders(
          fetchedOrders.filter(
            (o: P2POrder) =>
              o.status === "active" ||
              o.status === "PENDING" ||
              o.status === "pending",
          ),
        );
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to load offers";
        setError(errorMsg);
        console.error("Error fetching P2P orders:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [orderType]);

  const getCreatorName = (order: P2POrder): string => {
    const wallet = order.walletAddress || order.creator_wallet || "Unknown";
    return wallet.slice(0, 8) + "..." + wallet.slice(-4);
  };

  const getPrice = (order: P2POrder): string => {
    if (order.pricePKRPerQuote) {
      return order.pricePKRPerQuote.toFixed(2);
    }
    return exchangeRate.toFixed(2);
  };

  const getLimit = (order: P2POrder): { min: string; max: string } => {
    if (orderType === "BUY") {
      const min = order.minAmountPKR || order.amountPKR || order.pkr_amount || 0;
      const max = order.maxAmountPKR || order.amountPKR || order.pkr_amount || 0;
      const minFormatted = typeof min === "number" ? min.toFixed(0) : min;
      const maxFormatted = typeof max === "number" ? max.toFixed(0) : max;
      return {
        min: `${minFormatted} PKR`,
        max: `${maxFormatted} PKR`
      };
    } else {
      const min =
        order.minAmountTokens || order.amountTokens || parseFloat(order.token_amount || "0") || 0;
      const max =
        order.maxAmountTokens || order.amountTokens || parseFloat(order.token_amount || "0") || 0;
      const minFormatted = typeof min === "number" ? min.toFixed(2) : min;
      const maxFormatted = typeof max === "number" ? max.toFixed(2) : max;
      return {
        min: minFormatted,
        max: maxFormatted
      };
    }
  };

  const handleProceed = (order: P2POrder) => {
    if (onSelectOffer) {
      onSelectOffer(order);
    } else {
      toast.info("Selected offer: " + getCreatorName(order));
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF7A5C]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-4 py-4">
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="w-full px-4 py-4">
        <div className="p-4 rounded-lg bg-gray-500/10 border border-gray-500/30 text-gray-400 text-sm text-center">
          No active offers available
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6">
      <h3 className="text-sm font-semibold text-white/90 mb-4 uppercase">
        AVAILABLE OFFERS
      </h3>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-300/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#1a2847]/50 border-b border-gray-300/30">
              <th className="px-4 py-3 text-left text-white/70 font-semibold">
                ADVERTISER
              </th>
              <th className="px-4 py-3 text-left text-white/70 font-semibold">
                PRICE
              </th>
              <th className="px-4 py-3 text-left text-white/70 font-semibold">
                LIMIT
              </th>
              <th className="px-4 py-3 text-left text-white/70 font-semibold">
                PAYMENT
              </th>
              <th className="px-4 py-3 text-center text-white/70 font-semibold">
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const limits = getLimit(order);
              return (
                <tr
                  key={order.id}
                  className="border-b border-gray-300/20 hover:bg-[#1a2847]/30 transition-colors"
                >
                  <td className="px-4 py-3 text-white/80 uppercase">
                    {getCreatorName(order)}
                  </td>
                  <td className="px-4 py-3 text-white/80 uppercase">{getPrice(order)}</td>
                  <td className="px-4 py-3 text-white/80 uppercase">
                    <span className="text-xs">MIN: {limits.min} | MAX: {limits.max}</span>
                  </td>
                  <td className="px-4 py-3 text-white/80 uppercase">EASYPAISA</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      onClick={() => handleProceed(order)}
                      size="sm"
                      className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white text-xs py-1 px-3 rounded h-auto"
                    >
                      {orderType === "BUY" ? "BUY" : "SELL"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {orders.map((order) => {
          const limits = getLimit(order);
          return (
            <div
              key={order.id}
              className="p-4 rounded-lg bg-[#1a2847]/50 border border-gray-300/30"
            >
              <div className="grid grid-cols-5 gap-3 items-start">
                <div className="flex flex-col">
                  <p className="text-xs text-white/60 font-semibold uppercase mb-2">ADVERTISER</p>
                  <p className="text-xs font-semibold text-white/90 uppercase">{getCreatorName(order)}</p>
                </div>

                <div className="flex flex-col">
                  <p className="text-xs text-white/60 font-semibold uppercase mb-2">PRICE</p>
                  <p className="text-xs font-semibold text-white/90 uppercase">{getPrice(order)}</p>
                </div>

                <div className="flex flex-col">
                  <p className="text-xs text-white/60 font-semibold uppercase mb-2">LIMIT</p>
                  <p className="text-xs font-semibold text-white/90 uppercase">MIN: {limits.min} | MAX: {limits.max}</p>
                </div>

                <div className="flex flex-col">
                  <p className="text-xs text-white/60 font-semibold uppercase mb-2">PAYMENT</p>
                  <p className="text-xs font-semibold text-white/90 uppercase">EASYPAISA</p>
                </div>

                <div className="flex flex-col items-end justify-end h-full">
                  <Button
                    onClick={() => handleProceed(order)}
                    size="sm"
                    className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white text-xs py-1 px-3 rounded h-auto uppercase font-semibold"
                  >
                    {orderType === "BUY" ? "BUY" : "SELL"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
