import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Send, Loader2, Plus } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { AIBotChat } from "@/components/p2p/AIBotChat";
import { P2POrderCard } from "@/components/p2p/P2POrderCard";
import type { P2POrder } from "@/lib/p2p-api";
import { toast } from "sonner";

interface ActiveTrade {
  id: string;
  order: P2POrder;
  counterparty: string;
  status: "negotiating" | "confirmed" | "completed";
  createdAt: number;
}

export default function AIPeerToPeer() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<ActiveTrade | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNewTradeDialog, setShowNewTradeDialog] = useState(false);
  const [tradeType, setTradeType] = useState<"buy" | "sell" | null>(null);

  useEffect(() => {
    if (wallet?.address) {
      loadActiveTrades();
    }
  }, [wallet?.address]);

  const loadActiveTrades = async () => {
    if (!wallet?.address) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/p2p/orders?wallet=${wallet.address}&status=active`,
      );
      if (!response.ok) throw new Error("Failed to load trades");

      const data = await response.json();
      const trades = (data.orders || []).map((order: P2POrder) => ({
        id: order.id || `trade-${Date.now()}`,
        order,
        counterparty:
          order.creator_wallet === wallet.address
            ? order.buyer_wallet || "unknown"
            : order.creator_wallet || "unknown",
        status: "negotiating" as const,
        createdAt: order.created_at || Date.now(),
      }));

      setActiveTrades(trades);
    } catch (error) {
      console.error("Error loading trades:", error);
      toast.error("Failed to load trades");
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewTrade = (type: "buy" | "sell") => {
    setTradeType(type);
    setShowNewTradeDialog(true);
  };

  const handleCloseNewTradeDialog = () => {
    setShowNewTradeDialog(false);
    setTradeType(null);
  };

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white flex items-center justify-center">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-gray-300 mb-4">
              Please connect your wallet to use AI P2P trading
            </p>
            <Button
              onClick={() => navigate("/")}
              className="w-full"
              variant="outline"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedTrade) {
    return (
      <AIBotChat
        trade={selectedTrade}
        onBack={() => setSelectedTrade(null)}
        onTradeUpdate={loadActiveTrades}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a]/95 to-transparent backdrop-blur-sm border-b border-gray-700/30 p-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/")}
            className="text-gray-300 hover:text-gray-100 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">AI P2P Trading</h1>
            <p className="text-xs text-gray-400">Chat-based peer-to-peer exchange</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button
            onClick={() => handleStartNewTrade("buy")}
            className="bg-gradient-to-br from-emerald-500 via-green-600 to-green-700 hover:from-emerald-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 uppercase h-14 text-sm"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            CREATE BUY ORDER
          </Button>
          <Button
            onClick={() => handleStartNewTrade("sell")}
            className="bg-gradient-to-br from-violet-500 via-purple-600 to-purple-700 hover:from-violet-600 hover:via-purple-700 hover:to-purple-800 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 uppercase h-14 text-sm"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            CREATE SELL ORDER
          </Button>
        </div>

        {/* Active Trades Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Active Trades
          </h2>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : activeTrades.length === 0 ? (
            <Card className="border-gray-700/30 bg-gray-900/50">
              <CardContent className="pt-6">
                <p className="text-center text-gray-400 mb-4">
                  No active trades yet
                </p>
                <p className="text-center text-sm text-gray-500 mb-6">
                  Start a new buy or sell order to begin trading
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {activeTrades.map((trade) => (
                <P2POrderCard
                  key={trade.id}
                  order={trade.order}
                  counterparty={trade.counterparty}
                  status={trade.status}
                  onClick={() => setSelectedTrade(trade)}
                />
              ))}
            </div>
          )}
        </div>

        {/* New Trade Dialog */}
        {showNewTradeDialog && (
          <NewTradeDialog
            tradeType={tradeType}
            wallet={wallet}
            onClose={handleCloseNewTradeDialog}
            onSuccess={() => {
              handleCloseNewTradeDialog();
              loadActiveTrades();
            }}
          />
        )}
      </div>
    </div>
  );
}

interface NewTradeDialogProps {
  tradeType: "buy" | "sell" | null;
  wallet: any;
  onClose: () => void;
  onSuccess: () => void;
}

function NewTradeDialog({
  tradeType,
  wallet,
  onClose,
  onSuccess,
}: NewTradeDialogProps) {
  const [token, setToken] = useState("SOL");
  const [amount, setAmount] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !minPrice || !maxPrice || !token) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      setIsSubmitting(true);
      const orderData = {
        type: tradeType === "buy" ? "BUY" : "SELL",
        token,
        amount: parseFloat(amount),
        minPrice: parseFloat(minPrice),
        maxPrice: parseFloat(maxPrice),
        paymentMethod,
        walletAddress: wallet.address,
      };

      const response = await fetch("/api/p2p/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error("Failed to create order");
      }

      toast.success("Order created successfully!");
      onSuccess();
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create order",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDarkBg = tradeType === "buy" ? "from-emerald-900/20" : "from-violet-900/20";
  const isGradient = tradeType === "buy" ? "from-emerald-600 to-green-600" : "from-violet-600 to-purple-600";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <Card className={`w-full max-w-md border border-gray-700/50 bg-gradient-to-br ${isDarkBg} to-gray-900 shadow-2xl`}>
        {/* Card Header with Gradient */}
        <div className={`bg-gradient-to-r ${isGradient} px-6 py-5`}>
          <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
            {tradeType === "buy" ? "🛒 BUY ORDER" : "📤 SELL ORDER"}
          </h2>
          <p className="text-sm text-white/80 mt-1">
            {tradeType === "buy"
              ? "PURCHASE CRYPTOCURRENCY AT YOUR DESIRED PRICE"
              : "SELL YOUR CRYPTOCURRENCY TO INTERESTED BUYERS"}
          </p>
        </div>

        <CardContent className="pt-7 pb-6 px-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Token Dropdown Field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase text-gray-200 tracking-wide">TOKEN</label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-4 py-3 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="">SELECT TOKEN</option>
                <option value="SOL">SOL - SOLANA</option>
                <option value="USDT">USDT - TETHER</option>
                <option value="FIXERCOIN">FIXERCOIN - FIXER</option>
              </select>
            </div>

            {/* Amount Field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase text-gray-200 tracking-wide">
                AMOUNT ({token})
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-4 py-3 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Price Range Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase text-gray-200 tracking-wide">
                  MIN PRICE (PKR)
                </label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-4 py-3 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold uppercase text-gray-200 tracking-wide">
                  MAX PRICE (PKR)
                </label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-4 py-3 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>

            {/* Payment Method Field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold uppercase text-gray-200 tracking-wide">
                PAYMENT METHOD
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-gray-800/60 border border-gray-700/60 rounded-lg px-4 py-3 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="bank_transfer">BANK TRANSFER</option>
                <option value="mobile_wallet">MOBILE WALLET</option>
                <option value="cash">CASH IN PERSON</option>
                <option value="other">OTHER METHOD</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8 pt-4 border-t border-gray-700/30">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 uppercase font-bold text-sm h-11 border-gray-700/60 hover:bg-gray-800/40 transition-all"
              >
                CANCEL
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 uppercase font-bold text-sm h-11 text-white transition-all ${
                  tradeType === "buy"
                    ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg hover:shadow-xl"
                    : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    CREATING...
                  </>
                ) : (
                  "CREATE ORDER"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
