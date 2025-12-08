import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ShoppingCart, TrendingUp } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { ADMIN_WALLET } from "@/lib/p2p";
import { getOrdersByWallet, P2POrder } from "@/lib/p2p-orders";

export default function P2PHome() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showCreateOfferDialog, setShowCreateOfferDialog] = useState(false);
  const [offerPassword, setOfferPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

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
    const loadOrders = async () => {
      if (!wallet?.publicKey) {
        setOrders([]);
        setLoadingOrders(false);
        return;
      }

      try {
        setLoadingOrders(true);
        const fetchedOrders = await getOrdersByWallet(
          wallet.publicKey,
          "PENDING",
        );
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Error loading orders:", error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrders();
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
          onClick={() => navigate("/")}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-bold text-lg mt-2 uppercase">P2P ORDERS</h1>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {loadingOrders && (
            <div className="text-center text-white/70 py-8">
              Loading orders...
            </div>
          )}
          {!loadingOrders && orders.length === 0 && (
            <div className="text-center text-white/70 py-8">
              No active orders yet
            </div>
          )}
          {orders.map((order) => (
            <Card
              key={order.id}
              className="bg-transparent border border-gray-300/30 hover:border-[#FF7A5C]/50 transition-colors"
            >
              <CardContent className="p-6 space-y-4">
                {/* Order Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-300/20">
                  <div>
                    <div className="text-xs opacity-80 uppercase">Order Number</div>
                    <div className="font-semibold text-white text-sm mt-1 font-mono">
                      {order.id?.substring(0, 12)}...
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs opacity-80 uppercase">Order Type</div>
                    <div className="font-semibold text-white text-sm mt-1 uppercase">
                      {order.type || "BUY"}
                    </div>
                  </div>
                </div>

                {/* Order Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {order.token && (
                    <div>
                      <div className="text-xs opacity-80 uppercase">Token</div>
                      <div className="font-semibold text-white text-sm mt-1">
                        {order.token}
                      </div>
                    </div>
                  )}
                  {typeof order.amountPKR === "number" &&
                    isFinite(order.amountPKR) && (
                      <div>
                        <div className="text-xs opacity-80 uppercase">Amount PKR</div>
                        <div className="font-semibold text-white text-sm mt-1">
                          {Number(order.amountPKR).toFixed(2)} PKR
                        </div>
                      </div>
                    )}
                  {typeof order.amountTokens === "number" &&
                    isFinite(order.amountTokens) && (
                      <div>
                        <div className="text-xs opacity-80 uppercase">
                          Amount {order.token}
                        </div>
                        <div className="font-semibold text-white text-sm mt-1">
                          {Number(order.amountTokens).toFixed(6)} {order.token}
                        </div>
                      </div>
                    )}
                  {order.status && (
                    <div>
                      <div className="text-xs opacity-80 uppercase">Status</div>
                      <div className="font-semibold text-white text-sm mt-1 capitalize">
                        {order.status}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() =>
                      navigate(`/order/${encodeURIComponent(order.id)}`)
                    }
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-300/10 border border-gray-300/30 text-gray-300 text-xs hover:bg-gray-300/20 transition-colors uppercase font-semibold"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => {
                      navigate("/order-complete", {
                        state: {
                          order: {
                            id: order.id,
                            type: order.type || "BUY",
                            token: order.token,
                            amountTokens: order.amountTokens || 0,
                            amountPKR: order.amountPKR || 0,
                            buyerWallet:
                              order.buyerWallet || wallet?.publicKey,
                            sellerWallet: order.sellerWallet || ADMIN_WALLET,
                            paymentMethod: order.paymentMethodId,
                          },
                          openChat: true,
                        },
                      });
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF7A5C]/20 to-[#FF5A8C]/20 border border-[#FF7A5C]/50 text-[#FF7A5C] text-xs hover:bg-gradient-to-r hover:from-[#FF7A5C]/30 hover:to-[#FF5A8C]/30 transition-colors uppercase font-semibold"
                  >
                    Chat
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
