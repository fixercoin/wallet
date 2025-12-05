import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowLeft, ShoppingCart, TrendingUp, Copy, Check } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { cancelOrder } from "@/lib/kv-orders-sync";

export default function OrderDetail() {
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { orderId } = useParams();
  const { toast } = useToast();
  const [order, setOrder] = useState<any | null>(null);
  const [status, setStatus] = useState<"pending" | "completed" | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showCreateOfferDialog, setShowCreateOfferDialog] = useState(false);
  const [offerPassword, setOfferPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const OFFER_PASSWORD = "######Pakistan";

  const shortenAddress = (address: string, chars = 6) => {
    if (!address) return "";
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  };

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(value);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
      duration: 2000,
    });
    setTimeout(() => setCopiedValue(null), 2000);
  };

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
      const pRaw = localStorage.getItem("orders_pending");
      const cRaw = localStorage.getItem("orders_completed");
      const p = pRaw ? JSON.parse(pRaw) : [];
      const c = cRaw ? JSON.parse(cRaw) : [];
      const foundP = Array.isArray(p)
        ? p.find((o: any) => String(o.id) === String(orderId))
        : null;
      const foundC = Array.isArray(c)
        ? c.find((o: any) => String(o.id) === String(orderId))
        : null;
      if (foundC) {
        setOrder(foundC);
        setStatus("completed");
      } else if (foundP) {
        setOrder(foundP);
        setStatus("pending");
      }
    } catch {}
  }, [orderId]);

  const goBack = () => navigate(-1);

  const handleCancelOrder = async () => {
    if (!order || !wallet?.publicKey) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this order? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      await cancelOrder(order.id, wallet.publicKey);

      toast({
        title: "Order Cancelled",
        description: "The order has been successfully cancelled.",
      });

      navigate(-1);
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast({
        title: "Error",
        description: "Failed to cancel the order.",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]"
      style={{ fontSize: "10px" }}
    >
      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        {!order ? (
          <div className="text-center text-white/70">Order not found</div>
        ) : (
          <>
            <Card className="bg-transparent backdrop-blur-xl rounded-md border border-gray-300/30">
              <CardContent className="space-y-0 p-0">
                <div className="flex items-center justify-between p-4 border-b border-gray-300/20">
                  <div className="text-xs opacity-80">Order Number</div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">
                      {shortenAddress(order.id, 8)}
                    </div>
                    <button
                      onClick={() => handleCopy(order.id, "Order Number")}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Copy order number"
                    >
                      {copiedValue === order.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 border-b border-gray-300/20">
                  <div className="text-xs opacity-80">Status</div>
                  <div className="font-semibold capitalize">{status}</div>
                </div>
                {order.token && (
                  <div className="flex items-center justify-between p-4 border-b border-gray-300/20">
                    <div className="text-xs opacity-80">Token</div>
                    <div className="font-semibold">{order.token}</div>
                  </div>
                )}
                {typeof order.amountPKR !== "undefined" && (
                  <div className="flex items-center justify-between p-4 border-b border-gray-300/20">
                    <div className="text-xs opacity-80">Amount</div>
                    <div className="font-semibold">
                      {formatCurrency(Number(order.amountPKR), {
                        from: "PKR",
                        minimumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                )}
                {typeof order.amountTokens !== "undefined" && (
                  <div className="flex items-center justify-between p-4 border-b border-gray-300/20">
                    <div className="text-xs opacity-80">Amount Tokens</div>
                    <div className="font-semibold">
                      {Number(order.amountTokens).toFixed(6)} {order.token}
                    </div>
                  </div>
                )}
                {typeof order.pricePKRPerQuote !== "undefined" && (
                  <div className="flex items-center justify-between p-4 border-b border-gray-300/20">
                    <div className="text-xs opacity-80">Exchange Rate</div>
                    <div className="font-semibold">
                      1 {order.token} ={" "}
                      {formatCurrency(Number(order.pricePKRPerQuote), {
                        from: "PKR",
                        minimumFractionDigits:
                          Number(order.pricePKRPerQuote) < 1 ? 6 : 2,
                      })}
                    </div>
                  </div>
                )}
                {order.type === "SELL" ? (
                  order.buyerWallet && (
                    <div className="flex items-center justify-between p-4">
                      <div className="text-xs opacity-80">Buyer Wallet</div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold font-mono text-xs">
                          {shortenAddress(order.buyerWallet, 6)}
                        </div>
                        <button
                          onClick={() =>
                            handleCopy(order.buyerWallet, "Buyer Wallet")
                          }
                          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
                          title="Copy buyer wallet"
                        >
                          {copiedValue === order.buyerWallet ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    {order.paymentMethod && (
                      <div className="flex items-center justify-between p-4 border-b border-gray-300/20">
                        <div className="text-xs opacity-80">Payment Method</div>
                        <div className="font-semibold capitalize">
                          {order.paymentMethod}
                        </div>
                      </div>
                    )}
                    {order.paymentMethod === "easypaisa" && order.seller && (
                      <>
                        <div className="flex items-center justify-between p-4 border-b border-gray-300/20">
                          <div className="text-xs opacity-80">Account Name</div>
                          <div className="font-semibold capitalize">
                            {order.seller.accountName}
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4">
                          <div className="text-xs opacity-80">
                            Account Number
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold font-mono">
                              {order.seller.accountNumber}
                            </div>
                            <button
                              onClick={() =>
                                handleCopy(
                                  order.seller.accountNumber,
                                  "Account Number",
                                )
                              }
                              className="text-gray-400 hover:text-white transition-colors"
                              title="Copy account number"
                            >
                              {copiedValue === order.seller.accountNumber ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            <div className="mt-4 space-y-3">
              <Button
                onClick={() =>
                  navigate("/order-complete", { state: { order } })
                }
                className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl"
              >
                COMPLETE ORDER
              </Button>
              <Button
                onClick={handleCancelOrder}
                className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 text-red-400"
              >
                CANCEL ORDER
              </Button>
              <Button
                onClick={goBack}
                variant="outline"
                className="w-full h-12 rounded-lg font-semibold transition-all duration-200 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
              >
                BACK
              </Button>
            </div>
          </>
        )}
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
