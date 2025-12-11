import React, { useState } from "react";
import { Copy, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useP2POrderFlow } from "@/contexts/P2POrderFlowContext";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import { useWallet } from "@/contexts/WalletContext";

export function SellerPaymentMethodDialog() {
  const { activeDialog, sellerPaymentDetails, currentOrder, setActiveDialog } =
    useP2POrderFlow();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const isOpen = activeDialog === "seller_payment_method";

  const handleCopyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleNotifySeller = async () => {
    if (!currentOrder || !wallet) return;

    setNotifying(true);
    try {
      // Support both field name formats from server/client
      const pkrAmount =
        typeof currentOrder.amountPKR === "number"
          ? currentOrder.amountPKR
          : typeof currentOrder.pkr_amount === "number"
            ? currentOrder.pkr_amount
            : parseFloat(currentOrder.pkr_amount as any) || 0;

      const tokenAmount =
        typeof currentOrder.amountTokens === "number"
          ? currentOrder.amountTokens
          : parseFloat(currentOrder.token_amount) || 0;

      await createNotification(
        currentOrder.creator_wallet || "",
        "payment_confirmed",
        "BUY",
        currentOrder.id,
        `Buyer is ready to send payment. Please check your payment method details and confirm when payment is received.`,
        {
          token: currentOrder.token || "USDT",
          amountTokens: tokenAmount,
          amountPKR: pkrAmount,
        },
      );

      toast.success("Seller notified! Message sent to notifications.");
      setActiveDialog(null);
    } catch (error) {
      console.error("Error notifying seller:", error);
      toast.error("Failed to notify seller");
    } finally {
      setNotifying(false);
    }
  };

  if (!isOpen || !sellerPaymentDetails || !currentOrder) return null;

  // Support both field name formats from server/client
  const pkrAmount =
    typeof currentOrder.amountPKR === "number"
      ? currentOrder.amountPKR
      : typeof currentOrder.pkr_amount === "number"
        ? currentOrder.pkr_amount
        : parseFloat(currentOrder.pkr_amount as any) || 0;

  const tokenAmount =
    typeof currentOrder.amountTokens === "number"
      ? currentOrder.amountTokens
      : parseFloat(currentOrder.token_amount) || 0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && setActiveDialog(null)}
    >
      <DialogContent className="w-full max-w-sm bg-[#1a2847] border border-gray-300/30">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div className="flex-1">
            <DialogTitle className="text-white uppercase">
              Seller Payment Method
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase text-xs">
              Share your payment details with the seller
            </DialogDescription>
          </div>
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 rounded hover:bg-gray-700/50 transition-colors flex-shrink-0"
            title={minimized ? "Maximize" : "Minimize"}
          >
            <Minus className="w-5 h-5 text-white/70 hover:text-white" />
          </button>
        </DialogHeader>

        {!minimized && (
          <div className="space-y-4">
            {/* Role Badge */}
            <div className="flex justify-center mb-2">
              <span className="px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-green-600 to-green-700 rounded-full">
                BUYER
              </span>
            </div>

            {/* Order Summary */}
            <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
              <div className="text-xs text-white/70 uppercase mb-2">
                Order Summary
              </div>
              <div className="space-y-2 text-sm text-white">
                <div className="flex justify-between">
                  <span>Token:</span>
                  <span className="font-semibold">
                    {currentOrder.token || "USDT"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-semibold">
                    {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span className="font-semibold">
                    {pkrAmount.toFixed(2)} PKR
                  </span>
                </div>
              </div>
            </div>

            {/* Account Name */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/80 uppercase">
                Account Name
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
                  {sellerPaymentDetails.accountName}
                </div>
                <button
                  onClick={() =>
                    handleCopyToClipboard(
                      sellerPaymentDetails.accountName,
                      "Account Name",
                    )
                  }
                  className="p-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 hover:bg-[#1a2540]/70 transition-colors"
                  title="Copy"
                >
                  {copiedField === "Account Name" ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-white/70" />
                  )}
                </button>
              </div>
            </div>

            {/* Account Number */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/80 uppercase">
                Account Number
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold font-mono">
                  {sellerPaymentDetails.accountNumber}
                </div>
                <button
                  onClick={() =>
                    handleCopyToClipboard(
                      sellerPaymentDetails.accountNumber,
                      "Account Number",
                    )
                  }
                  className="p-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 hover:bg-[#1a2540]/70 transition-colors"
                  title="Copy"
                >
                  {copiedField === "Account Number" ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-white/70" />
                  )}
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
              <div className="text-xs font-semibold text-blue-300 mb-2 uppercase">
                Next Steps
              </div>
              <ol className="text-xs text-blue-200/80 space-y-1 list-decimal list-inside">
                <li>Send payment to the seller's account details above</li>
                <li>
                  Click "Notify Seller" to inform them you're sending payment
                </li>
                <li>Wait for seller to confirm payment receipt</li>
                <li>Once confirmed, seller will transfer your crypto</li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setActiveDialog(null)}
                variant="outline"
                className="flex-1 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleNotifySeller}
                disabled={notifying}
                className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {notifying ? "Notifying..." : "Notify Seller"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
