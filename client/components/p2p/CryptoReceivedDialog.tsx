import React, { useState } from "react";
import { CheckCircle2, Minus } from "lucide-react";
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
  const [minimized, setMinimized] = useState(false);

  const handleIHaveReceived = async () => {
    if (!currentOrder || !wallet) return;

    setConfirming(true);
    try {
      // Validate order ID exists
      if (!currentOrder.id) {
        throw new Error("Order ID is missing. Cannot update order status.");
      }

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

      // Update order status to mark crypto as received
      const updateResponse = await fetch(
        `/api/p2p/orders/${currentOrder.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyerReceivedCrypto: true,
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        const errorMessage = errorData?.error || "Failed to update order status";
        const statusCode = updateResponse.status;
        throw new Error(`${errorMessage} (Status: ${statusCode})`);
      }

      // Send final notification to seller confirming crypto was received
      await createNotification(
        currentOrder.creator_wallet || "",
        "crypto_received",
        "BUY",
        currentOrder.id,
        `Order completed! Buyer has received the crypto. Transaction successful.`,
        {
          token: currentOrder.token || "USDT",
          amountTokens: tokenAmount,
          amountPKR: pkrAmount,
        },
        true,
        currentOrder,
      );

      toast.success("Order completed successfully!");

      // Wait a moment for the notification to be sent
      setTimeout(() => {
        setActiveDialog(null);
        resetFlow();
      }, 500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Error completing order:", error);
      toast.error(`Failed to complete order: ${errorMessage}`);
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen || !currentOrder) return null;

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
            <DialogTitle className="text-white uppercase flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              You Have Received Crypto
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase text-xs">
              Confirm receipt to complete the order
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
            {/* Success Message */}
            <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50 text-center">
              <div className="text-sm font-semibold text-green-300 mb-2">
                🎉 Order In Progress
              </div>
              <p className="text-xs text-green-200/80">
                The seller has confirmed that crypto is being transferred to
                your wallet. Check your wallet for the incoming transaction.
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
                  <span className="font-semibold">
                    {currentOrder.token || "USDT"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Received:</span>
                  <span className="font-semibold text-green-400">
                    {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Price Paid:</span>
                  <span className="font-semibold">
                    {pkrAmount.toFixed(2)} PKR
                  </span>
                </div>
              </div>
            </div>

            {/* Seller Details */}
            {currentOrder.creator_wallet && (
              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                <div className="text-xs text-white/70 uppercase mb-3 font-semibold">
                  Seller Details
                </div>
                <div className="space-y-3 text-sm text-white">
                  <div>
                    <p className="text-xs text-white/70 uppercase mb-1">
                      Seller Wallet
                    </p>
                    <p className="text-xs font-mono text-white/90 break-all">
                      {currentOrder.creator_wallet}
                    </p>
                  </div>
                  {currentOrder.paymentMethod && (
                    <div className="border-t border-gray-300/20 pt-3">
                      <p className="text-xs text-white/70 uppercase mb-1">
                        Payment Method
                      </p>
                      <p className="text-xs text-white/90">
                        {currentOrder.paymentMethod}
                      </p>
                    </div>
                  )}
                  {currentOrder.accountNumber && (
                    <div className="border-t border-gray-300/20 pt-3">
                      <p className="text-xs text-white/70 uppercase mb-1">
                        Account Number
                      </p>
                      <p className="text-xs font-mono text-white/90">
                        {currentOrder.accountNumber}
                      </p>
                    </div>
                  )}
                  {currentOrder.accountName && (
                    <div className="border-t border-gray-300/20 pt-3">
                      <p className="text-xs text-white/70 uppercase mb-1">
                        Account Name
                      </p>
                      <p className="text-xs text-white/90">
                        {currentOrder.accountName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Confirmation Instructions */}
            <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
              <div className="text-xs font-semibold text-blue-300 mb-2 uppercase">
                Next Step
              </div>
              <ol className="text-xs text-blue-200/80 space-y-2 list-decimal list-inside">
                <li>Check your wallet to confirm the crypto arrived</li>
                <li>
                  If you see the {currentOrder.token || "USDT"} in your wallet,
                  click "I Have Received" below
                </li>
                <li>
                  The order will be completed and the seller will be notified
                </li>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
