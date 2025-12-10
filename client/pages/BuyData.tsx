import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Check, Copy } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { PaymentMethodInfoCard } from "@/components/wallet/PaymentMethodInfoCard";
import { createOrderFromOffer } from "@/lib/p2p-order-creation";
import { createOrderInAPI } from "@/lib/p2p-order-api";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import QRCode from "react-qr-code";
import type { P2POrder } from "@/lib/p2p-api";

interface PaymentMethod {
  id: string;
  accountName: string;
  accountNumber: string;
}

type BuyFlowStep =
  | "form"
  | "seller_payment"
  | "waiting_confirmation"
  | "buyer_wallet"
  | "complete";

export default function BuyData() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const isCreatingOrderRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [amountPKR, setAmountPKR] = useState("");
  const [amountTokens, setAmountTokens] = useState("");
  const [loading, setLoading] = useState(false);

  // P2P Dialog Flow State
  const [flowStep, setFlowStep] = useState<BuyFlowStep>("form");
  const [currentOrder, setCurrentOrder] = useState<P2POrder | null>(null);
  const [orderStatus, setOrderStatus] = useState<{
    sellerReceivedPayment?: boolean;
    sellerCryptoSent?: boolean;
  }>({});

  // Fetch exchange rate on mount
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await fetch("/api/token/price?token=USDT");
        if (!response.ok) throw new Error("Failed to fetch rate");
        const data = await response.json();
        const rate = data.rate || data.priceInPKR || 280;
        setExchangeRate(typeof rate === "number" && rate > 0 ? rate : 280);
      } catch (error) {
        console.error("Exchange rate error:", error);
        setExchangeRate(280);
      }
    };

    fetchRate();
  }, []);

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    if (!wallet?.publicKey) return;
    try {
      const response = await fetch(
        `/api/p2p/payment-methods?wallet=${wallet.publicKey}`,
      );
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.data || data.paymentMethods || []);
      }
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
    }
  }, [wallet?.publicKey]);

  useEffect(() => {
    fetchPaymentMethods();
  }, [wallet?.publicKey, showPaymentDialog, fetchPaymentMethods]);

  // Polling for order status updates
  const startPollingOrderStatus = useCallback(
    (orderId: string) => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/p2p/orders/${encodeURIComponent(orderId)}/status`,
          );
          if (response.ok) {
            const data = await response.json();
            setOrderStatus({
              sellerReceivedPayment: data.sellerReceivedPayment,
              sellerCryptoSent: data.sellerCryptoSent,
            });

            // If seller received payment and we're in waiting state, show next dialog
            if (
              data.sellerReceivedPayment &&
              flowStep === "waiting_confirmation"
            ) {
              setFlowStep("buyer_wallet");
            }

            // If seller sent crypto, mark as complete
            if (data.sellerCryptoSent) {
              setFlowStep("complete");
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 2000); // Poll every 2 seconds
    },
    [flowStep],
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handlePKRChange = (value: string) => {
    setAmountPKR(value);
    if (value) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setAmountTokens((num / exchangeRate).toFixed(6));
      }
    } else {
      setAmountTokens("");
    }
  };

  const isFormValid = useMemo(() => {
    const tokens = parseFloat(amountTokens) || 0;
    const pkr = parseFloat(amountPKR) || 0;
    return tokens > 0 && pkr > 0;
  }, [amountTokens, amountPKR]);

  const handleStartBuy = async () => {
    if (isCreatingOrderRef.current) {
      console.warn("[BuyData] Order creation already in progress");
      return;
    }

    if (!isFormValid) return;

    if (!wallet?.publicKey) {
      toast.error("Missing wallet information");
      return;
    }

    try {
      isCreatingOrderRef.current = true;
      setLoading(true);

      const createdOrder = await createOrderFromOffer(
        {
          id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "BUY",
          sellerWallet: "",
          token: "USDT",
          pricePKRPerQuote: exchangeRate,
          minAmountTokens: 0,
          maxAmountTokens: Infinity,
          minAmountPKR: 0,
          maxAmountPKR: Infinity,
        } as P2POrder,
        wallet.publicKey,
        "BUY",
        {
          token: "USDT",
          amountTokens: parseFloat(amountTokens),
          amountPKR: parseFloat(amountPKR),
          price: exchangeRate,
        },
      );

      try {
        await createOrderInAPI(createdOrder);
        console.log(`[BuyData] Order ${createdOrder.id} persisted to server`);
      } catch (apiError) {
        console.error("[BuyData] Failed to persist order:", apiError);
        toast.error("Failed to create order - could not save to server");
        throw new Error("Order creation failed - server sync error");
      }

      setCurrentOrder(createdOrder);

      try {
        const recipientWallet =
          createdOrder.sellerWallet || "BROADCAST_SELLERS";
        await createNotification(
          recipientWallet,
          "new_buy_order",
          "BUY",
          createdOrder.id,
          `New buy order: ${parseFloat(amountTokens).toFixed(2)} USDT for ${parseFloat(amountPKR).toFixed(2)} PKR`,
          {
            token: createdOrder.token,
            amountTokens: parseFloat(amountTokens),
            amountPKR: parseFloat(amountPKR),
            orderId: createdOrder.id,
            buyerWallet: createdOrder.buyerWallet,
            price: exchangeRate,
          },
          false,
        );
      } catch (notificationError) {
        console.warn("Failed to send notification:", notificationError);
      }

      // Move to seller payment dialog
      setFlowStep("seller_payment");
      setLoading(false);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order");
      setLoading(false);
    } finally {
      isCreatingOrderRef.current = false;
    }
  };

  const handlePaymentSent = async () => {
    if (!currentOrder) return;

    try {
      // Update order status: buyer payment sent
      const response = await fetch(
        `/api/p2p/orders/${encodeURIComponent(currentOrder.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyerPaymentSent: true }),
        },
      );

      if (!response.ok) {
        const errorData = await response.text().catch(() => "");
        console.error(
          `[BuyData] Update order status failed: ${response.status} ${response.statusText}`,
          errorData,
        );
      }

      // Proceed to waiting confirmation regardless of API response
      // The order is already saved on the server
      startPollingOrderStatus(currentOrder.id);
      setFlowStep("waiting_confirmation");
      setOrderStatus({
        sellerReceivedPayment: false,
        sellerCryptoSent: false,
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      // Still proceed to waiting confirmation - the order exists
      startPollingOrderStatus(currentOrder.id);
      setFlowStep("waiting_confirmation");
      setOrderStatus({
        sellerReceivedPayment: false,
        sellerCryptoSent: false,
      });
    }
  };

  const handleCompleteTransaction = () => {
    toast.success("Transaction completed successfully!");
    // Clean up polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    // Reset flow
    setFlowStep("form");
    setCurrentOrder(null);
    setOrderStatus({});
    setAmountPKR("");
    setAmountTokens("");
    navigate("/");
  };

  const handleCancelFlow = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setFlowStep("form");
    setCurrentOrder(null);
    setOrderStatus({});
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (!wallet) {
    return (
      <div
        className="w-full min-h-screen pb-24"
        style={{ fontSize: "10px", backgroundColor: "#1a1a1a", color: "#fff" }}
      >
        <div className="text-center pt-20 text-white/70">
          Please connect your wallet first
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen pb-32"
      style={{ fontSize: "12px", backgroundColor: "#1a1a1a", color: "#fff" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4">
        <button
          onClick={() => navigate("/")}
          className="text-gray-300 hover:text-gray-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Buy Form */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-[#1a2847] border border-gray-300/30 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-white uppercase font-bold mb-1">Buy Crypto</h2>
            <p className="text-white/70 uppercase text-xs">
              Enter the amount you want to buy
            </p>
          </div>

          {/* Token Display */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Token
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              USDT
            </div>
          </div>

          {/* Price Display */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Price
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              1 USDT = {exchangeRate.toFixed(2)} PKR
            </div>
          </div>

          {/* Amount PKR Input */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Amount (PKR)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amountPKR}
              onChange={(e) => handlePKRChange(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C]/50"
            />
          </div>

          {/* Estimated USDT */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Estimated USDT
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              {amountTokens ? parseFloat(amountTokens).toFixed(6) : "0.000000"}{" "}
              USDT
            </div>
          </div>

          {/* Calculation Preview */}
          {amountTokens && amountPKR && (
            <div className="p-3 rounded-lg bg-[#1a2540]/30 border border-[#FF7A5C]/20">
              <div className="text-xs text-white/70 uppercase mb-2">
                Summary
              </div>
              <div className="text-sm text-white/90">
                {amountTokens} USDT = {parseFloat(amountPKR).toFixed(2)} PKR
              </div>
            </div>
          )}

          {/* Payment Method Information */}
          {paymentMethods.length > 0 ? (
            <PaymentMethodInfoCard
              accountName={paymentMethods[0].accountName}
              accountNumber={paymentMethods[0].accountNumber}
              onEdit={() => {
                setEditingPaymentMethodId(paymentMethods[0].id);
                setShowPaymentDialog(true);
              }}
            />
          ) : (
            <div className="p-4 rounded-lg bg-red-600/20 border border-red-500/50">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                  !
                </div>
                <div>
                  <div className="text-sm font-semibold text-red-400 mb-2">
                    Complete Your Payment Method
                  </div>
                  <p className="text-xs text-red-300/80 mb-3">
                    You must add your payment method details before you can
                    create a buy order.
                  </p>
                  <Button
                    onClick={() => setShowPaymentDialog(true)}
                    className="w-full bg-red-600/50 hover:bg-red-600/70 border border-red-500 text-red-200 uppercase text-xs font-semibold py-2"
                  >
                    Add Payment Method
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="flex-1 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartBuy}
              disabled={!isFormValid || loading || paymentMethods.length === 0}
              className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Buy Now"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Method Dialog */}
      <PaymentMethodDialog
        open={showPaymentDialog}
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) {
            setEditingPaymentMethodId(undefined);
            setTimeout(() => {
              fetchPaymentMethods();
            }, 500);
          }
        }}
        walletAddress={wallet?.publicKey || ""}
        paymentMethodId={editingPaymentMethodId}
        onSave={() => {
          setEditingPaymentMethodId(undefined);
          setTimeout(() => {
            fetchPaymentMethods();
          }, 300);
        }}
      />

      {/* Seller Payment Method Dialog */}
      <Dialog open={flowStep === "seller_payment"}>
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              MAKE PAYMENT
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 space-y-3">
              <div>
                <p className="text-xs text-white/70 uppercase mb-1">
                  ACCOUNT TITLE
                </p>
                <p className="text-white font-semibold">Niazi</p>
              </div>

              <div className="border-t border-gray-300/10 pt-3">
                <p className="text-xs text-white/70 uppercase mb-1">
                  ACCOUNT NAME
                </p>
                <p className="text-white font-semibold">Ameer Nawaz Khan</p>
              </div>

              <div className="border-t border-gray-300/10 pt-3">
                <p className="text-xs text-white/70 uppercase mb-1">
                  ACCOUNT NUMBER
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold">03107044833</p>
                  <button
                    onClick={() => copyToClipboard("03107044833")}
                    className="text-[#FF7A5C] hover:text-[#FF6B4D]"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-300/10 pt-3">
                <p className="text-xs text-white/70 uppercase mb-1">
                  PAYMENT METHOD
                </p>
                <p className="text-white font-semibold">Easypaisa</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
              <p className="text-sm text-green-300">
                SEND {parseFloat(amountPKR).toFixed(2)} PKR TO THE ABOVE ACCOUNT
                FOR {parseFloat(amountTokens).toFixed(6)} USDT
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCancelFlow}
                variant="outline"
                className="flex-1 border border-gray-300/30 text-gray-300"
              >
                CANCEL
              </Button>
              <Button
                onClick={handlePaymentSent}
                className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
              >
                I'VE SENT PAYMENT
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waiting for Seller Confirmation Dialog */}
      <Dialog open={flowStep === "waiting_confirmation"}>
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Waiting for Seller</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Loader2 className="w-10 h-10 text-[#FF7A5C] animate-spin" />
            </div>

            <div className="text-center space-y-2">
              <p className="text-white font-semibold">
                Waiting for Seller Confirmation
              </p>
              <p className="text-white/70 text-sm">
                Seller is verifying your payment. This may take a few moments...
              </p>
            </div>

            {!orderStatus.sellerReceivedPayment ? (
              <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
                <p className="text-sm text-blue-300">
                  Transaction: {parseFloat(amountPKR).toFixed(2)} PKR →{" "}
                  {parseFloat(amountTokens).toFixed(6)} USDT
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  <p className="text-sm text-green-300">
                    Seller received your payment!
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleCancelFlow}
              variant="outline"
              className="w-full border border-gray-300/30 text-gray-300"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buyer Wallet Address Dialog */}
      <Dialog open={flowStep === "buyer_wallet"}>
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              Your Wallet Address
            </DialogTitle>
          </DialogHeader>

          {currentOrder && wallet && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Seller is sending your crypto to this address:
              </p>

              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCode
                  value={wallet.publicKey || ""}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 break-all">
                <p className="text-xs text-white/70 uppercase mb-2">
                  Wallet Address
                </p>
                <p className="text-white/90 text-xs font-mono">
                  {wallet.publicKey}
                </p>
                <button
                  onClick={() => copyToClipboard(wallet.publicKey || "")}
                  className="mt-2 text-[#FF7A5C] hover:text-[#FF6B4D] text-xs flex items-center gap-2"
                >
                  <Copy className="w-3 h-3" />
                  Copy Address
                </button>
              </div>

              <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
                <p className="text-sm text-blue-300">
                  Waiting for {parseFloat(amountTokens).toFixed(6)} USDT to
                  arrive...
                </p>
              </div>

              <Button
                onClick={handleCompleteTransaction}
                className="w-full bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
              >
                I've Received Crypto
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Complete Dialog */}
      <Dialog open={flowStep === "complete"}>
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              Transaction Complete
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-white font-semibold">
                Transaction Completed Successfully!
              </p>
              <p className="text-white/70 text-sm">
                You have successfully received{" "}
                {parseFloat(amountTokens).toFixed(6)} USDT for{" "}
                {parseFloat(amountPKR).toFixed(2)} PKR
              </p>
            </div>

            {currentOrder && (
              <div className="p-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                <p className="text-xs text-white/70 uppercase mb-1">Order ID</p>
                <p className="text-white/90 text-xs font-mono break-all">
                  {currentOrder.id}
                </p>
              </div>
            )}

            <Button
              onClick={handleCompleteTransaction}
              className="w-full bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
            >
              Back to Home
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <P2PBottomNavigation
        onPaymentClick={() => {
          setEditingPaymentMethodId(undefined);
          setShowPaymentDialog(true);
        }}
        onCreateOfferClick={() => {
          navigate("/buy-crypto");
        }}
      />
    </div>
  );
}
