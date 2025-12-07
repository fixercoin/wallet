import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PTradeDialog, type TradeDetails } from "@/components/P2PTradeDialog";
import { createOrderFromOffer } from "@/lib/p2p-order-creation";
import type { P2POrder } from "@/lib/p2p-api";

export default function SellData() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showTradeDialog, setShowTradeDialog] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number>(280);

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

      {/* Trade Dialog */}
      <P2PTradeDialog
        open={showTradeDialog}
        onOpenChange={setShowTradeDialog}
        orderType="SELL"
        defaultToken="USDC"
        defaultPrice={exchangeRate}
        minAmount={0}
        maxAmount={Infinity}
        onConfirm={async (details) => {
          try {
            if (!wallet?.publicKey) {
              toast.error("Missing wallet information");
              return;
            }

            const createdOrder = await createOrderFromOffer(
              {
                id: `order-${Date.now()}`,
                type: "SELL",
                buyerWallet: "",
                token: details.token,
                pricePKRPerQuote: details.price,
                minAmountTokens: 0,
                maxAmountTokens: Infinity,
                minAmountPKR: 0,
                maxAmountPKR: Infinity,
              } as P2POrder,
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
