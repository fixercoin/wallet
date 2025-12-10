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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { P2POrder } from "@/lib/p2p-api";

interface PaymentMethod {
  id: string;
  accountName: string;
  accountNumber: string;
}

type SellFlowStep =
  | "form"
  | "buyer_wallet_waiting"
  | "confirm_payment"
  | "crypto_sent"
  | "complete";

export default function SellData() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { createNotification } = useOrderNotifications();
  const isCreatingOrderRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [selectedToken, setSelectedToken] = useState<"USDT" | "FIXERCOIN">(
    "USDT",
  );
  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [amountTokens, setAmountTokens] = useState("");
  const [amountPKR, setAmountPKR] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // P2P Dialog Flow State
  const [flowStep, setFlowStep] = useState<SellFlowStep>("form");
  const [currentOrder, setCurrentOrder] = useState<P2POrder | null>(null);
  const [buyerWalletAddress, setBuyerWalletAddress] = useState("");
  const [orderStatus, setOrderStatus] = useState<{
    buyerPaymentSent?: boolean;
    sellerCryptoSent?: boolean;
  }>({});

  // Fetch exchange rate based on selected token
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const tokenParam = selectedToken === "USDT" ? "USDT" : "FIXERCOIN";
        const response = await fetch(`/api/token/price?token=${tokenParam}`);
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
  }, [selectedToken]);

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
              buyerPaymentSent: data.buyerPaymentSent,
              sellerCryptoSent: data.sellerCryptoSent,
            });

            // If buyer sent payment and we're waiting, move to confirm dialog
            if (data.buyerPaymentSent && flowStep === "buyer_wallet_waiting") {
              setFlowStep("confirm_payment");
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

  const handleTokensChange = (value: string) => {
    setAmountTokens(value);
    if (value) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setAmountPKR((num * exchangeRate).toFixed(2));
      }
    } else {
      setAmountPKR("");
    }
  };

  const isFormValid = useMemo(() => {
    const tokens = parseFloat(amountTokens) || 0;
    const pkr = parseFloat(amountPKR) || 0;
    return tokens > 0 && pkr > 0;
  }, [amountTokens, amountPKR]);

  const handleStartSell = async () => {
    if (isCreatingOrderRef.current) {
      console.warn("[SellData] Order creation already in progress");
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
          type: "SELL",
          buyerWallet: "",
          token: selectedToken,
          pricePKRPerQuote: exchangeRate,
          minAmountTokens: 0,
          maxAmountTokens: Infinity,
          minAmountPKR: 0,
          maxAmountPKR: Infinity,
        } as P2POrder,
        wallet.publicKey,
        "SELL",
        {
          token: selectedToken,
          amountTokens: parseFloat(amountTokens),
          amountPKR: parseFloat(amountPKR),
          price: exchangeRate,
        },
      );

      try {
        await createOrderInAPI(createdOrder);
        console.log(`[SellData] Order ${createdOrder.id} persisted to server`);
      } catch (apiError) {
        console.error("[SellData] Failed to persist order:", apiError);
        toast.error("Failed to create order - could not save to server");
        throw new Error("Order creation failed - server sync error");
      }

      setCurrentOrder(createdOrder);

      try {
        const recipientWallet = createdOrder.buyerWallet || "BROADCAST_BUYERS";
        await createNotification(
          recipientWallet,
          "new_sell_order",
          "SELL",
          createdOrder.id,
          `New sell order: ${parseFloat(amountTokens).toFixed(2)} ${selectedToken} for ${parseFloat(amountPKR).toFixed(2)} PKR`,
          {
            token: selectedToken,
            amountTokens: parseFloat(amountTokens),
            amountPKR: parseFloat(amountPKR),
            orderId: createdOrder.id,
            sellerWallet: createdOrder.sellerWallet,
            price: exchangeRate,
          },
          false,
        );
      } catch (notificationError) {
        console.warn("Failed to send notification:", notificationError);
      }

      // Generate a random buyer wallet for demo
      const demoBuyerWallet = `buyer_${Math.random().toString(36).substr(2, 9)}`;
      setBuyerWalletAddress(demoBuyerWallet);

      // Start polling for buyer payment
      startPollingOrderStatus(createdOrder.id);
      setFlowStep("buyer_wallet_waiting");
      setOrderStatus({ buyerPaymentSent: false, sellerCryptoSent: false });
      setLoading(false);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order");
      setLoading(false);
    } finally {
      isCreatingOrderRef.current = false;
    }
  };

  const handlePaymentReceived = async () => {
    if (!currentOrder) return;

    try {
      // Update order status: seller received payment
      const response = await fetch(
        `/api/p2p/orders/${encodeURIComponent(currentOrder.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerReceivedPayment: true }),
        },
      );

      if (response.ok) {
        setFlowStep("crypto_sent");
      } else {
        toast.error("Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("Failed to update order");
    }
  };

  const handleCryptoSent = async () => {
    if (!currentOrder) return;

    try {
      // Update order status: seller sent crypto
      const response = await fetch(
        `/api/p2p/orders/${encodeURIComponent(currentOrder.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerCryptoSent: true }),
        },
      );

      if (response.ok) {
        setFlowStep("complete");
      } else {
        toast.error("Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("Failed to update order");
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
    setBuyerWalletAddress("");
    setOrderStatus({});
    setAmountTokens("");
    setAmountPKR("");
    navigate("/");
  };

  const handleCancelFlow = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setFlowStep("form");
    setCurrentOrder(null);
    setBuyerWalletAddress("");
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

      {/* Sell Form */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-[#1a2847] border border-gray-300/30 rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-white uppercase font-bold mb-1">Sell Crypto</h2>
            <p className="text-white/70 uppercase text-xs">
              Enter the amount you want to sell
            </p>
          </div>

          {/* Token Selection Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Token
            </label>
            <Select
              value={selectedToken}
              onValueChange={(value) => {
                setSelectedToken(value as "USDT" | "FIXERCOIN");
                setAmountPKR("");
                setAmountTokens("");
              }}
            >
              <SelectTrigger className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold focus:ring-[#FF7A5C]/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2847] border border-gray-300/20">
                <SelectItem value="USDT" className="text-white">
                  USDT
                </SelectItem>
                <SelectItem value="FIXERCOIN" className="text-white">
                  FIXERCOIN
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Price Display */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Price
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              1 {selectedToken} = {exchangeRate.toFixed(2)} PKR
            </div>
          </div>

          {/* Amount Token Input */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Amount ({selectedToken})
            </label>
            <input
              type="number"
              step="0.000001"
              placeholder="0.000000"
              value={amountTokens}
              onChange={(e) => handleTokensChange(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C]/50"
            />
          </div>

          {/* Estimated PKR */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Estimated (PKR)
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              {amountPKR ? parseFloat(amountPKR).toFixed(2) : "0.00"} PKR
            </div>
          </div>

          {/* Calculation Preview */}
          {amountTokens && amountPKR && (
            <div className="p-3 rounded-lg bg-[#1a2540]/30 border border-[#FF7A5C]/20">
              <div className="text-xs text-white/70 uppercase mb-2">
                Summary
              </div>
              <div className="text-sm text-white/90">
                {amountTokens} {selectedToken} ={" "}
                {parseFloat(amountPKR).toFixed(2)} PKR
              </div>
            </div>
          )}

          {/* Payment Method Information */}
          {paymentMethods.length > 0 && (
            <PaymentMethodInfoCard
              accountName={paymentMethods[0].accountName}
              accountNumber={paymentMethods[0].accountNumber}
              onEdit={() => {
                setEditingPaymentMethodId(paymentMethods[0].id);
                setShowPaymentDialog(true);
              }}
            />
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
              onClick={handleStartSell}
              disabled={!isFormValid || loading}
              className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Sell Now"
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

      {/* Waiting for Buyer Payment Dialog */}
      <Dialog open={flowStep === "buyer_wallet_waiting"}>
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              Waiting for Buyer Payment
            </DialogTitle>
          </DialogHeader>

          {currentOrder && buyerWalletAddress && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Loader2 className="w-10 h-10 text-[#FF7A5C] animate-spin" />
              </div>

              <p className="text-sm text-white/70 text-center">
                Buyer's wallet address to receive{" "}
                {parseFloat(amountTokens).toFixed(6)} USDT:
              </p>

              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 break-all">
                <p className="text-xs text-white/70 uppercase mb-2">
                  Buyer Wallet
                </p>
                <p className="text-white/90 text-xs font-mono">
                  {buyerWalletAddress}
                </p>
                <button
                  onClick={() => copyToClipboard(buyerWalletAddress)}
                  className="mt-2 text-[#FF7A5C] hover:text-[#FF6B4D] text-xs flex items-center gap-2"
                >
                  <Copy className="w-3 h-3" />
                  Copy Address
                </button>
              </div>

              {!orderStatus.buyerPaymentSent ? (
                <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
                  <p className="text-sm text-blue-300">
                    Waiting for buyer to send {parseFloat(amountPKR).toFixed(2)}{" "}
                    PKR for {parseFloat(amountTokens).toFixed(6)}{" "}
                    {selectedToken}...
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <p className="text-sm text-green-300">
                      Buyer sent {parseFloat(amountPKR).toFixed(2)} PKR!
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
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Payment Dialog */}
      <Dialog open={flowStep === "confirm_payment"}>
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              Confirm Payment Received
            </DialogTitle>
          </DialogHeader>

          {paymentMethods.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-white/70">
                Buyer has sent {parseFloat(amountPKR).toFixed(2)} PKR. Ready to
                send crypto?
              </p>

              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                <p className="text-xs text-white/70 uppercase mb-2">
                  You will receive
                </p>
                <p className="text-white font-semibold">
                  {parseFloat(amountPKR).toFixed(2)} PKR
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-gray-300/20">
                <p className="text-xs text-white/70 uppercase mb-2">
                  From your account
                </p>
                <p className="text-white font-semibold">
                  {paymentMethods[0].accountName}
                </p>
                <p className="text-white/70 text-xs">
                  {paymentMethods[0].accountNumber}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
                <p className="text-sm text-green-300">
                  You will send {parseFloat(amountTokens).toFixed(6)} USDT to
                  the buyer
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleCancelFlow}
                  variant="outline"
                  className="flex-1 border border-gray-300/30 text-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePaymentReceived}
                  className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
                >
                  I've Received
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Crypto Sent Dialog */}
      <Dialog open={flowStep === "crypto_sent"}>
        <DialogContent className="bg-[#1a2847] border border-gray-300/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Send Crypto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Payment verified. Ready to send the crypto?
            </p>

            <div className="p-4 rounded-lg bg-green-600/20 border border-green-500/50">
              <p className="text-sm text-green-300">
                Send {parseFloat(amountTokens).toFixed(6)} {selectedToken} to
                buyer's wallet
              </p>
            </div>

            <div className="p-4 rounded-lg bg-blue-600/20 border border-blue-500/50">
              <p className="text-sm text-blue-300">
                Transaction: {parseFloat(amountTokens).toFixed(6)}{" "}
                {selectedToken} ←→ {parseFloat(amountPKR).toFixed(2)} PKR
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleCancelFlow}
                variant="outline"
                className="flex-1 border border-gray-300/30 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCryptoSent}
                className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
              >
                I've Sent Assets
              </Button>
            </div>
          </div>
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
                You have successfully sent {parseFloat(amountTokens).toFixed(6)}{" "}
                {selectedToken} and received {parseFloat(amountPKR).toFixed(2)}{" "}
                PKR
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
          navigate("/sell-now");
        }}
      />
    </div>
  );
}
