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
import { getPaymentMethodsByWallet } from "@/lib/p2p-payment-methods";
import { ADMIN_WALLET } from "@/lib/p2p";

export default function BuyOrder() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [orders, setOrders] = useState<any[]>([]);
  const [stakes, setStakes] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingStakes, setLoadingStakes] = useState(true);
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
    const loadOrders = async () => {
      if (!wallet) return;
      try {
        setLoadingOrders(true);
        const response = await fetch(
          `/api/p2p/orders?type=BUY&wallet=${wallet.publicKey}`,
        );
        if (!response.ok) {
          console.error("Failed to load orders:", response.status);
          setOrders([]);
          return;
        }
        const data = await response.json();
        const orders = Array.isArray(data.orders) ? data.orders : [];
        setOrders(orders);
      } catch (error) {
        console.error("Error loading orders from API:", error);
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    };

    const loadStakes = async () => {
      if (!wallet) return;
      try {
        setLoadingStakes(true);
        const response = await fetch(
          `/api/staking/list?wallet=${wallet.publicKey}`,
        );
        if (!response.ok) {
          console.error("Failed to load stakes:", response.status);
          setStakes([]);
          return;
        }
        const data = await response.json();
        const stakes = Array.isArray(data.stakes) ? data.stakes : [];
        setStakes(stakes);
      } catch (error) {
        console.error("Error loading stakes from API:", error);
        setStakes([]);
      } finally {
        setLoadingStakes(false);
      }
    };

    const loadPaymentMethods = async () => {
      if (!wallet?.publicKey) return;
      try {
        const paymentMethods = await getPaymentMethodsByWallet(
          wallet.publicKey,
        );
        if (paymentMethods.length > 0) {
          setEditingPaymentMethodId(paymentMethods[0].id);
        }
      } catch (error) {
        console.error("Error loading payment methods:", error);
      }
    };

    loadOrders();
    loadStakes();
    loadPaymentMethods();

    const interval = setInterval(() => {
      loadOrders();
      loadStakes();
      loadPaymentMethods();
    }, 5000);
    return () => clearInterval(interval);
  }, [wallet]);

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
          onClick={() => navigate("/")}
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
            USER CAN BUY ONLY USDC COIN WITH PAKISTANI RUPEE
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 py-8">
        <div className="space-y-3">
          {loadingOrders && loadingStakes && (
            <div
              className="text-center text-white/70 py-8"
              style={{ fontSize: "12px" }}
            >
              Loading data...
            </div>
          )}
          {!loadingOrders &&
            !loadingStakes &&
            orders.length === 0 &&
            stakes.length === 0 && (
              <div
                className="text-center text-white/70 py-8"
                style={{ fontSize: "12px" }}
              >
                No buy order
              </div>
            )}
          {!loadingStakes && stakes.length > 0 && (
            <div className="mb-8">
              <h3
                className="text-white font-semibold mb-4 uppercase"
                style={{ fontSize: "12px" }}
              >
                Active Stakes ({stakes.length})
              </h3>
              <div className="space-y-3">
                {stakes.map((stake) => (
                  <Card
                    key={stake.id}
                    className="bg-transparent border border-gray-300/30 hover:border-gray-300/50 transition-colors"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div
                            className="font-semibold text-white mb-2"
                            style={{ fontSize: "12px" }}
                          >
                            <span>STAKE-{stake.id.split("_").pop()}</span>
                            <span className="text-[#FF7A5C] ml-3">
                              {Number(stake.amount || 0).toFixed(6)} SOL
                            </span>
                          </div>
                          <div
                            className="text-white/60 text-xs"
                            style={{ fontSize: "10px" }}
                          >
                            <div>Period: {stake.stakePeriodDays} days</div>
                            <div>Status: {stake.status}</div>
                            <div>
                              Reward:{" "}
                              {Number(stake.rewardAmount || 0).toFixed(6)} SOL
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {!loadingOrders && orders.length > 0 && (
            <div className="mb-4">
              <h3
                className="text-white font-semibold mb-4 uppercase"
                style={{ fontSize: "12px" }}
              >
                Buy Orders ({orders.length})
              </h3>
            </div>
          )}
          {!loadingOrders &&
            orders.map((order) => {
              const isOrderCreator = order.walletAddress === wallet?.publicKey;
              return (
                <Card
                  key={order.id}
                  className="bg-transparent border border-gray-300/30 hover:border-gray-300/50 transition-colors cursor-pointer w-full"
                  onClick={() =>
                    navigate(`/order/${encodeURIComponent(order.id)}`)
                  }
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div
                          className="font-semibold text-white"
                          style={{ fontSize: "12px" }}
                        >
                          <span>BUY-{order.id.split("-").pop()}</span>
                          <span className="text-[#FF7A5C] ml-3">
                            LIMIT {Number(order.amountPKR || 0).toFixed(2)} PKR
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {isOrderCreator && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/buy-crypto", {
                                state: { editingOrder: order },
                              });
                            }}
                            className="px-4 py-3 rounded-lg bg-blue-600/80 hover:bg-blue-700 text-white transition-colors uppercase font-semibold"
                            style={{ fontSize: "12px" }}
                          >
                            EDIT
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (wallet?.publicKey === ADMIN_WALLET) {
                              navigate("/order-complete", {
                                state: { order, openChat: true },
                              });
                            } else {
                              navigate(
                                `/order/${encodeURIComponent(order.id)}`,
                              );
                            }
                          }}
                          className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white hover:shadow-lg transition-colors uppercase font-semibold"
                          style={{ fontSize: "12px" }}
                        >
                          BUY
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
