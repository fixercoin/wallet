import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Edit2, X } from "lucide-react";
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
  onEditOffer,
  exchangeRate = 280,
}) => {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

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
      const min =
        order.minAmountPKR !== undefined && order.minAmountPKR !== null
          ? order.minAmountPKR
          : order.amountPKR !== undefined && order.amountPKR !== null
            ? order.amountPKR
            : order.pkr_amount !== undefined && order.pkr_amount !== null
              ? order.pkr_amount
              : 0;
      const max =
        order.maxAmountPKR !== undefined && order.maxAmountPKR !== null
          ? order.maxAmountPKR
          : order.amountPKR !== undefined && order.amountPKR !== null
            ? order.amountPKR
            : order.pkr_amount !== undefined && order.pkr_amount !== null
              ? order.pkr_amount
              : 0;
      const minFormatted = typeof min === "number" ? min.toFixed(0) : min;
      const maxFormatted = typeof max === "number" ? max.toFixed(0) : max;
      return {
        min: `${minFormatted} PKR`,
        max: `${maxFormatted} PKR`,
      };
    } else {
      const min =
        order.minAmountTokens !== undefined && order.minAmountTokens !== null
          ? order.minAmountTokens
          : order.minAmountPKR !== undefined && order.minAmountPKR !== null
            ? order.minAmountPKR
            : order.amountTokens !== undefined && order.amountTokens !== null
              ? order.amountTokens
              : order.amountPKR !== undefined && order.amountPKR !== null
                ? order.amountPKR
                : 0;
      const max =
        order.maxAmountTokens !== undefined && order.maxAmountTokens !== null
          ? order.maxAmountTokens
          : order.maxAmountPKR !== undefined && order.maxAmountPKR !== null
            ? order.maxAmountPKR
            : order.amountTokens !== undefined && order.amountTokens !== null
              ? order.amountTokens
              : order.amountPKR !== undefined && order.amountPKR !== null
                ? order.amountPKR
                : 0;
      const minFormatted = typeof min === "number" ? min.toFixed(3) : min;
      const maxFormatted = typeof max === "number" ? max.toFixed(3) : max;
      return {
        min: `${minFormatted} USDC`,
        max: `${maxFormatted} USDC`,
      };
    }
  };

  const isAdvertiser = (order: P2POrder): boolean => {
    const creatorWallet = order.walletAddress || order.creator_wallet;
    const userWallet = wallet?.publicKey;
    return creatorWallet && userWallet && creatorWallet === userWallet;
  };

  const handleProceed = (order: P2POrder) => {
    if (onSelectOffer) {
      onSelectOffer(order);
    } else {
      toast.info("Selected offer: " + getCreatorName(order));
    }
  };

  const handleEdit = (order: P2POrder) => {
    if (onEditOffer) {
      onEditOffer(order);
    } else {
      navigate(`/buy-crypto?edit=${order.id}`);
    }
  };

  const handleCancel = async (order: P2POrder) => {
    try {
      setCancelling(order.id);
      const walletAddress = wallet?.publicKey;
      if (!walletAddress) {
        throw new Error("Wallet address not found");
      }

      const response = await fetch(
        `/api/p2p/orders/${encodeURIComponent(order.id)}?wallet=${encodeURIComponent(walletAddress)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to cancel offer: ${response.status}`,
        );
      }

      setOrders((prevOrders) => prevOrders.filter((o) => o.id !== order.id));
      toast.success("Offer cancelled successfully");
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to cancel offer";
      toast.error(errorMsg);
      console.error("Error cancelling offer:", err);
    } finally {
      setCancelling(null);
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
              <th className="px-4 py-3 text-center text-white/70 font-semibold"></th>
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
                  <td className="px-4 py-3 text-white/80 uppercase">
                    {getPrice(order)}
                  </td>
                  <td className="px-4 py-3 text-white/80 uppercase">
                    <span className="text-xs">
                      {orderType === "BUY"
                        ? `MIN: ${limits.min} | MAX: ${limits.max}`
                        : `${limits.min.replace(" USDC", "")} - ${limits.max}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/80 uppercase">
                    EASYPAISA
                  </td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end items-center">
                    {isAdvertiser(order) && (
                      <>
                        <Button
                          onClick={() => handleEdit(order)}
                          size="sm"
                          className="bg-transparent hover:bg-white/10 text-white text-xs py-1 px-2 rounded h-auto flex items-center transition-colors"
                          title="Edit offer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleCancel(order)}
                          disabled={cancelling === order.id}
                          size="sm"
                          className="bg-transparent hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs py-1 px-2 rounded h-auto flex items-center transition-colors"
                          title="Cancel offer"
                        >
                          {cancelling === order.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </Button>
                      </>
                    )}
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
                  <p className="text-xs text-white/60 font-semibold uppercase mb-2">
                    ADVERTISER
                  </p>
                  <p className="text-xs font-semibold text-white/90 uppercase">
                    {getCreatorName(order)}
                  </p>
                </div>

                <div className="flex flex-col">
                  <p className="text-xs text-white/60 font-semibold uppercase mb-2">
                    PRICE
                  </p>
                  <p className="text-xs font-semibold text-white/90 uppercase">
                    {getPrice(order)}
                  </p>
                </div>

                <div className="flex flex-col">
                  <p className="text-xs text-white/60 font-semibold uppercase mb-2">
                    LIMIT
                  </p>
                  <p className="text-xs font-semibold text-white/90 uppercase">
                    {orderType === "BUY"
                      ? `MIN: ${limits.min} | MAX: ${limits.max}`
                      : `${limits.min.replace(" USDC", "")} - ${limits.max}`}
                  </p>
                </div>

                <div className="flex flex-col">
                  <p className="text-xs text-white/60 font-semibold uppercase mb-2">
                    PAYMENT
                  </p>
                  <p className="text-xs font-semibold text-white/90 uppercase">
                    EASYPAISA
                  </p>
                </div>

                <div className="flex flex-row items-center justify-end h-full gap-2">
                  {isAdvertiser(order) && (
                    <>
                      <Button
                        onClick={() => handleEdit(order)}
                        size="sm"
                        className="bg-transparent hover:bg-white/10 text-white text-xs py-1 px-2 rounded h-auto flex items-center transition-colors"
                        title="Edit offer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => handleCancel(order)}
                        disabled={cancelling === order.id}
                        size="sm"
                        className="bg-transparent hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs py-1 px-2 rounded h-auto flex items-center transition-colors"
                        title="Cancel offer"
                      >
                        {cancelling === order.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
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
