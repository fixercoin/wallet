import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export default function BuyOrder() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [amountPKR, setAmountPKR] = useState<string>("");
  const [estimatedUSDC, setEstimatedUSDC] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();

  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        setLoadingRate(true);
        const response = await fetch("/api/exchange-rate?token=USDC");
        if (!response.ok) {
          throw new Error("Failed to fetch exchange rate");
        }
        const data = await response.json();
        setExchangeRate(data.priceInPKR);
      } catch (error) {
        console.error("Error fetching exchange rate:", error);
        toast.error("Failed to load exchange rate");
      } finally {
        setLoadingRate(false);
      }
    };

    fetchExchangeRate();
  }, []);

  // Calculate estimated USDC based on PKR amount
  useEffect(() => {
    if (amountPKR && exchangeRate) {
      const pkrAmount = parseFloat(amountPKR);
      if (!isNaN(pkrAmount) && pkrAmount > 0) {
        const usdcAmount = pkrAmount / exchangeRate;
        setEstimatedUSDC(usdcAmount);
      } else {
        setEstimatedUSDC(0);
      }
    } else {
      setEstimatedUSDC(0);
    }
  }, [amountPKR, exchangeRate]);

  const handleSubmitOrder = async () => {
    try {
      if (!wallet?.publicKey) {
        toast.error("Please connect your wallet first");
        return;
      }

      const pkrAmount = parseFloat(amountPKR);
      if (isNaN(pkrAmount) || pkrAmount <= 0) {
        toast.error("Please enter a valid PKR amount");
        return;
      }

      if (!exchangeRate) {
        toast.error("Exchange rate not available");
        return;
      }

      setSubmitting(true);

      const response = await fetch("/api/p2p/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "BUY",
          amountPKR: pkrAmount,
          estimatedUSDC: estimatedUSDC,
          pricePerUSDC: exchangeRate,
          walletAddress: wallet.publicKey,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit order");
      }

      toast.success("Buy order submitted successfully!");
      navigate("/");
    } catch (error) {
      console.error("Error submitting order:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit order"
      );
    } finally {
      setSubmitting(false);
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

      {/* Info Banner */}
      <div className="w-full px-4 py-4">
        <div className="p-4 rounded-lg bg-[#FF7A5C]/10 border border-[#FF7A5C]/30">
          <p
            className="text-white/80 text-center uppercase tracking-wide"
            style={{ fontSize: "11px" }}
          >
            Buy USDC with Pakistani Rupee
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 py-8">
        <Card className="bg-transparent border border-gray-300/30">
          <CardContent className="p-6 space-y-6">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-3 uppercase">
                Amount in PKR
              </label>
              <input
                type="number"
                value={amountPKR}
                onChange={(e) => setAmountPKR(e.target.value)}
                placeholder="Enter amount in PKR"
                className="w-full px-4 py-3 rounded-lg bg-[#1a2847]/50 border border-gray-300/30 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C]/50"
                disabled={loadingRate}
              />
            </div>

            {/* Estimated USDC Display */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-3 uppercase">
                Estimated USDC
              </label>
              <div className="w-full px-4 py-3 rounded-lg bg-[#1a2847]/50 border border-gray-300/30 text-white/70 flex items-center">
                <span className="text-lg font-semibold">
                  {estimatedUSDC > 0
                    ? estimatedUSDC.toFixed(6)
                    : "0.000000"}{" "}
                  USDC
                </span>
              </div>
            </div>

            {/* Exchange Rate Info */}
            {exchangeRate && (
              <div className="text-xs text-white/60 bg-[#1a2847]/30 p-3 rounded-lg">
                <p className="text-center">
                  1 USDC = {exchangeRate.toFixed(2)} PKR
                </p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmitOrder}
              disabled={submitting || loadingRate || !amountPKR || amountPKR === "0"}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white hover:shadow-lg transition-colors uppercase font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Order"}
            </Button>
          </CardContent>
        </Card>
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
