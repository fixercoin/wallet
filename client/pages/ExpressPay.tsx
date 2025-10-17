import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Plus, AlertCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { listOrders, ADMIN_WALLET } from "@/lib/p2p";

type TabType = "buy" | "sell";
type PaymentMethod = "easypaisa" | "jazzcash" | "bank";

interface Order {
  id: string;
  type: "buy" | "sell";
  token: string;
  pricePkr: number;
  minToken: number;
  maxToken: number;
  paymentMethod: string;
}

export default function ExpressPay() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet, tokens } = useWallet();
  
  const [activeTab, setActiveTab] = useState<TabType>("buy");
  const [spendAmount, setSpendAmount] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USDC");
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("easypaisa");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const currencies = ["USDC", "SOL", "FIXERCOIN"];
  const paymentMethods = [
    { id: "easypaisa", label: "EasyPaisa" },
    { id: "jazzcash", label: "JazzCash" },
    { id: "bank", label: "Bank Account" },
  ] as const;

  // Fixed exchange rate for display (PKR per token)
  const exchangeRate = 280;

  const receivedAmount = useMemo(() => {
    if (!spendAmount || isNaN(Number(spendAmount))) return 0;
    return Number(spendAmount) / exchangeRate;
  }, [spendAmount]);

  // Get wallet balance for selected currency (in sell mode)
  const walletBalance = useMemo(() => {
    if (activeTab !== "sell" || !tokens) return 0;
    const token = tokens.find((t) =>
      t.symbol?.toUpperCase() === selectedCurrency.toUpperCase(),
    );
    return token?.balance || 0;
  }, [activeTab, selectedCurrency, tokens]);

  const handleBuyWithPKR = () => {
    if (!wallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!spendAmount || Number(spendAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid PKR amount",
        variant: "destructive",
      });
      return;
    }

    // For sell, show confirmation dialog
    if (activeTab === "sell") {
      setShowConfirmation(true);
      return;
    }

    // Navigate to order book to proceed with the trade (buy flow)
    navigate("/express/orderbook", {
      state: {
        type: "buy",
        amountPKR: Number(spendAmount),
        token: selectedCurrency,
        paymentMethod: selectedPayment,
      },
    });
  };

  const handleSellApprove = async () => {
    try {
      if (!wallet) {
        toast({
          title: "Wallet not connected",
          variant: "destructive",
        });
        return;
      }

      setIsProcessing(true);

      // Validate sell amount
      if (!spendAmount || Number(spendAmount) <= 0) {
        toast({
          title: "Invalid amount",
          variant: "destructive",
        });
        return;
      }

      // Validate user has sufficient balance
      if (walletBalance < receivedAmount) {
        toast({
          title: "Insufficient balance",
          description: `You have ${walletBalance} ${selectedCurrency} but need ${receivedAmount.toFixed(6)}`,
          variant: "destructive",
        });
        return;
      }

      // Simulate transaction to buyer (admin wallet detected)
      const buyerWallet = ADMIN_WALLET;
      
      // In a real scenario, here you would:
      // 1. Create a Solana transaction to send tokens to buyer
      // 2. Sign and send it
      // 3. Get the transaction signature
      
      toast({
        title: "Transfer initiated",
        description: `Sending ${receivedAmount.toFixed(6)} ${selectedCurrency} to buyer...`,
      });

      // Simulate delay for transaction
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: "Transfer successful",
        description: `${receivedAmount.toFixed(6)} ${selectedCurrency} sent to buyer`,
      });

      setShowConfirmation(false);
      
      // Navigate to chat window (BuyTrade page)
      navigate("/express/buy-trade", {
        state: {
          order: {
            id: `sell-${Date.now()}`,
            type: "sell",
            token: selectedCurrency,
            amountPKR: Number(spendAmount),
            pricePKRPerQuote: exchangeRate,
            quoteAsset: selectedCurrency,
            paymentMethod: selectedPayment,
          },
        },
      });

    } catch (error: any) {
      toast({
        title: "Transfer failed",
        description: error?.message || "Failed to send tokens",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdminPanel = () => {
    navigate("/express/orderbook");
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center font-medium text-sm">Express P2P</div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleAdminPanel}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
            aria-label="Admin panel"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm p-6 space-y-5">
          {/* Tab Selection */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[hsl(var(--secondary))] rounded-xl">
            <button
              onClick={() => setActiveTab("buy")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === "buy"
                  ? "bg-white text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setActiveTab("sell")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === "sell"
                  ? "bg-white text-[hsl(var(--foreground))] shadow-sm"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              Sell
            </button>
          </div>

          {activeTab === "sell" && (
            <>
              {/* Wallet Balance Info (Sell Mode) */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                      Your {selectedCurrency} Balance
                    </div>
                    <div className="text-lg font-bold text-[hsl(var(--foreground))]">
                      {walletBalance.toFixed(6)}
                    </div>
                  </div>
                  {walletBalance > 0 && (
                    <Check className="h-6 w-6 text-green-600" />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Spend Section */}
          <div className="space-y-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              {activeTab === "sell" ? "Sell Amount" : "Spend"}
            </label>
            <div className="relative rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--input))] overflow-hidden">
              <div className="flex items-center">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-transparent px-4 py-3 text-sm font-medium outline-none"
                />
                <div className="px-4 py-3 bg-white/50 text-xs font-bold text-[hsl(var(--primary))]">
                  PKR
                </div>
              </div>
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              Minimum: 1,000 PKR
              {activeTab === "sell" &&
                walletBalance > 0 &&
                ` | Available: ${walletBalance.toFixed(6)} ${selectedCurrency}`}
            </div>
          </div>

          {/* Receive Section */}
          <div className="space-y-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              {activeTab === "sell" ? "Sell Token" : "Receive"}
            </label>
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--input))] overflow-hidden">
              <div className="flex items-center h-11">
                <div className="flex-1 px-4 py-3 text-sm font-medium text-[hsl(var(--foreground))]">
                  {receivedAmount > 0 ? receivedAmount.toFixed(6) : "0"}
                </div>
                <div className="relative">
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="appearance-none bg-white/50 px-3 py-3 pr-7 text-xs font-bold text-[hsl(var(--primary))] outline-none cursor-pointer"
                  >
                    {currencies.map((cur) => (
                      <option key={cur} value={cur}>
                        {cur}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--primary))] pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">
                1 {selectedCurrency} ≈ {exchangeRate.toFixed(2)} PKR
              </span>
              <button className="text-[hsl(var(--primary))] font-medium hover:underline">
                Adjust
              </button>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              Payment Method
            </label>
            <div className="relative">
              <select
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value as PaymentMethod)}
                className="w-full appearance-none bg-white border border-[hsl(var(--border))] rounded-xl px-4 py-3 pr-10 text-sm font-medium text-[hsl(var(--foreground))] outline-none cursor-pointer"
              >
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
            </div>
          </div>

          {/* Primary Action Button */}
          <Button
            onClick={handleBuyWithPKR}
            disabled={isProcessing}
            className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[hsl(var(--primary))] to-blue-600 hover:from-[hsl(var(--primary))]/90 hover:to-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {isProcessing
              ? "Processing..."
              : activeTab === "buy"
                ? "Buy with PKR"
                : "Sell for PKR"}
          </Button>

          {/* Footer Link */}
          <div className="text-center">
            <button className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] underline">
              Login to post offers
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-blue-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Confirm Sell Transaction
              </h2>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[hsl(var(--secondary))] rounded-lg">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Token to Send
                  </span>
                  <span className="font-bold text-[hsl(var(--foreground))]">
                    {selectedCurrency}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-[hsl(var(--secondary))] rounded-lg">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Amount
                  </span>
                  <span className="font-bold text-[hsl(var(--foreground))]">
                    {receivedAmount.toFixed(6)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-[hsl(var(--secondary))] rounded-lg">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    PKR Amount
                  </span>
                  <span className="font-bold text-[hsl(var(--foreground))]">
                    {Number(spendAmount).toLocaleString()} PKR
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-[hsl(var(--secondary))] rounded-lg">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Payment Method
                  </span>
                  <span className="font-bold text-[hsl(var(--foreground))] capitalize">
                    {selectedPayment}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-800">
                  ✓ Tokens will be transferred to buyer. Chat window will open after
                  confirmation.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-[hsl(var(--secondary))] flex gap-3">
              <Button
                onClick={() => setShowConfirmation(false)}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSellApprove}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm"
              >
                {isProcessing ? "Processing..." : "Approve & Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
