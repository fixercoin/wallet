import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { confirmPayment } from "@/lib/p2p-api";
import {
  notifyPaymentConfirmed,
  notifyAutoRelease,
  showP2PToast,
} from "@/lib/p2p-notifications";

interface PaymentConfirmationProps {
  roomId: string;
  walletAddress: string;
  buyerWallet: string;
  sellerWallet: string;
  buyerConfirmed?: boolean;
  sellerConfirmed?: boolean;
  onConfirmed?: (confirmed: {
    buyerConfirmed: boolean;
    sellerConfirmed: boolean;
  }) => void;
}

export function P2PPaymentConfirmation({
  roomId,
  walletAddress,
  buyerWallet,
  sellerWallet,
  buyerConfirmed = false,
  sellerConfirmed = false,
  onConfirmed,
}: PaymentConfirmationProps) {
  const [loading, setLoading] = useState(false);
  const [localBuyerConfirmed, setLocalBuyerConfirmed] =
    useState(buyerConfirmed);
  const [localSellerConfirmed, setLocalSellerConfirmed] =
    useState(sellerConfirmed);

  const isBuyer = walletAddress === buyerWallet;
  const isSeller = walletAddress === sellerWallet;
  const bothConfirmed = localBuyerConfirmed && localSellerConfirmed;

  const handleConfirmPayment = async () => {
    try {
      setLoading(true);
      const result = await confirmPayment(roomId, walletAddress);

      if (isBuyer) {
        setLocalBuyerConfirmed(true);
      } else {
        setLocalSellerConfirmed(true);
      }

      notifyPaymentConfirmed(walletAddress, isBuyer);

      if (result.autoReleased) {
        notifyAutoRelease(roomId);
      }

      onConfirmed?.({
        buyerConfirmed:
          result.room.buyerPaymentConfirmed || localBuyerConfirmed,
        sellerConfirmed:
          result.room.sellerPaymentConfirmed || localSellerConfirmed,
      });

      showP2PToast("success", "Confirmed", result.message);
    } catch (error) {
      console.error("Failed to confirm payment:", error);
      showP2PToast(
        "error",
        "Confirmation Failed",
        error instanceof Error ? error.message : "Could not confirm payment",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isBuyer && !isSeller) {
    return null;
  }

  return (
    <Card className="w-full bg-card/50 border-border/20">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/20">
            <h3 className="text-lg font-semibold text-foreground">
              Payment Confirmation
            </h3>
            {bothConfirmed && (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Both Confirmed</span>
              </div>
            )}
          </div>

          {/* Party Status */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`p-4 rounded-lg border ${
                localBuyerConfirmed
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-gray-800/30 border-border/20"
              }`}
            >
              <div className="text-sm text-gray-400 mb-2">Buyer</div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">
                  {buyerWallet.substring(0, 8)}...
                </span>
                {localBuyerConfirmed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border ${
                localSellerConfirmed
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-gray-800/30 border-border/20"
              }`}
            >
              <div className="text-sm text-gray-400 mb-2">Seller</div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">
                  {sellerWallet.substring(0, 8)}...
                </span>
                {localSellerConfirmed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-sm text-gray-300">
              {bothConfirmed
                ? "✅ Both parties have confirmed payment. The escrow will be automatically released."
                : isBuyer
                  ? "Confirm that you have sent the payment using the agreed payment method."
                  : "Confirm that you have received the payment via the agreed method."}
            </p>
          </div>

          {/* Action Button */}
          {!bothConfirmed &&
            !(
              (isBuyer && localBuyerConfirmed) ||
              (isSeller && localSellerConfirmed)
            ) && (
              <Button
                onClick={handleConfirmPayment}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {loading
                  ? "Confirming..."
                  : `Confirm ${isBuyer ? "Payment Sent" : "Payment Received"}`}
              </Button>
            )}

          {/* Already Confirmed */}
          {(isBuyer && localBuyerConfirmed) ||
          (isSeller && localSellerConfirmed) ? (
            <div className="w-full bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg py-3 px-4 text-center font-medium">
              ✓ You have confirmed{" "}
              {isBuyer ? "payment sent" : "payment received"}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
