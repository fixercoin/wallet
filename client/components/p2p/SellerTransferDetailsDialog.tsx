import React, { useState } from "react";
import { Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useP2POrderFlow } from "@/contexts/P2POrderFlowContext";
import { P2POrderChat } from "./P2POrderChat";

export function SellerTransferDetailsDialog() {
  const { activeDialog, currentOrder, setActiveDialog, openCryptoSentDialog } =
    useP2POrderFlow();

  const isOpen = activeDialog === "seller_transfer_details";

  const [confirming, setConfirming] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const handleCompleteTransfer = async () => {
    if (!currentOrder) return;

    setConfirming(true);
    try {
      openCryptoSentDialog(currentOrder);
      setActiveDialog("crypto_sent_confirmation");
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen || !currentOrder) return null;

  const pkrAmount =
    (currentOrder.amountPKR as any) ||
    (typeof currentOrder.pkr_amount === "number"
      ? currentOrder.pkr_amount
      : parseFloat(currentOrder.pkr_amount as any) || 0);

  const tokenAmount =
    (currentOrder.amountTokens as any) ||
    parseFloat(currentOrder.token_amount as any) ||
    0;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && setActiveDialog(null)}
    >
      <DialogContent className="w-full max-w-2xl bg-[#1a2847] border border-gray-300/30 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col gap-4">
          <DialogHeader className="flex flex-row items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-white uppercase">
                Send Crypto to Buyer
              </DialogTitle>
              <DialogDescription className="text-white/70 uppercase text-xs">
                Complete the crypto transfer
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
                <span className="px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-full">
                  SELLER
                </span>
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                <div className="text-xs text-white/70 uppercase mb-3 font-semibold">
                  Order Summary
                </div>
                <div className="space-y-2 text-sm text-white">
                  <div className="flex justify-between">
                    <span className="text-white/70">Token:</span>
                    <span className="font-semibold">
                      {currentOrder.token || "USDT"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/70">Amount to Send:</span>
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

              {/* Info Message */}
              <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
                <p className="text-sm text-blue-300">
                  Click "Complete Transfer" to send {tokenAmount.toFixed(6)}{" "}
                  {currentOrder.token || "USDT"} to the buyer's wallet.
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
            </div>
          )}

          {/* Live Chat Row */}
          {currentOrder && <P2POrderChat order={currentOrder} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
