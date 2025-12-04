import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { getPaymentMethodsByWallet } from "@/lib/p2p-payment-methods";
import { ADMIN_WALLET } from "@/lib/p2p";

export default function P2PHome() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!wallet) return;
    // Load payment methods
    const methods = getPaymentMethodsByWallet(wallet.publicKey);
    setPaymentMethods(methods);
  }, [wallet]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("orders_pending");
      const arr = raw ? JSON.parse(raw) : [];
      setOrders(Array.isArray(arr) ? arr : []);
    } catch {
      setOrders([]);
    }
  }, []);

  if (!wallet) {
    return (
      <div
        className="w-full min-h-screen pb-24"
        style={{ fontSize: "10px", backgroundColor: "#0f0f0f", color: "#fff" }}
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
      style={{ fontSize: "10px", backgroundColor: "#0f0f0f", color: "#fff" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-300/20 border border-gray-300/30 text-gray-300 hover:bg-gray-300/30 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white uppercase">
              P2P TRADE
            </h1>
            <p className="text-xs text-white/60 uppercase">
              BUY OR SELL CRYPTO
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="max-w-lg mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-white uppercase mb-4">
          Active Orders
        </h2>
        <div className="space-y-3">
          {orders.length === 0 && (
            <div className="text-center text-white/70 py-8">
              No active orders yet
            </div>
          )}
          {orders.map((order) => (
            <Card
              key={order.id}
              className="bg-transparent border border-gray-300/30 hover:border-gray-300/50 transition-colors cursor-pointer"
              onClick={() =>
                navigate(`/order/${encodeURIComponent(order.id)}`)
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs opacity-80">Order Number</div>
                    <div className="font-semibold text-white truncate">
                      {order.id}
                    </div>
                    {(order.token ||
                      order.amountPKR ||
                      order.amountTokens) && (
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
                        navigate("/express/buy-trade", {
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
          // Reload payment methods
          if (wallet) {
            const methods = getPaymentMethodsByWallet(wallet.publicKey);
            setPaymentMethods(methods);
          }
          setEditingPaymentMethodId(undefined);
        }}
      />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a1a1a] to-[#1a1a1a]/95 border-t border-gray-300/30 p-4">
        <div className="max-w-7xl mx-auto grid grid-cols-4 gap-3">
          <Button
            onClick={() => navigate("/buy-crypto")}
            className="h-12 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-sm uppercase"
          >
            BUY
          </Button>
          <Button
            onClick={() => navigate("/sell-now")}
            className="h-12 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-sm uppercase"
          >
            SELL
          </Button>
          <Button
            onClick={() => {
              setEditingPaymentMethodId(undefined);
              setShowPaymentDialog(true);
            }}
            className="h-12 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-sm uppercase"
          >
            PAYMENT
          </Button>
          <Button
            onClick={() => navigate("/buy-crypto")}
            className="h-12 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-sm uppercase"
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );
}
