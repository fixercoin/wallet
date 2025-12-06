import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2POffersTable } from "@/components/P2POffersTable";
import { P2PTradeDialog, type TradeDetails } from "@/components/P2PTradeDialog";
import { createOrderFromOffer } from "@/lib/p2p-order-creation";
import type { P2POrder } from "@/components/P2POffersTable";

export default function SellData() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTradeDialog, setShowTradeDialog] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<P2POrder | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchRate = async () => {
      setFetchingRate(true);
      try {
        const response = await fetch("/api/token/price?token=USDC");
        if (!response.ok) throw new Error("Failed to fetch rate");
        const data = await response.json();
        const rate = data.rate || data.priceInPKR || 280;
        setExchangeRate(typeof rate === "number" && rate > 0 ? rate : 280);
      } catch (error) {
        console.error("Exchange rate error:", error);
        setExchangeRate(280);
      } finally {
        setFetchingRate(false);
      }
    };

    fetchRate();
  }, []);

  // Auto-refresh data every 10 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 10000);

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

      {/* Available Offers */}
      <P2POffersTable
        key={refreshKey}
        orderType="SELL"
        exchangeRate={exchangeRate}
        onSelectOffer={(offer) => {
          setSelectedOffer(offer);
          setShowTradeDialog(true);
        }}
      />

      {/* Trade Dialog */}
      <P2PTradeDialog
        open={showTradeDialog}
        onOpenChange={setShowTradeDialog}
        orderType="SELL"
        defaultToken={selectedOffer?.token || "USDC"}
        defaultPrice={selectedOffer?.pricePKRPerQuote || exchangeRate}
        minAmount={
          selectedOffer?.minAmountTokens || selectedOffer?.minAmountPKR || 0
        }
        maxAmount={
          selectedOffer?.maxAmountTokens ||
          selectedOffer?.maxAmountPKR ||
          Infinity
        }
        onConfirm={async (details) => {
          try {
            if (!wallet?.publicKey || !selectedOffer) {
              toast.error("Missing information");
              return;
            }

            const createdOrder = await createOrderFromOffer(
              selectedOffer,
              wallet.publicKey,
              "SELL",
              details,
            );

            toast.success("Order created successfully!");
            navigate("/order-complete", { state: { order: createdOrder } });
          } catch (error) {
            console.error("Error creating order:", error);
            toast.error("Failed to create order");
          }
        }}
      />

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
          navigate("/sell-now");
        }}
      />
    </div>
  );
}
