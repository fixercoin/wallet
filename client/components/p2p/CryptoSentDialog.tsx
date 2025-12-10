import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
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

export function CryptoSentDialog() {
  const {
    activeDialog,
    buyerWalletAddress,
    currentOrder,
    setActiveDialog,
  } = useP2POrderFlow();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const isOpen = activeDialog === "crypto_sent_confirmation";

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(buyerWalletAddress);
    setCopied(true);
    toast.success("Wallet address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleIHaveSentCrypto = async () => {
    if (!currentOrder || !wallet) return;

    setSending(true);
    try {
      // Send notification to buyer that crypto has been sent
      await createNotification(
        buyerWalletAddress,
        "transfer_initiated",
        "BUY",
        currentOrder.id,
        `Crypto transfer initiated! Your ${parseFloat(currentOrder.token_amount).toFixed(6)} ${currentOrder.token} is being sent to your wallet. Please wait for confirmation.`,
        {
          token: currentOrder.token,
          amountTokens: parseFloat(currentOrder.token_amount),
          amountPKR: currentOrder.pkr_amount,
        },
      );

      toast.success("Buyer notified! Crypto transfer sent.");
      setActiveDialog(null);
    } catch (error) {
      console.error("Error notifying buyer:", error);
      toast.error("Failed to notify buyer");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !buyerWalletAddress || !currentOrder) return null;

  const pkrAmount =
    typeof currentOrder.pkr_amount === "number"
      ? currentOrder.pkr_amount
      : parseFloat(currentOrder.pkr_amount as any) || 0;
  const tokenAmount = parseFloat(currentOrder.token_amount) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setActiveDialog(null)}>
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
          {/* Order Summary */}
          <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
            <div className="text-xs text-white/70 uppercase mb-2">
              Order Summary
            </div>
            <div className="space-y-2 text-sm text-white">
              <div className="flex justify-between">
                <span>Token:</span>
                <span className="font-semibold">{currentOrder.token || "USDT"}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount to Send:</span>
                <span className="font-semibold text-green-400">
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

          {/* Buyer Wallet Address */}
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

          {/* Instructions */}
          <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
            <div className="text-xs font-semibold text-blue-300 mb-2 uppercase">
              Instructions
            </div>
            <ol className="text-xs text-blue-200/80 space-y-2 list-decimal list-inside">
              <li>Copy the wallet address above</li>
              <li>
                Go to your crypto wallet and send{" "}
                <span className="font-semibold">
                  {parseFloat(currentOrder.token_amount).toFixed(6)}{" "}
                  {currentOrder.token}
                </span>
              </li>
              <li>Paste the address and confirm the transaction</li>
              <li>Click "I Have Sent Crypto" after the transaction is complete</li>
            </ol>
          </div>

          {/* Warning */}
          <div className="p-4 rounded-lg bg-red-600/20 border border-red-500/50">
            <div className="text-xs font-semibold text-red-300 mb-1 uppercase">
              ⚠️ Important
            </div>
            <p className="text-xs text-red-200/80">
              Make sure the wallet address is correct before sending. Crypto
              transfers cannot be reversed.
            </p>
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
              onClick={handleIHaveSentCrypto}
              disabled={sending}
              className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Notifying..." : "I Have Sent Crypto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
