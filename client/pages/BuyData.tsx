import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2POffersTable } from "@/components/P2POffersTable";
import { createOrderFromOffer } from "@/lib/p2p-order-creation";

export default function BuyData() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [refreshKey, setRefreshKey] = useState(0);

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
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => setRefreshKey((prev) => prev + 1)}
          className="text-gray-300 hover:text-gray-100 transition-colors text-xs font-semibold"
          title="Refresh offers"
        >
          REFRESH
        </button>
      </div>

      {/* Available Offers */}
      <P2POffersTable
        key={refreshKey}
        orderType="BUY"
        exchangeRate={280}
        onSelectOffer={async (offer) => {
          try {
            if (!wallet?.publicKey) {
              toast.error("Wallet not connected");
              return;
            }

            const createdOrder = await createOrderFromOffer(
              offer,
              wallet.publicKey,
              "BUY",
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
          navigate("/buy-crypto");
        }}
      />
    </div>
  );
}
