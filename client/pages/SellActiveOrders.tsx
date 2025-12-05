import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShoppingCart, TrendingUp } from "lucide-react";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { getOrdersByWallet, P2POrder } from "@/lib/p2p-orders";
import { getPaymentMethodsByWallet } from "@/lib/p2p-payment-methods";
import { useP2PPolling } from "@/hooks/use-p2p-polling";
import { ADMIN_WALLET } from "@/lib/p2p";

export default function SellActiveOrders() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showCreateOfferDialog, setShowCreateOfferDialog] = useState(false);
  const [offerPassword, setOfferPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const OFFER_PASSWORD = "######Pakistan";

  const handleOfferAction = (action: "buy" | "sell") => {
    if (offerPassword !== OFFER_PASSWORD) {
      setPasswordError("Invalid password");
      return;
    }
    setShowCreateOfferDialog(false);
    setOfferPassword("");
    setPasswordError("");
    navigate(action === "buy" ? "/buy-crypto" : "/sell-now");
  };

  // Use polling for real-time order updates
  useP2PPolling(
    (fetchedOrders) => {
      const sellOrders = fetchedOrders.filter((order) => order.type === "SELL");
      setOrders(sellOrders);
      setLoadingOrders(false);
    },
    {
      walletAddress: wallet?.publicKey,
      status: "PENDING",
      pollInterval: 3000,
      enabled: !!wallet?.publicKey,
    },
  );

  useEffect(() => {
    const loadData = async () => {
      if (!wallet?.publicKey) {
        setOrders([]);
        setLoadingOrders(false);
        return;
      }

      try {
        setLoadingOrders(true);

        // Fetch orders
        const fetchedOrders = await getOrdersByWallet(
          wallet.publicKey,
          "PENDING",
        );
        const sellOrders = fetchedOrders.filter(
          (order) => order.type === "SELL",
        );
        setOrders(sellOrders);

        // Fetch payment methods from Cloudflare KV
        const paymentMethods = await getPaymentMethodsByWallet(
          wallet.publicKey,
        );

        // Use the first payment method if available
        if (paymentMethods.length > 0) {
          setEditingPaymentMethodId(paymentMethods[0].id);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadData();
  }, [wallet?.publicKey]);

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
      style={{ fontSize: "10px", backgroundColor: "#1a1a1a", color: "#fff" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4">
        <button
          onClick={() => navigate("/p2p")}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="space-y-3">
          {loadingOrders && (
            <div className="text-center text-white/70 py-8">
              Loading orders...
            </div>
          )}
          {!loadingOrders && orders.length === 0 && (
            <div className="text-center text-white/70 py-8">
              No active sell orders yet
            </div>
          )}
          {orders.map((order) => (
            <Card
              key={order.id}
              className="bg-transparent border border-gray-300/30 hover:border-gray-300/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/order/${encodeURIComponent(order.id)}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs opacity-80">Order Number</div>
                    <div className="font-semibold text-white truncate">
                      {order.id}
                    </div>
                    {(order.token || order.amountPKR || order.amountTokens) && (
                      <div className="text-xs text-white/70 mt-2">
                        {order.token && (
                          <span className="inline-block mr-2">
                            {order.token}
                          </span>
                        )}
                        {typeof order.amountPKR === "number" &&
                          isFinite(order.amountPKR) && (
                            <span className="inline-block mr-2">
                              {Number(order.amountPKR).toFixed(2)} PKR
                            </span>
                          )}
                        {typeof order.amountTokens === "number" &&
                          isFinite(order.amountTokens) && (
                            <span className="inline-block">
                              {Number(order.amountTokens).toFixed(6)}{" "}
                              {order.token || ""}
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (wallet?.publicKey === ADMIN_WALLET) {
                        navigate("/order-complete", {
                          state: { order, openChat: true },
                        });
                      } else {
                        navigate(`/order/${encodeURIComponent(order.id)}`);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-300/10 border border-gray-300/30 text-gray-300 text-xs hover:bg-gray-300/20 transition-colors uppercase font-semibold flex-shrink-0"
                  >
                    View
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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

      {/* Create Offer Dialog */}
      <Dialog
        open={showCreateOfferDialog}
        onOpenChange={(open) => {
          setShowCreateOfferDialog(open);
          if (!open) {
            setOfferPassword("");
            setPasswordError("");
          }
        }}
      >
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">
              CREATE OFFER
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase">
              CHOOSE WHETHER YOU WANT TO BUY OR SELL CRYPTO
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 uppercase">
                Password
              </label>
              <input
                type="password"
                value={offerPassword}
                onChange={(e) => {
                  setOfferPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Enter password"
                className="w-full px-4 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/30 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gray-300/50"
              />
              {passwordError && (
                <p className="text-red-500 text-xs mt-1">{passwordError}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleOfferAction("buy")}
                className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-500/30 hover:border-blue-500/50 text-white font-semibold rounded-lg transition-all uppercase"
              >
                <ShoppingCart className="w-8 h-8" />
                <span>BUY CRYPTO</span>
              </Button>
              <Button
                onClick={() => handleOfferAction("sell")}
                className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-600/20 to-green-600/10 border border-green-500/30 hover:border-green-500/50 text-white font-semibold rounded-lg transition-all uppercase"
              >
                <TrendingUp className="w-8 h-8" />
                <span>SELL CRYPTO</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {
          setEditingPaymentMethodId(undefined);
          setShowPaymentDialog(true);
        }}
        onCreateOfferClick={() => setShowCreateOfferDialog(true)}
      />
    </div>
  );
}
