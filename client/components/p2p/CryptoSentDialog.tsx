import React, { useState, useEffect } from "react";
import { Check, Loader, Minus } from "lucide-react";
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
import type { P2POrder } from "@/lib/p2p-api";

export function CryptoSentDialog() {
  const { activeDialog, buyerWalletAddress, currentOrder, setActiveDialog } =
    useP2POrderFlow();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const [confirming, setConfirming] = useState(false);
  const [waitingForVerification, setWaitingForVerification] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const isOpen = activeDialog === "crypto_sent_confirmation";

  const calculateAmount = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const handleCompleteTransfer = async () => {
    if (!currentOrder || !wallet) return;

    setConfirming(true);
    try {
      const pkrAmount =
        calculateAmount(currentOrder.amountPKR) ||
        calculateAmount(currentOrder.pkr_amount);
      const tokenAmount =
        calculateAmount(currentOrder.amountTokens) ||
        calculateAmount(currentOrder.token_amount);

      // Send notification to buyer that crypto has been sent
      await createNotification(
        buyerWalletAddress,
        "transfer_initiated",
        "BUY",
        currentOrder.id,
        `Crypto transfer initiated! Your ${tokenAmount.toFixed(6)} ${currentOrder.token || "USDT"} is being sent to your wallet. Please wait for confirmation.`,
        {
          token: currentOrder.token || "USDT",
          amountTokens: tokenAmount,
          amountPKR: pkrAmount,
        },
      );

      toast.success("Crypto transfer initiated!");
      setWaitingForVerification(true);

      // Simulate waiting for buyer verification (in real app, this would be polling/websocket)
      setTimeout(() => {
        setVerificationComplete(true);
      }, 5000);
    } catch (error) {
      console.error("Error notifying buyer:", error);
      toast.error("Failed to notify buyer");
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen || !buyerWalletAddress || !currentOrder) return null;

  const tokenAmount =
    calculateAmount(currentOrder.amountTokens) ||
    calculateAmount(currentOrder.token_amount);
  const pkrAmount =
    calculateAmount(currentOrder.amountPKR) ||
    calculateAmount(currentOrder.pkr_amount);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && setActiveDialog(null)}
    >
      <DialogContent className="w-full max-w-sm bg-[#1a2847] border border-gray-300/30">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div className="flex-1">
            <DialogTitle className="text-white uppercase">
              Send Crypto to Buyer
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase text-xs">
              Complete the transfer
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
            {verificationComplete ? (
              <>
                {/* Success State */}
                <div className="flex justify-center py-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-white font-semibold uppercase">
                    Transfer Successful
                  </p>
                  <p className="text-white/70 text-sm">
                    {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"} has
                    been successfully sent to the buyer.
                  </p>
                </div>

                {/* Transaction Summary */}
                <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                  <div className="text-xs text-white/70 uppercase mb-3 font-semibold">
                    Transaction Summary
                  </div>
                  <div className="space-y-3 text-sm text-white">
                    <div className="flex justify-between">
                      <span className="text-white/70">Token:</span>
                      <span className="font-semibold">
                        {currentOrder.token || "USDT"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Amount Sent:</span>
                      <span className="font-semibold text-green-400">
                        {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Order Value:</span>
                      <span className="font-semibold">
                        {pkrAmount.toFixed(2)} PKR
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setActiveDialog(null);
                      setWaitingForVerification(false);
                      setVerificationComplete(false);
                    }}
                    className="w-full bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white"
                  >
                    Done
                  </Button>
                </div>
              </>
            ) : waitingForVerification ? (
              <>
                {/* Waiting State */}
                <div className="flex justify-center py-6">
                  <Loader className="w-10 h-10 text-[#FF7A5C] animate-spin" />
                </div>

                <div className="text-center space-y-2">
                  <p className="text-white font-semibold uppercase">
                    Waiting for Buyer Verification
                  </p>
                  <p className="text-white/70 text-sm">
                    The buyer is verifying the crypto transfer. This may take a
                    few moments...
                  </p>
                </div>

                {/* Transaction Info */}
                <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
                  <div className="space-y-2 text-sm text-blue-300">
                    <div className="flex justify-between">
                      <span>Sending:</span>
                      <span className="font-semibold">
                        {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Order Value:</span>
                      <span className="font-semibold">
                        {pkrAmount.toFixed(2)} PKR
                      </span>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <Button
                  onClick={() => setActiveDialog(null)}
                  variant="outline"
                  className="w-full border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
                >
                  Keep Dialog Open
                </Button>
              </>
            ) : (
              <>
                {/* Initial State - Order Summary */}
                <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                  <div className="text-xs text-white/70 uppercase mb-3 font-semibold">
                    Order Summary
                  </div>
                  <div className="space-y-3 text-sm text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Token:</span>
                      <span className="font-semibold">
                        {currentOrder.token || "USDT"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Amount to Send:</span>
                      <span className="font-semibold text-green-400">
                        {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Order Value:</span>
                      <span className="font-semibold">
                        {pkrAmount.toFixed(2)} PKR
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info Message */}
                <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
                  <p className="text-sm text-green-300">
                    Click "Complete Transfer" to send the crypto to the buyer's
                    wallet.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => setActiveDialog(null)}
                    variant="outline"
                    className="flex-1 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCompleteTransfer}
                    disabled={confirming}
                    className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {confirming ? "Processing..." : "Complete Transfer"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
