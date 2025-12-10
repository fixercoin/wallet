import React, { useState, useEffect } from "react";
import { Copy, Check, Loader } from "lucide-react";
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
  const {
    activeDialog,
    buyerWalletAddress,
    currentOrder,
    setActiveDialog,
    openCryptoReceivedDialog,
  } = useP2POrderFlow();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [buyerOrder, setBuyerOrder] = useState<P2POrder | null>(null);
  const [loadingBuyerOrder, setLoadingBuyerOrder] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const isOpen = activeDialog === "crypto_sent_confirmation";

  // Fetch buyer order details when dialog opens
  useEffect(() => {
    if (isOpen && currentOrder && currentOrder.matchedWith) {
      setLoadingBuyerOrder(true);
      fetch(`/api/p2p/orders/${currentOrder.matchedWith}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch buyer order");
          return res.json();
        })
        .then((data) => {
          const order = data.order || data.orders?.[0];
          if (order) {
            setBuyerOrder(order);
          }
        })
        .catch((error) => {
          console.error("Error fetching buyer order:", error);
        })
        .finally(() => {
          setLoadingBuyerOrder(false);
        });
    }
  }, [isOpen, currentOrder]);

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(buyerWalletAddress);
    setCopied(true);
    toast.success("Wallet address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyBuyerAddress = () => {
    navigator.clipboard.writeText(buyerWalletAddress);
    setCopiedAddress(true);
    toast.success("Buyer wallet address copied");
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleIHaveSentCrypto = async () => {
    if (!currentOrder || !wallet) return;

    setSending(true);
    try {
      const pkrAmount =
        typeof currentOrder.pkr_amount === "number"
          ? currentOrder.pkr_amount
          : parseFloat(currentOrder.pkr_amount as any) || 0;
      const tokenAmount = parseFloat(currentOrder.token_amount) || 0;

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

      toast.success("Crypto transfer confirmed!");
      setSent(true);

      // After 2 seconds, transition to show buyer the receive confirmation dialog
      setTimeout(() => {
        openCryptoReceivedDialog(currentOrder);
        setActiveDialog("crypto_received_confirmation");
      }, 2000);
    } catch (error) {
      console.error("Error notifying buyer:", error);
      toast.error("Failed to notify buyer");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !buyerWalletAddress || !currentOrder) return null;

  // Calculate amounts with proper fallbacks
  const calculateAmount = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const tokenAmount = calculateAmount(currentOrder.token_amount);
  const pkrAmount = calculateAmount(currentOrder.pkr_amount);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && setActiveDialog(null)}
    >
      <DialogContent className="w-full max-w-sm bg-[#1a2847] border border-gray-300/30">
        <DialogHeader>
          <DialogTitle className="text-white uppercase">
            Send Crypto to Buyer
          </DialogTitle>
          <DialogDescription className="text-white/70 uppercase text-xs">
            Transfer crypto to the buyer's wallet address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sent ? (
            <>
              {/* Success State */}
              <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50 text-center">
                <div className="text-sm font-semibold text-green-300 mb-2">
                  ✓ Transfer Confirmed
                </div>
                <p className="text-xs text-green-200/80">
                  The buyer has been notified that crypto is on the way.
                </p>
              </div>

              {/* Order Summary */}
              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                <div className="text-xs text-white/70 uppercase mb-3">
                  Transaction Summary
                </div>
                <div className="space-y-3 text-sm text-white">
                  <div className="flex justify-between">
                    <span>Token Sent:</span>
                    <span className="font-semibold text-green-400">
                      {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recipient:</span>
                    <span className="text-xs font-mono text-white/70 truncate">
                      {buyerWalletAddress.slice(0, 10)}...
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

              {/* Waiting for Buyer */}
              <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
                <div className="flex items-center gap-2 mb-2">
                  <Loader className="w-4 h-4 text-blue-400 animate-spin" />
                  <div className="text-xs font-semibold text-blue-300 uppercase">
                    Waiting for Buyer Confirmation
                  </div>
                </div>
                <p className="text-xs text-blue-200/80">
                  The buyer will need to confirm they received the crypto. This
                  will complete your order.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    setSent(false);
                    setActiveDialog(null);
                  }}
                  variant="outline"
                  className="flex-1 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
                >
                  Close
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Pre-Send State - Simplified */}
              {/* Seller Order Summary */}
              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                <div className="text-xs text-white/70 uppercase mb-3 font-semibold">
                  Seller Order Summary
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
                  <div className="border-t border-gray-300/20 pt-3 mt-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-white/70">Recipient:</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono text-white/90 truncate max-w-[120px]"
                          title={buyerWalletAddress}
                        >
                          {buyerWalletAddress}
                        </span>
                        <button
                          onClick={handleCopyBuyerAddress}
                          className="p-1 hover:bg-gray-700/50 rounded transition-colors flex-shrink-0"
                          title="Copy wallet address"
                        >
                          {copiedAddress ? (
                            <Check className="w-3 h-3 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-white/70 hover:text-white" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buyer Order Details */}
              {loadingBuyerOrder ? (
                <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-xs text-white/70">
                    Loading buyer order details...
                  </span>
                </div>
              ) : buyerOrder ? (
                <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                  <div className="text-xs text-white/70 uppercase mb-3 font-semibold">
                    Buyer Order Details
                  </div>
                  <div className="space-y-3 text-sm text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Token:</span>
                      <span className="font-semibold">
                        {buyerOrder.token || "USDT"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Buyer Wallet:</span>
                      <span className="text-xs font-mono text-white/70 truncate max-w-[150px]" title={buyerOrder.walletAddress || ""}>
                        {buyerOrder.walletAddress?.slice(0, 10)}...
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Order Status:</span>
                      <span className={`text-xs font-semibold ${
                        buyerOrder.status === "MATCHED" ? "text-blue-400" :
                        buyerOrder.status === "completed" ? "text-green-400" :
                        "text-yellow-400"
                      }`}>
                        {buyerOrder.status}
                      </span>
                    </div>
                    {buyerOrder.payment_method && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/70">Payment Method:</span>
                        <span className="text-xs font-semibold">
                          {buyerOrder.payment_method}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

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
                  onClick={handleIHaveSentCrypto}
                  disabled={sending}
                  className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? "Notifying..." : "I Have Sent Crypto"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
