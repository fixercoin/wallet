import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { API_BASE, ADMIN_WALLET } from "@/lib/p2p";
import {
  saveChatMessage,
  saveNotification,
  broadcastNotification,
  sendChatMessage,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";

interface SellOrder {
  id: string;
  token: string;
  amountTokens: number;
  amountPKR: number;
  pricePKRPerQuote: number;
  paymentMethod: string;
  sellerWallet: string;
  adminWallet: string;
  createdAt: number;
}

const STORAGE_KEY = "sellnote_order";

export default function SellNote() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();
  const { send } = useDurableRoom("global", API_BASE);

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<SellOrder | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOrder(JSON.parse(raw));
    } catch {}
  }, []);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(ADMIN_WALLET);
      toast({ title: "Wallet copied" });
    } catch {}
  };

  const handleSent = async () => {
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
          title: "Confirm Transfer",
          message: `You are confirming that you have sent ${order.amountTokens.toFixed(6)} ${order.token} to the admin wallet. The buyer will be notified to complete the payment.`,
          details: [
            {
              label: "Amount Sent",
              value: `${order.amountTokens.toFixed(6)} ${order.token}`,
            },
            {
              label: "To Address",
              value: ADMIN_WALLET,
            },
            {
              label: "Buyer Receives",
              value: `${order.amountPKR.toFixed(2)} PKR`,
            },
          ],
          buttonText: "Confirm",
        },
        action: "seller_sent",
        payload: {
          roomId: order.id,
          token: order.token,
          amountTokens: order.amountTokens,
          amountPKR: order.amountPKR,
          pricePKRPerQuote: order.pricePKRPerQuote,
          paymentMethod: order.paymentMethod,
          sellerWallet: order.sellerWallet,
          adminWallet: order.adminWallet,
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
              <div className="text-white/80">No active sell order found.</div>
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

  const estimatedPKR = order.amountTokens * order.pricePKRPerQuote;

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
          <div className="flex-1 text-center font-semibold">Sell Note</div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        <Card className="bg-transparent backdrop-blur-xl rounded-md">
          <CardContent className="space-y-6 pt-6">
            <div>
              <label className="block font-medium text-white/80 mb-2">
                Send transaction to this wallet
              </label>
              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white flex items-center justify-between gap-2">
                <code className="font-mono text-xs break-all">
                  {ADMIN_WALLET}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyAddress}
                  aria-label="Copy address"
                  className="text-white"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            <div>
              <label className="block font-medium text-white/80 mb-2">
                Order Detail
              </label>
              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Order Number</span>
                  <span className="font-semibold">{order.id}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Token</span>
                  <span className="font-semibold">{order.token}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Amount Tokens</span>
                  <span className="font-semibold">
                    {order.amountTokens.toFixed(6)} {order.token}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Exchange Rate</span>
                  <span className="font-semibold">
                    1 {order.token} ={" "}
                    {order.pricePKRPerQuote < 1
                      ? order.pricePKRPerQuote.toFixed(6)
                      : order.pricePKRPerQuote.toFixed(2)}{" "}
                    PKR
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">You Will Receive</span>
                  <span className="font-semibold">
                    {estimatedPKR.toFixed(2)} PKR
                  </span>
                </div>
              </div>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            <Button
              onClick={handleSent}
              disabled={loading}
              className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Notifying buyer...
                </>
              ) : (
                "I HAVE SENT"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
