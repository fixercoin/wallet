import React, { useState } from "react";
import { Loader, Minus } from "lucide-react";
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
import { P2POrderChat } from "./P2POrderChat";
import type { P2POrder } from "@/lib/p2p-api";

export function CryptoSentDialog() {
  const { activeDialog, buyerWalletAddress, currentOrder, setActiveDialog } =
    useP2POrderFlow();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const [confirming, setConfirming] = useState(false);
  const [waitingForVerification, setWaitingForVerification] = useState(false);
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
      if (!currentOrder.id) {
        throw new Error("Order ID is missing. Cannot update order status.");
      }

      const pkrAmount =
        calculateAmount(currentOrder.amountPKR) ||
        calculateAmount(currentOrder.pkr_amount);
      const tokenAmount =
        calculateAmount(currentOrder.amountTokens) ||
        calculateAmount(currentOrder.token_amount);

      let orderExists = false;
      try {
        const checkResponse = await fetch(`/api/p2p/orders/${currentOrder.id}`);
        orderExists = checkResponse.ok;
      } catch {
        orderExists = false;
      }

      if (!orderExists) {
        console.warn(
          `[CryptoSent] Order ${currentOrder.id} not found on server, attempting to sync...`,
        );
        try {
          const createResponse = await fetch("/api/p2p/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: currentOrder.id,
              type: currentOrder.type,
              walletAddress:
                currentOrder.walletAddress || currentOrder.creator_wallet,
              token: currentOrder.token,
              amountTokens: currentOrder.amountTokens,
              amountPKR: currentOrder.amountPKR,
              status: currentOrder.status || "PENDING",
              payment_method: currentOrder.payment_method,
              accountName: currentOrder.accountName,
              accountNumber: currentOrder.accountNumber,
              buyerWallet: buyerWalletAddress,
            }),
          });

          if (!createResponse.ok) {
            console.warn(
              `[CryptoSent] Failed to sync order to server: ${createResponse.status}`,
            );
          } else {
            console.log(
              `[CryptoSent] Successfully synced order ${currentOrder.id} to server`,
            );
          }
        } catch (syncError) {
          console.warn(
            `[CryptoSent] Error syncing order: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
          );
        }
      }

      const updateResponse = await fetch(
        `/api/p2p/orders/${currentOrder.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerCryptoSent: true,
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        const errorMessage =
          errorData?.error || "Failed to update order status";
        const statusCode = updateResponse.status;
        throw new Error(`${errorMessage} (Status: ${statusCode})`);
      }

      try {
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
          true,
          currentOrder,
        );
      } catch (notificationError) {
        console.warn(
          "Failed to send notification to buyer (continuing anyway):",
          notificationError,
        );
      }

      toast.success(
        "Crypto transfer initiated! Waiting for buyer confirmation...",
      );
      setWaitingForVerification(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error in crypto transfer:", error);
      toast.error(`Failed to complete transfer: ${errorMessage}`);
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
      <DialogContent className="w-full max-w-2xl bg-[#1a2847] border border-gray-300/30 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col gap-4">
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
              {/* Role Badge */}
              <div className="flex justify-center mb-2">
                <span className="px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-full">
                  SELLER
                </span>
              </div>

              {waitingForVerification ? (
                <>
                  {/* Success State - Transfer Sent */}
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border border-green-500">
                      <svg
                        className="w-8 h-8 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-semibold uppercase text-lg">
                        Crypto Sent
                      </p>
                      <p className="text-white/70 text-sm mt-1">
                        {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}{" "}
                        has been transferred to the buyer
                      </p>
                    </div>
                  </div>

                  {/* Transaction Summary */}
                  <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-green-300">
                        <span>Amount Sent:</span>
                        <span className="font-semibold">
                          {tokenAmount.toFixed(6)}{" "}
                          {currentOrder.token || "USDT"}
                        </span>
                      </div>
                      <div className="flex justify-between text-green-300">
                        <span>Order Value:</span>
                        <span className="font-semibold">
                          {pkrAmount.toFixed(2)} PKR
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Close Button */}
                  <Button
                    onClick={() => {
                      setActiveDialog(null);
                      setWaitingForVerification(false);
                    }}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                  >
                    Done
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
                          {tokenAmount.toFixed(6)}{" "}
                          {currentOrder.token || "USDT"}
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
                      Click "Complete Transfer" to send the crypto to the
                      buyer's wallet.
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

          {/* Live Chat Row */}
          {currentOrder && <P2POrderChat order={currentOrder} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
