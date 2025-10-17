import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { listOrders } from "@/lib/p2p";

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
  const { wallet } = useWallet();
  
  const [activeTab, setActiveTab] = useState<TabType>("buy");
  const [spendAmount, setSpendAmount] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USDC");
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("easypaisa");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

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

    // Navigate to order book to proceed with the trade
    navigate("/express/orderbook", {
      state: {
        type: "buy",
        amountPKR: Number(spendAmount),
        token: selectedCurrency,
        paymentMethod: selectedPayment,
      },
    });
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

          {/* Spend Section */}
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

          {/* Receive Section */}
          <div className="space-y-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
              Receive
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
            className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[hsl(var(--primary))] to-blue-600 hover:from-[hsl(var(--primary))]/90 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
          >
            {activeTab === "buy" ? "Buy with PKR" : "Sell for PKR"}
          </Button>

          {/* Footer Link */}
          <div className="text-center">
            <button className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] underline">
              Login to post offers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
