import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { getPaymentMethodsByWallet } from "@/lib/p2p-payment-methods";

export default function P2PHome() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | undefined>();
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  useEffect(() => {
    if (!wallet) return;
    // Load payment methods
    const methods = getPaymentMethodsByWallet(wallet.publicKey);
    setPaymentMethods(methods);
  }, [wallet]);

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
      className="w-full min-h-screen pb-24"
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

      {/* Navigation Buttons */}
      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <Button
          onClick={() => navigate("/orders/active")}
          className="w-full h-14 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-base uppercase"
        >
          <MessageSquare className="w-5 h-5 mr-2" />
          ACTIVE ORDERS
        </Button>

        <Button
          onClick={() => navigate("/buy-crypto")}
          className="w-full h-14 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-base uppercase"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          BUY CRYPTO
        </Button>

        <Button
          onClick={() => navigate("/sell-now")}
          className="w-full h-14 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-base uppercase"
        >
          <TrendingUp className="w-5 h-5 mr-2" />
          SELL CRYPTO
        </Button>

        <Button
          onClick={() => {
            setEditingPaymentMethodId(undefined);
            setShowPaymentDialog(true);
          }}
          className="w-full h-14 bg-transparent border border-gray-300/30 text-gray-300 hover:bg-gray-300/10 font-bold rounded-lg text-base uppercase"
        >
          <CreditCard className="w-5 h-5 mr-2" />
          ADD PAYMENT METHOD
        </Button>
      </div>

      {/* Saved Payment Methods */}
      {paymentMethods.length > 0 && (
        <div className="max-w-lg mx-auto px-4 py-4">
          <h3 className="text-sm font-bold text-white/80 uppercase mb-3">
            Saved Payment Methods
          </h3>
          <div className="space-y-2">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="bg-[#2a2a2a] border border-gray-300/30 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {method.userName}
                    </p>
                    <p className="text-xs text-white/60">
                      {method.paymentMethod} - {method.accountNumber}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingPaymentMethodId(method.id);
                      setShowPaymentDialog(true);
                    }}
                    size="sm"
                    className="bg-transparent border border-gray-300/30 hover:bg-gray-300/10 text-gray-300 text-xs h-auto py-1 px-2 uppercase"
                  >
                    EDIT
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
          // Reload payment methods
          if (wallet) {
            const methods = getPaymentMethodsByWallet(wallet.publicKey);
            setPaymentMethods(methods);
          }
          setEditingPaymentMethodId(undefined);
        }}
      />
    </div>
  );
}
