import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { createOrderFromOffer } from "@/lib/p2p-order-creation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { P2POrder } from "@/lib/p2p-api";

interface PaymentMethod {
  id: string;
  accountName: string;
  accountNumber: string;
}

export default function BuyData() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [amountPKR, setAmountPKR] = useState("");
  const [amountTokens, setAmountTokens] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConnectingLoader, setShowConnectingLoader] = useState(false);
  const [connectionCountdown, setConnectionCountdown] = useState(10);

  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await fetch("/api/token/price?token=USDC");
        if (!response.ok) throw new Error("Failed to fetch rate");
        const data = await response.json();
        const rate = data.rate || data.priceInPKR || 280;
        setExchangeRate(typeof rate === "number" && rate > 0 ? rate : 280);
      } catch (error) {
        console.error("Exchange rate error:", error);
        setExchangeRate(280);
      }
    };

    fetchRate();
  }, []);

  // Fetch payment methods
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!wallet?.publicKey) return;
      try {
        const response = await fetch(
          `/api/p2p/payment-methods?wallet=${wallet.publicKey}`,
        );
        if (response.ok) {
          const data = await response.json();
          setPaymentMethods(data.paymentMethods || []);
        }
      } catch (error) {
        console.error("Failed to fetch payment methods:", error);
      }
    };

    fetchPaymentMethods();
  }, [wallet?.publicKey, showPaymentDialog]);

  const handlePKRChange = (value: string) => {
    setAmountPKR(value);
    if (value) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setAmountTokens((num / exchangeRate).toFixed(6));
      }
    } else {
      setAmountTokens("");
    }
  };

  const isValid = useMemo(() => {
    const tokens = parseFloat(amountTokens) || 0;
    const pkr = parseFloat(amountPKR) || 0;
    return tokens > 0 && pkr > 0;
  }, [amountTokens, amountPKR]);

  const handleSubmit = async () => {
    if (!isValid) return;

    if (!wallet?.publicKey) {
      toast.error("Missing wallet information");
      return;
    }

    // Check if user has added payment details
    if (paymentMethods.length === 0) {
      toast.error("Please add your payment details before creating an order");
      setEditingPaymentMethodId(undefined);
      setShowPaymentDialog(true);
      return;
    }

    try {
      setLoading(true);
      const createdOrder = await createOrderFromOffer(
        {
          id: `order-${Date.now()}`,
          type: "BUY",
          sellerWallet: "",
          token: "USDC",
          pricePKRPerQuote: exchangeRate,
          minAmountTokens: 0,
          maxAmountTokens: Infinity,
          minAmountPKR: 0,
          maxAmountPKR: Infinity,
        } as P2POrder,
        wallet.publicKey,
        "BUY",
        {
          token: "USDC",
          amountTokens: parseFloat(amountTokens),
          amountPKR: parseFloat(amountPKR),
          price: exchangeRate,
        },
      );

      toast.success("Order created successfully!");
      navigate("/order-complete", { state: { order: createdOrder } });
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order");
    } finally {
      setLoading(false);
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
          onClick={() => navigate("/")}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Buy Form */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-[#1a2847] border border-gray-300/30 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-white uppercase font-bold mb-1">Buy Crypto</h2>
            <p className="text-white/70 uppercase text-xs">
              Enter the amount you want to buy
            </p>
          </div>

          {/* Token Display */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Token
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              USDC
            </div>
          </div>

          {/* Price Display */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Price
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              1 USDC = {exchangeRate.toFixed(2)} PKR
            </div>
          </div>

          {/* Amount PKR Input */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Amount (PKR)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amountPKR}
              onChange={(e) => handlePKRChange(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C]/50"
            />
          </div>

          {/* Estimated USDC */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Estimated USDC
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              {amountTokens ? parseFloat(amountTokens).toFixed(6) : "0.000000"}{" "}
              USDC
            </div>
          </div>

          {/* Calculation Preview */}
          {amountTokens && amountPKR && (
            <div className="p-3 rounded-lg bg-[#1a2540]/30 border border-[#FF7A5C]/20">
              <div className="text-xs text-white/70 uppercase mb-2">
                Summary
              </div>
              <div className="text-sm text-white/90">
                {amountTokens} USDC = {parseFloat(amountPKR).toFixed(2)} PKR
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="flex-1 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Buy Now"
              )}
            </Button>
          </div>
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
