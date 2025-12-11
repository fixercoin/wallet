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

export function BuyerWalletAddressDialog() {
  const {
    activeDialog,
    buyerWalletAddress,
    currentOrder,
    setActiveDialog,
    setSellerConfirmed,
    openCryptoSentDialog,
  } = useP2POrderFlow();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const isOpen = activeDialog === "buyer_wallet_address";

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(buyerWalletAddress);
    setCopied(true);
    toast.success("Wallet address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleIHaveReceived = async () => {
    if (!currentOrder || !wallet) return;

    setConfirming(true);
    try {
      // Update seller confirmation status
      setSellerConfirmed(true);

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

      // Send notification to buyer that payment was received
      await createNotification(
        buyerWalletAddress,
        "seller_payment_received",
        "BUY",
        currentOrder.id,
        `Payment received! I am now transferring your crypto. Please wait for the transfer to complete.`,
        {
          token: currentOrder.token || "USDT",
          amountTokens: tokenAmount,
          amountPKR: pkrAmount,
        },
      );

      toast.success("Payment confirmed! Preparing to send crypto...");
      openCryptoSentDialog(currentOrder);
    } catch (error) {
      console.error("Error confirming payment:", error);
      toast.error("Failed to confirm payment");
    } finally {
      setConfirming(false);
    }
  };

  const handleReject = async () => {
    if (!currentOrder || !wallet) return;

    setRejecting(true);
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

      // Send notification to buyer that order was rejected
      await createNotification(
        buyerWalletAddress,
        "order_rejected",
        "BUY",
        currentOrder.id,
        `Your order has been rejected. No payment required.`,
        {
          token: currentOrder.token || "USDT",
          amountTokens: tokenAmount,
          amountPKR: pkrAmount,
        },
      );

      toast.success("Order rejected and buyer notified");
      setActiveDialog(null);
    } catch (error) {
      console.error("Error rejecting order:", error);
      toast.error("Failed to reject order");
    } finally {
      setRejecting(false);
    }
  };

  if (!isOpen || !buyerWalletAddress || !currentOrder) return null;

  // Handle both CreatedOrder and P2POrder field names
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
      <DialogContent className="w-full max-w-sm bg-[#1a2847] border border-gray-300/30">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div className="flex-1">
            <DialogTitle className="text-white uppercase">
              Buyer Wallet Address
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase text-xs">
              Confirm payment received or reject the order
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

            {/* Buyer Order Summary - Simplified */}
            <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
              <div className="text-xs text-white/70 uppercase mb-3 font-semibold">
                Order Details
              </div>
              <div className="space-y-2 text-sm text-white">
                <div className="flex justify-between">
                  <span className="text-white/70">Token:</span>
                  <span className="font-semibold">
                    {currentOrder.token || "USDT"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Amount:</span>
                  <span className="font-semibold">
                    {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Price:</span>
                  <span className="font-semibold text-green-400">
                    {pkrAmount.toFixed(2)} PKR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Payment Method:</span>
                  <span className="font-semibold capitalize">
                    {currentOrder.payment_method || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* Wallet Address */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/80 uppercase">
                Buyer's Wallet Address
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-mono text-sm break-all">
                  {buyerWalletAddress}
                </div>
                <button
                  onClick={handleCopyWallet}
                  className="p-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 hover:bg-[#1a2540]/70 transition-colors flex-shrink-0"
                  title="Copy wallet address"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-white/70" />
                  )}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleReject}
                disabled={rejecting}
                variant="outline"
                className="flex-1 border border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                {rejecting ? "Rejecting..." : "Reject"}
              </Button>
              <Button
                onClick={handleIHaveReceived}
                disabled={confirming}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirming ? "Confirming..." : "I Have Received"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
