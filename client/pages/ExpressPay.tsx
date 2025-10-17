import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useExpressP2P } from "@/contexts/ExpressP2PContext";
import { listOrders, ADMIN_WALLET } from "@/lib/p2p";
import type { P2POrder } from "@/lib/p2p-api";
import { p2pPriceService } from "@/lib/services/p2p-price";

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
  amountPKR?: number;
  quoteAsset?: string;
  pricePKRPerQuote?: number;
  paymentDetails?: {
    accountName: string;
    accountNumber: string;
  };
}

export default function ExpressPay() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet, tokens } = useWallet();

  const [activeTab, setActiveTab] = useState<TabType>("buy");
  const [spendAmount, setSpendAmount] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USDC");
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentMethod>("easypaisa");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [showBuyConfirmation, setShowBuyConfirmation] = useState(false);
  const [showSellConfirmation, setShowSellConfirmation] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { exchangeRate, setExchangeRate, isAdmin, setIsAdmin } =
    useExpressP2P();

  // Token-specific PKR rate (USDC uses exchangeRate; SOL/FIXERCOIN fetched via service)
  const [selectedRate, setSelectedRate] = useState<number>(exchangeRate);

  useEffect(() => {
    let cancelled = false;
    const loadRate = async () => {
      try {
        if (selectedCurrency === "USDC") {
          if (!cancelled) setSelectedRate(exchangeRate);
          return;
        }
        const rate = await p2pPriceService.getTokenPrice(
          selectedCurrency as "USDC" | "SOL" | "FIXERCOIN",
        );
        if (!cancelled && typeof rate === "number" && rate > 0) {
          setSelectedRate(rate);
        }
      } catch {
        if (!cancelled) setSelectedRate(exchangeRate);
      }
    };
    loadRate();
    return () => {
      cancelled = true;
    };
  }, [selectedCurrency, exchangeRate]);

  const currencies = ["USDC", "SOL", "FIXERCOIN"];
  const paymentMethods = [
    { id: "easypaisa", label: "EasyPaisa" },
    { id: "jazzcash", label: "JazzCash" },
    { id: "bank", label: "Bank Account" },
  ] as const;

  // Check if user is admin
  useEffect(() => {
    const userWalletAddress = wallet?.publicKey || wallet?.address || "";
    setIsAdmin(userWalletAddress === ADMIN_WALLET);
  }, [wallet, setIsAdmin]);

  // Handle sell confirmation when user clicks button
  const handleSellClick = () => {
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
        description: "Please enter a valid token amount",
        variant: "destructive",
      });
      return;
    }

    const tokenAmount = Number(spendAmount);
    if (walletBalance < tokenAmount) {
      toast({
        title: "Insufficient balance",
        description: `You have ${walletBalance} ${selectedCurrency} but need ${tokenAmount.toFixed(6)}`,
        variant: "destructive",
      });
      return;
    }

    setShowSellConfirmation(true);
  };

  const receivedAmount = useMemo(() => {
    const amt = Number(spendAmount);
    if (!isFinite(amt) || amt <= 0) return 0;
    if (!isFinite(selectedRate) || selectedRate <= 0) return 0;
    return activeTab === "sell" ? amt * selectedRate : amt / selectedRate;
  }, [spendAmount, selectedRate, activeTab]);

  // Get wallet balance for selected currency (in sell mode)
  const walletBalance = useMemo(() => {
    if (activeTab !== "sell" || !tokens) return 0;
    const token = tokens.find(
      (t) => t.symbol?.toUpperCase() === selectedCurrency.toUpperCase(),
    );
    return token?.balance || 0;
  }, [activeTab, selectedCurrency, tokens]);

  // Load available buy orders when in buy tab
  useEffect(() => {
    if (activeTab === "buy") {
      loadOrders();
    }
  }, [activeTab]);

  const loadOrders = async () => {
    try {
      setIsLoadingOrders(true);
      const res = await listOrders("global");
      // Filter for sell orders (sellers listing their tokens)
      const sellOrders = (res.orders || []).filter(
        (o: any) => o.type === "sell",
      );
      setOrders(sellOrders as Order[]);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleBuyClick = () => {
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

    // For buy, show confirmation with seller details
    if (activeTab === "buy") {
      // Use admin as default seller for now
      const seller: Order = {
        id: `seller-${Date.now()}`,
        type: "sell",
        token: selectedCurrency,
        pricePkr: selectedRate,
        minToken: 0,
        maxToken: 10000,
        paymentMethod: selectedPayment,
        amountPKR: Number(spendAmount),
        quoteAsset: selectedCurrency,
        pricePKRPerQuote: selectedRate,
        paymentDetails: {
          accountName: "Fixorium Admin",
          accountNumber: "03001234567",
        },
      };
      setSelectedSeller(seller);
      setShowBuyConfirmation(true);
      return;
    }

    // For sell, show sell confirmation
    handleSellClick();
  };

  const handleBuyApprove = async () => {
    try {
      if (!wallet || !selectedSeller) {
        toast({
          title: "Error",
          variant: "destructive",
        });
        return;
      }

      setIsProcessing(true);

      toast({
        title: "Payment confirmed",
        description: "Waiting for seller to verify payment...",
      });

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setShowBuyConfirmation(false);

      // Navigate to chat window (BuyTrade page)
      navigate("/express/buy-trade", {
        state: {
          order: selectedSeller,
        },
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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
      const tokenAmount = Number(spendAmount);
      if (walletBalance < tokenAmount) {
        toast({
          title: "Insufficient balance",
          description: `You have ${walletBalance} ${selectedCurrency} but need ${tokenAmount.toFixed(6)}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Transfer initiated",
        description: `Sending ${tokenAmount.toFixed(6)} ${selectedCurrency} to buyer...`,
      });

      // Simulate delay for transaction
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: "Transfer successful",
        description: `${Number(spendAmount).toFixed(6)} ${selectedCurrency} sent to buyer`,
      });

      setShowSellConfirmation(false);

      // Navigate to chat window (BuyTrade page)
      navigate("/express/buy-trade", {
        state: {
          order: {
            id: `sell-${Date.now()}`,
            type: "sell",
            token: selectedCurrency,
            amountPKR: Number(spendAmount) * exchangeRate,
            pricePKRPerQuote: selectedRate,
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

          <div className="flex-1 text-center font-medium text-sm">
            Express P2P
          </div>

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

          {/* Spend Section (Buy) */}
          {activeTab !== "sell" && (
            <div className="space-y-2">
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
                Spend
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
              </div>
            </div>
          )}

          {/* Token Selection / Receive Section */}
          <div className="space-y-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              {activeTab === "sell" ? "Sell Token" : "Receive"}
            </label>
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--input))] overflow-hidden">
              <div className="flex items-center h-11">
                <div className="flex-1 px-4 py-3 text-sm font-medium text-[hsl(var(--foreground))]">
                  {activeTab === "sell"
                    ? ""
                    : receivedAmount > 0
                      ? receivedAmount.toFixed(6)
                      : "0"}
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
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-[hsl(var(--muted-foreground))]">
                1 {selectedCurrency} ={" "}
                {isFinite(selectedRate) && selectedRate > 0
                  ? selectedRate.toFixed(2)
                  : "-"}{" "}
                PKR
              </span>
            </div>
          </div>

          {activeTab === "sell" && (
            <div className="space-y-2">
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
                Sell Amount {selectedCurrency}
              </label>
              <div className="relative rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--input))] overflow-hidden">
                <div className="flex items-center">
                  <input
                    type="number"
                    min={0}
                    step={0.000001}
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent px-4 py-3 text-sm font-medium outline-none"
                  />
                  <div className="px-4 py-3 bg-white/50 text-xs font-bold text-[hsl(var(--primary))]">
                    {selectedCurrency}
                  </div>
                </div>
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                {walletBalance > 0 &&
                  `Available: ${walletBalance.toFixed(6)} ${selectedCurrency}`}
              </div>
            </div>
          )}

          {/* Payment Methods */}
          <div className="space-y-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              Payment Method
            </label>
            <div className="relative">
              <select
                value={selectedPayment}
                onChange={(e) =>
                  setSelectedPayment(e.target.value as PaymentMethod)
                }
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
            onClick={() => {
              if (activeTab === "buy") {
                handleBuyClick();
              } else {
                handleSellClick();
              }
            }}
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

      {/* Buy Confirmation Modal */}
      {showBuyConfirmation && selectedSeller && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-blue-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Seller Details
              </h2>
              <button
                onClick={() => setShowBuyConfirmation(false)}
                className="text-white hover:bg-white/20 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Transaction Summary */}
              <div className="space-y-2 pb-4 border-b border-[hsl(var(--border))]">
                <div className="flex justify-between items-center p-2">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    You Pay
                  </span>
                  <span className="font-bold text-[hsl(var(--foreground))]">
                    {Number(spendAmount).toLocaleString()} PKR
                  </span>
                </div>
                <div className="flex justify-between items-center p-2">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    You Receive
                  </span>
                  <span className="font-bold text-[hsl(var(--foreground))]">
                    {receivedAmount.toFixed(6)} {selectedCurrency}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Rate
                  </span>
                  <span className="font-bold text-[hsl(var(--foreground))]">
                    1 {selectedCurrency} ={" "}
                    {isFinite(selectedRate) && selectedRate > 0
                      ? selectedRate
                      : "-"}{" "}
                    PKR
                  </span>
                </div>
              </div>

              {/* Seller Details */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-[hsl(var(--foreground))]">
                  Seller Information
                </h3>

                <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                    Account Name
                  </div>
                  <div className="font-semibold text-[hsl(var(--foreground))]">
                    {selectedSeller.paymentDetails?.accountName ||
                      "Not provided"}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                    Account Number
                  </div>
                  <div className="font-semibold text-[hsl(var(--foreground))] font-mono">
                    {selectedSeller.paymentDetails?.accountNumber ||
                      "Not provided"}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[hsl(var(--secondary))]">
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                    Payment Method
                  </div>
                  <div className="font-semibold text-[hsl(var(--foreground))] capitalize">
                    {selectedSeller.paymentMethod || "EasyPaisa"}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-xs text-green-800">
                  ✓ After payment, chat window will open to confirm with seller.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-[hsl(var(--secondary))] flex gap-3 flex-shrink-0 border-t border-[hsl(var(--border))]">
              <Button
                onClick={() => setShowBuyConfirmation(false)}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBuyApprove}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm"
              >
                {isProcessing ? "Processing..." : "I Have Paid"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sell Confirmation Modal */}
      {showSellConfirmation && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-blue-600 px-6 py-4 flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Confirm Sell Transaction
              </h2>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
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
                    {Number(spendAmount || 0).toFixed(6)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-[hsl(var(--secondary))] rounded-lg">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    PKR Amount
                  </span>
                  <span className="font-bold text-[hsl(var(--foreground))]">
                    {receivedAmount.toLocaleString()} PKR
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
                  ✓ Tokens will be transferred to buyer. Chat window will open
                  after confirmation.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-[hsl(var(--secondary))] flex gap-3 flex-shrink-0 border-t border-[hsl(var(--border))]">
              <Button
                onClick={() => setShowSellConfirmation(false)}
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
