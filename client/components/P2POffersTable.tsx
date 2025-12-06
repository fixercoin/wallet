import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

  const getLimit = (order: P2POrder): string => {
    if (orderType === "BUY") {
      const min = order.amountPKR || order.pkr_amount || 0;
      const minFormatted = typeof min === "number" ? min.toFixed(0) : min;
      return `${minFormatted} PKR`;
    } else {
      const min =
        order.amountTokens || parseFloat(order.token_amount || "0") || 0;
      const minFormatted = typeof min === "number" ? min.toFixed(2) : min;
      return `${minFormatted} ${order.token || "USDC"}`;
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
        Available Offers
      </h3>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-300/30">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#1a2847]/50 border-b border-gray-300/30">
              <th className="px-4 py-3 text-left text-white/70 font-semibold">
                Advertiser
              </th>
              <th className="px-4 py-3 text-left text-white/70 font-semibold">
                Price (PKR)
              </th>
              <th className="px-4 py-3 text-left text-white/70 font-semibold">
                Limit
              </th>
              <th className="px-4 py-3 text-left text-white/70 font-semibold">
                Payment
              </th>
              <th className="px-4 py-3 text-center text-white/70 font-semibold">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-gray-300/20 hover:bg-[#1a2847]/30 transition-colors"
              >
                <td className="px-4 py-3 text-white/80">
                  {getCreatorName(order)}
                </td>
                <td className="px-4 py-3 text-white/80">{getPrice(order)}</td>
                <td className="px-4 py-3 text-white/80">{getLimit(order)}</td>
                <td className="px-4 py-3 text-white/80">
                  {order.payment_method || order.paymentMethodId || "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <Button
                    onClick={() => handleProceed(order)}
                    size="sm"
                    className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white text-xs py-1 px-3 rounded h-auto"
                  >
                    {orderType === "BUY" ? "Buy" : "Sell"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="p-4 rounded-lg bg-[#1a2847]/50 border border-gray-300/30"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-white/60 uppercase">Advertiser</p>
                <p className="text-sm font-semibold text-white/90">
                  {getCreatorName(order)}
                </p>
              </div>
              <Button
                onClick={() => handleProceed(order)}
                size="sm"
                className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white text-xs py-1 px-3 rounded h-auto"
              >
                {orderType === "BUY" ? "Buy" : "Sell"}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-white/60 uppercase">Price</p>
                <p className="text-sm font-semibold text-white/90">
                  {getPrice(order)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase">Limit</p>
                <p className="text-xs font-semibold text-white/90">
                  {getLimit(order)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase">Payment</p>
                <p className="text-xs font-semibold text-white/90">
                  {order.payment_method || order.paymentMethodId || "—"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
