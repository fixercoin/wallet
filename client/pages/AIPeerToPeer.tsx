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
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button
            onClick={() => handleStartNewTrade("buy")}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            size="lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Buy Order
          </Button>
          <Button
            onClick={() => handleStartNewTrade("sell")}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
            size="lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Sell Order
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-gray-700/30 bg-gray-900">
        <CardContent className="pt-6">
          <h2 className="text-lg font-bold mb-4">
            Create {tradeType === "buy" ? "Buy" : "Sell"} Order
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Token</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                placeholder="e.g., SOL, USDC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Amount ({token})
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Min Price (PKR)
                </label>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Price (PKR)
                </label>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="mobile_wallet">Mobile Wallet</option>
                <option value="cash">Cash in Person</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Order"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
