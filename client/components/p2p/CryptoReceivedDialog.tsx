import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
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

export function CryptoReceivedDialog() {
  const { activeDialog, currentOrder, setActiveDialog, resetFlow } =
    useP2POrderFlow();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const [confirming, setConfirming] = useState(false);

  const isOpen = activeDialog === "crypto_received_confirmation";

  const handleIHaveReceived = async () => {
    if (!currentOrder || !wallet) return;

    setConfirming(true);
    try {
      // Send final notification to seller confirming crypto was received
      await createNotification(
        currentOrder.creator_wallet || "",
        "crypto_received",
        "BUY",
        currentOrder.id,
        `Order completed! Buyer has received the crypto. Transaction successful.`,
        {
          token: currentOrder.token,
          amountTokens: parseFloat(currentOrder.token_amount),
          amountPKR: currentOrder.pkr_amount,
        },
      );

      toast.success("Order completed successfully!");

      // Wait a moment for the notification to be sent
      setTimeout(() => {
        setActiveDialog(null);
        resetFlow();
      }, 500);
    } catch (error) {
      console.error("Error completing order:", error);
      toast.error("Failed to complete order");
    } finally {
      setConfirming(false);
    }
  };

  if (!currentOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveDialog(null)}>
      <DialogContent className="w-full max-w-sm bg-[#1a2847] border border-gray-300/30">
        <DialogHeader>
          <DialogTitle className="text-white uppercase flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            You Have Received Crypto
          </DialogTitle>
          <DialogDescription className="text-white/70 uppercase text-xs">
            Confirm receipt to complete the order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Success Message */}
          <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50 text-center">
            <div className="text-sm font-semibold text-green-300 mb-2">
              🎉 Order In Progress
            </div>
            <p className="text-xs text-green-200/80">
              The seller has confirmed that crypto is being transferred to your
              wallet. Check your wallet for the incoming transaction.
            </p>
          </div>

          {/* Order Summary */}
          <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
            <div className="text-xs text-white/70 uppercase mb-3">
              Order Summary
            </div>
            <div className="space-y-3 text-sm text-white">
              <div className="flex justify-between">
                <span>Token:</span>
                <span className="font-semibold">{currentOrder.token}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Received:</span>
                <span className="font-semibold text-green-400">
                  {parseFloat(currentOrder.token_amount).toFixed(6)}{" "}
                  {currentOrder.token}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Price Paid:</span>
                <span className="font-semibold">
                  {currentOrder.pkr_amount.toFixed(2)} PKR
                </span>
              </div>
            </div>
          </div>

          {/* Confirmation Instructions */}
          <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
            <div className="text-xs font-semibold text-blue-300 mb-2 uppercase">
              Next Step
            </div>
            <ol className="text-xs text-blue-200/80 space-y-2 list-decimal list-inside">
              <li>Check your wallet to confirm the crypto arrived</li>
              <li>
                If you see the {currentOrder.token} in your wallet, click
                "I Have Received" below
              </li>
              <li>The order will be completed and the seller will be notified</li>
            </ol>
          </div>

          {/* Status Indicator */}
          <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/30 border border-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-white/90">
                  Transaction Status
                </div>
                <p className="text-xs text-white/70">
                  Waiting for your confirmation
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => setActiveDialog(null)}
              variant="outline"
              className="flex-1 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
            >
              Not Yet
            </Button>
            <Button
              onClick={handleIHaveReceived}
              disabled={confirming}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? "Completing..." : "I Have Received"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
