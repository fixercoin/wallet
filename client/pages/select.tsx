import React, { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE, ADMIN_WALLET } from "@/lib/p2p";
import { useToast } from "@/hooks/use-toast";
import {
  saveChatMessage,
  saveNotification,
  broadcastNotification,
  sendChatMessage,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";

type ActionType = "buyer_paid" | "seller_sent";

export default function Select() {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { toast } = useToast();
  const { wallet } = useWallet();
  const action = (location.state?.action || null) as ActionType | null;
  const payload = (location.state?.payload || null) as any;

  const derivedRoomId: string | null = useMemo(() => {
    return (payload && (payload.roomId || payload.orderId)) || null;
  }, [payload]);

  const { send } = useDurableRoom(derivedRoomId || "global", API_BASE);

  const [showConfirmation, setShowConfirmation] = useState(
    !!location.state?.confirmation,
  );

  const confirmationData = location.state?.confirmation;

  const handleConfirmPayment = async () => {
    try {
      if (!action || !payload) {
        setShowConfirmation(false);
        return;
      }
      if (!wallet?.publicKey) {
        toast({ title: "Wallet Not Connected", variant: "destructive" });
        return;
      }

      if (action === "buyer_paid") {
        const roomId = payload.roomId as string;
        const estimatedTokens = Number(payload.estimatedTokens || 0);
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId,
          senderWallet: wallet.publicKey,
          senderRole: "buyer",
          type: "buyer_paid",
          text: `Payment sent: ${payload.amountPKR} PKR via ${payload.paymentMethod}\n\nSend ${estimatedTokens.toFixed(6)} ${payload.token} to:\n${payload.buyerWallet}`,
          metadata: {
            orderId: roomId,
            token: payload.token,
            amountPKR: payload.amountPKR,
            estimatedTokens: estimatedTokens,
            paymentMethod: payload.paymentMethod,
            seller: payload.seller,
            buyerWallet: payload.buyerWallet,
          },
          timestamp: Date.now(),
        };
        saveChatMessage(message);
        sendChatMessage(send, message);
        const notification: ChatNotification = {
          type: "status_change",
          roomId,
          initiatorWallet: wallet.publicKey,
          initiatorRole: "buyer",
          message: `Payment received: ${payload.amountPKR} PKR - Waiting for verification`,
          data: { amountPKR: payload.amountPKR, token: payload.token },
          timestamp: Date.now(),
        };
        saveNotification(notification);
        broadcastNotification(send, notification);
        toast({
          title: "Payment marked",
          description: "Seller will be notified for verification",
        });
        navigate("/express/buy-trade", {
          state: {
            order: {
              id: roomId,
              type: "buy",
              token: payload.token,
              amountPKR: payload.amountPKR,
              pricePKRPerQuote: payload.pricePKRPerQuote,
              quoteAsset: payload.token,
              paymentMethod: payload.paymentMethod,
            },
            openChat: true,
            initialPhase: "awaiting_seller_verified",
          },
        });
      } else if (action === "seller_sent") {
        const roomId = payload.roomId as string;
        const message: ChatMessage = {
          id: `msg-${Date.now()}`,
          roomId,
          senderWallet: wallet.publicKey,
          senderRole: "seller",
          type: "seller_sent",
          text: `Seller sent ${Number(payload.amountTokens).toFixed(6)} ${payload.token} to ${ADMIN_WALLET}\n\nBuyer, please send ${Number(payload.amountPKR).toFixed(2)} PKR via ${payload.paymentMethod}`,
          metadata: {
            orderId: roomId,
            token: payload.token,
            amountTokens: payload.amountTokens,
            amountPKR: payload.amountPKR,
            sellerWallet: payload.sellerWallet,
            adminWallet: payload.adminWallet,
          },
          timestamp: Date.now(),
        };
        saveChatMessage(message);
        sendChatMessage(send, message);
        const notification: ChatNotification = {
          type: "status_change",
          roomId,
          initiatorWallet: wallet.publicKey,
          initiatorRole: "seller",
          message: `Transfer sent: ${Number(payload.amountTokens).toFixed(6)} ${payload.token} to ${ADMIN_WALLET}`,
          data: { amountTokens: payload.amountTokens, token: payload.token },
          timestamp: Date.now(),
        };
        saveNotification(notification);
        broadcastNotification(send, notification);
        toast({
          title: "Transfer marked sent",
          description: "Buyer will be notified",
        });
        navigate("/express/buy-trade", {
          state: {
            order: {
              id: roomId,
              type: "sell",
              token: payload.token,
              amountPKR: payload.amountPKR,
              pricePKRPerQuote: payload.pricePKRPerQuote,
              quoteAsset: payload.token,
              paymentMethod: payload.paymentMethod,
            },
            openChat: true,
            initialPhase: "awaiting_seller_verified",
          },
        });
      }
    } finally {
      setShowConfirmation(false);
    }
  };

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden flex items-center justify-center">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      {/* Back button at top-left */}
      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 backdrop-blur-sm"
          aria-label="Go back to wallet dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Appeal at top-right */}
      <div className="absolute top-4 right-4 z-30">
        <a
          href="mailto:info@fixorium.com.pk"
          className="text-sm text-white/70 hover:text-blue-300 transition-colors underline"
        >
          APPEAL
        </a>
      </div>

      <div className="w-full mx-auto px-4 sm:px-6 relative z-20 flex flex-col items-center">
        {/* Banner with image (no background color) */}
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg aspect-square rounded-2xl sm:rounded-3xl relative overflow-hidden p-0 flex items-center justify-center">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fd0658813d4084fba91e188ce3fc9ac4f%2Ff98a0c38026744178f6ea91c30482956?format=webp&width=800"
            alt="Banner"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Fixorium P2P brief card */}
        <div className="mt-0 w-full max-w-sm sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl border border-white p-4 sm:p-5">
          <h3 className="text-base sm:text-lg font-semibold uppercase">
            FIXORIUM P2P
          </h3>
          <p className="mt-1 text-sm sm:text-base text-white/80 uppercase">
            Buy and sell crypto directly with peers using secure escrow, fast
            settlement, and low fees. Choose BUY or SELL to start a trade in
            seconds.
          </p>
        </div>

        {/* Actions card under banner with only border color */}
        <div className="mt-2 w-full max-w-sm sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
            <Button
              onClick={() => navigate("/buy-now")}
              className="w-full py-2 sm:py-3 rounded-lg bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              BUY
            </Button>

            <Button
              onClick={() => navigate("/sell-now")}
              className="w-full py-2 sm:py-3 rounded-lg bg-gradient-to-br from-[#FF5A8C] to-[#FF7A5C] hover:shadow-xl hover:scale-105 transition-all duration-300 text-white font-semibold text-sm sm:text-base shadow-lg active:scale-95"
            >
              SELL
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmationData?.title}</DialogTitle>
            <DialogDescription>{confirmationData?.message}</DialogDescription>
          </DialogHeader>

          {confirmationData?.details && (
            <div className="space-y-3 text-sm py-4">
              {confirmationData.details.map((detail: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">{detail.label}</span>
                    <span className="font-semibold text-[#FF7A5C] text-right break-all max-w-xs">
                      {detail.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              className="bg-transparent border-white/30 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayment}
              className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
            >
              {confirmationData?.buttonText || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
