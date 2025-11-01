import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE } from "@/lib/p2p";
import {
  saveChatMessage,
  saveNotification,
  broadcastNotification,
  sendChatMessage,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";

interface BuyOrder {
  id: string;
  token: string;
  amountPKR: number;
  pricePKRPerQuote: number;
  paymentMethod: string;
  seller: { accountName: string; accountNumber: string };
  buyerWallet: string;
  createdAt: number;
}

const STORAGE_KEY = "buynote_order";

export default function BuyNote() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();
  const { send } = useDurableRoom("global", API_BASE);

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<BuyOrder | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOrder(JSON.parse(raw));
    } catch {}
  }, []);

  const estimatedTokens = useMemo(() => {
    if (!order) return 0;
    const { amountPKR, pricePKRPerQuote } = order;
    if (!pricePKRPerQuote || amountPKR <= 0) return 0;
    return amountPKR / pricePKRPerQuote;
  }, [order]);

  const handlePaid = async () => {
    if (!order) return;
    if (!wallet) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    navigate("/select", {
      state: {
        confirmation: {
          title: "Confirm Payment",
          message: `You are confirming that you have sent ${order.amountPKR.toLocaleString()} PKR to the seller's account. The seller will verify the payment and send you the tokens.`,
          details: [
            {
              label: "Amount Sent",
              value: `${order.amountPKR.toLocaleString()} PKR`,
            },
            {
              label: "Payment Method",
              value: order.paymentMethod,
            },
            {
              label: "You Will Receive",
              value: `${estimatedTokens.toFixed(6)} ${order.token}`,
            },
          ],
          buttonText: "Confirm",
        },
        action: "buyer_paid",
        payload: {
          roomId: order.id,
          token: order.token,
          amountPKR: order.amountPKR,
          pricePKRPerQuote: order.pricePKRPerQuote,
          paymentMethod: order.paymentMethod,
          buyerWallet: order.buyerWallet,
          seller: order.seller,
          estimatedTokens: Number(estimatedTokens.toFixed(6)),
        },
      },
    });
  };

  const goBack = () => navigate("/buy-crypto");

  if (!order) {
    return (
      <div
        className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]"
        style={{ fontSize: "10px" }}
      >
        <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center">
            <button
              onClick={goBack}
              className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
            </button>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-10">
          <Card className="bg-transparent backdrop-blur-xl rounded-md">
            <CardContent className="pt-10 pb-10 text-center">
              <div className="text-white/80">No active order found.</div>
              <Button
                onClick={goBack}
                className="mt-4 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
              >
                Go back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]"
      style={{ fontSize: "10px" }}
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <button
            onClick={goBack}
            className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
          </button>
          <div className="flex-1 text-center font-semibold">Buy Note</div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        <Card className="bg-transparent backdrop-blur-xl rounded-md">
          <CardContent className="space-y-6 pt-6">
            <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white">
              <div className="flex items-center justify-between">
                <div className="text-xs opacity-80">Order Number</div>
                <div className="font-semibold text-[#FF7A5C]">{order.id}</div>
              </div>
            </div>

            <div>
              <label className="block font-medium text-white/80 mb-3">
                Seller Details
              </label>
              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Account Name</span>
                  <span className="font-semibold text-[#FF7A5C]">
                    {order.seller.accountName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Account Number</span>
                  <span className="font-semibold text-[#FF7A5C]">
                    {order.seller.accountNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Payment Method</span>
                  <span className="font-semibold capitalize text-[#FF7A5C]">
                    {order.paymentMethod}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            <div>
              <label className="block font-medium text-white/80 mb-3">
                Order Detail
              </label>
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white">
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-80">Token</span>
                    <span className="font-semibold text-[#FF7A5C]">
                      {order.token}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white">
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-80">Amount (PKR)</span>
                    <span className="font-semibold text-[#FF7A5C]">
                      {order.amountPKR.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white">
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-80">Exchange Rate</span>
                    <span className="font-semibold text-[#FF7A5C]">
                      1 {order.token} ={" "}
                      {order.pricePKRPerQuote < 1
                        ? order.pricePKRPerQuote.toFixed(6)
                        : order.pricePKRPerQuote.toFixed(2)}{" "}
                      PKR
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white">
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-80">You Will Receive</span>
                    <span className="font-bold text-[#FF7A5C]">
                      {estimatedTokens.toFixed(6)} {order.token}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            <Button
              onClick={handlePaid}
              disabled={loading}
              className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Notifying seller...
                </>
              ) : (
                "I HAVE PAID"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
