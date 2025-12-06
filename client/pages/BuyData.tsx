import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2POffersTable } from "@/components/P2POffersTable";

interface BuyOrderData {
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
  status: string;
  createdAt?: number;
  created_at?: number;
  updatedAt?: number;
  updated_at?: number;
}

export default function BuyData() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [orders, setOrders] = useState<BuyOrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();

  useEffect(() => {
    const fetchBuyOrders = async () => {
      try {
        if (!wallet?.publicKey) {
          toast.error("Please connect your wallet first");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `/api/p2p/orders?type=BUY&wallet=${encodeURIComponent(wallet.publicKey)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch buy orders");
        }

        const data = await response.json();
        setOrders(data.orders || []);

        if (data.orders && data.orders.length > 0) {
          toast.success(`Loaded ${data.orders.length} buy order(s)`);
        } else {
          toast.info("No buy orders found");
        }
      } catch (error) {
        console.error("Error fetching buy orders:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to fetch buy orders",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchBuyOrders();
  }, [wallet?.publicKey]);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "PENDING":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "COMPLETED":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "CANCELLED":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "DISPUTED":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (!wallet) {
    return (
      <div
        className="w-full min-h-screen pb-24"
        style={{ fontSize: "10px", backgroundColor: "#1a1a1a", color: "#fff" }}
      >
        <div className="text-center pt-20 text-white/70">
          Please connect your wallet first
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen pb-32"
      style={{ fontSize: "12px", backgroundColor: "#1a1a1a", color: "#fff" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4">
        <button
          onClick={() => navigate("/buy-order")}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Info Banner */}
      <div className="w-full px-4 py-4">
        <div className="p-4 rounded-lg bg-[#FF7A5C]/10 border border-[#FF7A5C]/30">
          <p
            className="text-white/80 text-center uppercase tracking-wide"
            style={{ fontSize: "11px" }}
          >
            Your Buy Orders
          </p>
        </div>
      </div>

      {/* Available Offers */}
      <P2POffersTable
        orderType="BUY"
        exchangeRate={280}
        onSelectOffer={(order) => {
          toast.success(
            `Selected offer from ${order.walletAddress || order.creator_wallet}`,
          );
        }}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center min-h-96">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF7A5C]" />
            <p className="text-white/60">Loading buy orders...</p>
          </div>
        </div>
      )}

      {/* Orders List */}
      {!loading && (
        <div className="w-full px-4 py-4 space-y-4">
          {orders.length === 0 ? (
            <Card className="bg-transparent border border-gray-300/30">
              <CardContent className="p-6 text-center">
                <p className="text-white/60">No buy orders found</p>
                <Button
                  onClick={() => navigate("/buy-order")}
                  className="mt-4 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white"
                >
                  Create New Order
                </Button>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card
                key={order.id}
                className="bg-transparent border border-gray-300/30 hover:border-[#FF7A5C]/50 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-white text-base">
                      Order #{order.id.substring(0, 8)}...
                    </CardTitle>
                    <span
                      className={`text-xs px-3 py-1 rounded-full border ${getStatusColor(order.status)}`}
                    >
                      {order.status?.toUpperCase() || "PENDING"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/60 text-xs uppercase">
                        Amount (PKR)
                      </p>
                      <p className="text-white text-lg font-semibold">
                        {order.amountPKR?.toFixed(2) ||
                          order.pkr_amount ||
                          "N/A"}{" "}
                        PKR
                      </p>
                    </div>
                    <div>
                      <p className="text-white/60 text-xs uppercase">Price</p>
                      <p className="text-white text-lg font-semibold">
                        {order.pricePKRPerQuote?.toFixed(2) || "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#1a2847]/30 p-3 rounded-lg">
                    <p className="text-white/60 text-xs uppercase">Token</p>
                    <p className="text-white font-medium">{order.token}</p>
                  </div>

                  {order.payment_method && (
                    <div className="bg-[#1a2847]/30 p-3 rounded-lg">
                      <p className="text-white/60 text-xs uppercase">
                        Payment Method
                      </p>
                      <p className="text-white font-medium">
                        {order.payment_method}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-white/50 pt-2 border-t border-gray-700/50">
                    <p>
                      Created: {formatDate(order.createdAt || order.created_at)}
                    </p>
                    <p>
                      Updated: {formatDate(order.updatedAt || order.updated_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {orders.length > 0 && (
            <Button
              onClick={() => navigate("/buy-order")}
              className="w-full mt-4 py-3 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white hover:shadow-lg transition-colors uppercase font-semibold"
            >
              Create New Buy Order
            </Button>
          )}
        </div>
      )}

      {/* Payment Method Dialog */}
      <PaymentMethodDialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) {
            setEditingPaymentMethodId(undefined);
          }
        }}
        walletAddress={wallet?.publicKey || ""}
        paymentMethodId={editingPaymentMethodId}
        onSave={() => {
          setEditingPaymentMethodId(undefined);
        }}
      />

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {
          setEditingPaymentMethodId(undefined);
          setShowPaymentDialog(true);
        }}
        onCreateOfferClick={() => {
          navigate("/buy-crypto");
        }}
      />
    </div>
  );
}
