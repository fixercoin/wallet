import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ShoppingCart, TrendingUp } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { ADMIN_WALLET } from "@/lib/p2p";

export default function BuyOrder() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [orders, setOrders] = useState<any[]>([]);
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

  useEffect(() => {
    const loadOrders = () => {
      try {
        setLoadingOrders(true);
        const pendingOrders = JSON.parse(
          localStorage.getItem("orders_pending") || "[]",
        );
        const buyOrders = pendingOrders.filter(
          (order: any) =>
            !order.type || order.type === "BUY" || order.amountPKR,
        );
        setOrders(buyOrders);
      } catch (error) {
        console.error("Error loading orders from localStorage:", error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrders();

    const interval = setInterval(loadOrders, 1000);
    return () => clearInterval(interval);
  }, []);

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
          onClick={() => navigate("/buy-crypto")}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 py-8">
        <div className="space-y-3">
          {loadingOrders && (
            <div className="text-center text-white/70 py-8" style={{ fontSize: "12px" }}>
              Loading orders...
            </div>
          )}
          {!loadingOrders && orders.length === 0 && (
            <div className="text-center text-white/70 py-8" style={{ fontSize: "12px" }}>
              No buy orders yet
            </div>
          )}
          {orders.map((order) => (
            <Card
              key={order.id}
              className="bg-transparent border border-gray-300/30 hover:border-gray-300/50 transition-colors cursor-pointer w-full"
              onClick={() => navigate(`/order/${encodeURIComponent(order.id)}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3" style={{ fontSize: "12px" }}>
                      <div className="font-semibold text-white">
                        {order.id}
                      </div>
                      <div className="font-semibold text-[#FF7A5C]">
                        {order.token} {Number(order.amountPKR).toFixed(2)} PKR
                      </div>
                    </div>
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
                    className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white hover:shadow-lg transition-colors uppercase font-semibold flex-shrink-0"
                    style={{ fontSize: "12px" }}
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
