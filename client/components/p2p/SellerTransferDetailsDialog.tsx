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

export function SellerTransferDetailsDialog() {
  const {
    activeDialog,
    currentOrder,
    setActiveDialog,
    openCryptoSentDialog,
  } = useP2POrderFlow();

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
      <DialogContent className="w-full max-w-sm bg-[#1a2847] border border-gray-300/30">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div className="flex-1">
            <DialogTitle className="text-white uppercase">
              Send Crypto to Buyer
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase text-xs">
              Verify details and prepare transfer
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
                  <span className="text-white/70">Amount:</span>
                  <span className="font-semibold text-green-400">
                    {tokenAmount.toFixed(6)} {currentOrder.token || "USDT"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Price:</span>
                  <span className="font-semibold">
                    {pkrAmount.toFixed(2)} PKR
                  </span>
                </div>
              </div>
            </div>

            {/* Buyer Wallet Address */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/80 uppercase">
                Buyer Wallet Address
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/80 font-mono text-xs break-all">
                  {buyerWalletAddress}
                </div>
                <button
                  onClick={handleCopyBuyerWallet}
                  className="p-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 hover:bg-[#1a2540]/70 transition-colors flex-shrink-0"
                  title="Copy wallet address"
                >
                  {copiedWallet ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/70" />
                  )}
                </button>
              </div>
            </div>

            {/* Seller Balance */}
            <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/70 uppercase">
                  Your USDT Balance
                </span>
                {loadingBalance ? (
                  <Loader className="w-4 h-4 text-blue-400 animate-spin" />
                ) : (
                  <span className="font-semibold text-white">
                    {usdtBalance !== null
                      ? `${usdtBalance.toFixed(2)} USDT`
                      : "N/A"}
                  </span>
                )}
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/80 uppercase">
                Amount to Send
              </label>
              <input
                type="number"
                placeholder="Enter amount"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Wallet Address Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-white/80 uppercase">
                Recipient Wallet Address
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Paste wallet address"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white placeholder-white/40 text-sm focus:outline-none focus:border-blue-500/50 font-mono"
                />
                <button
                  onClick={handleCopyAddress}
                  className="p-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 hover:bg-[#1a2540]/70 transition-colors flex-shrink-0"
                  title="Copy address"
                >
                  {copiedAddress ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/70" />
                  )}
                </button>
              </div>
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
                onClick={handleSendCrypto}
                disabled={
                  confirming || !sendAmount.trim() || !walletAddress.trim()
                }
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirming ? "Processing..." : "I Have Sent Crypto"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
