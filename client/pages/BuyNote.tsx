import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, ShoppingCart, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
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

  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<BuyOrder | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showCreateOfferDialog, setShowCreateOfferDialog] = useState(false);
  const [offerPassword, setOfferPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const OFFER_PASSWORD = "######Pakistan";

  const handleOfferAction = (action: "buy" | "sell") => {
    if (offerPassword !== OFFER_PASSWORD) {
      setPasswordError("Invalid password");
      return;
    }
    setShowCreateOfferDialog(false);
    setOfferPassword("");
    setPasswordError("");
    navigate(action === "buy" ? "/buy-crypto" : "/sell-now");
  };

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

      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        <Card className="bg-transparent backdrop-blur-xl rounded-md border border-[#FF7A5C]/30">
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center justify-between px-4">
              <div className="text-xs opacity-80">Order Number</div>
              <div className="font-semibold text-[#FF7A5C]">{order.id}</div>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            <div className="px-4">
              <label className="block font-medium text-white/80 mb-3">
                Seller Details
              </label>
              <div className="space-y-2">
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

            <div className="px-4">
              <label className="block font-medium text-white/80 mb-3">
                Order Detail
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Token</span>
                  <span className="font-semibold text-[#FF7A5C]">
                    {order.token}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Amount (PKR)</span>
                  <span className="font-semibold text-[#FF7A5C]">
                    {order.amountPKR.toLocaleString()}
                  </span>
                </div>
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
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">You Will Receive</span>
                  <span className="font-bold text-[#FF7A5C]">
                    {estimatedTokens.toFixed(6)} {order.token}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            <div className="px-4 pb-4 space-y-3">
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

              <Button
                onClick={goBack}
                variant="outline"
                className="w-full h-12 rounded-lg font-semibold transition-all duration-200 border border-[#FF7A5C]/50 text-[#FF7A5C] hover:bg-[#FF7A5C]/10"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Dialog */}
      <PaymentMethodDialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) {
            setEditingPaymentMethodId(undefined);
          }
        }}
        walletAddress={wallet?.publicKey || ""}
        paymentMethodId={editingPaymentMethodId}
        onSave={() => {
          setEditingPaymentMethodId(undefined);
        }}
      />

      {/* Create Offer Dialog */}
      <Dialog
        open={showCreateOfferDialog}
        onOpenChange={(open) => {
          setShowCreateOfferDialog(open);
          if (!open) {
            setOfferPassword("");
            setPasswordError("");
          }
        }}
      >
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">
              CREATE OFFER
            </DialogTitle>
            <DialogDescription className="text-white/70 uppercase">
              CHOOSE WHETHER YOU WANT TO BUY OR SELL CRYPTO
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2 uppercase">
                Password
              </label>
              <input
                type="password"
                value={offerPassword}
                onChange={(e) => {
                  setOfferPassword(e.target.value);
                  setPasswordError("");
                }}
                placeholder="Enter password"
                className="w-full px-4 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/30 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-gray-300/50"
              />
              {passwordError && (
                <p className="text-red-500 text-xs mt-1">{passwordError}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleOfferAction("buy")}
                className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-600/20 to-blue-600/10 border border-blue-500/30 hover:border-blue-500/50 text-white font-semibold rounded-lg transition-all uppercase"
              >
                <ShoppingCart className="w-8 h-8" />
                <span>BUY CRYPTO</span>
              </Button>
              <Button
                onClick={() => handleOfferAction("sell")}
                className="h-32 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-600/20 to-green-600/10 border border-green-500/30 hover:border-green-500/50 text-white font-semibold rounded-lg transition-all uppercase"
              >
                <TrendingUp className="w-8 h-8" />
                <span>SELL CRYPTO</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {
          setEditingPaymentMethodId(undefined);
          setShowPaymentDialog(true);
        }}
        onCreateOfferClick={() => setShowCreateOfferDialog(true)}
      />
    </div>
  );
}
