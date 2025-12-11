import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Send,
  Plus,
  ArrowRightLeft,
  History,
  Settings,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";

// Admin wallets - keep in sync with FiatAdmin.tsx
const ADMIN_WALLETS = ["7jnAb5imcmxFiS6iMvgtd5Rf1HHAyASYdqoZAQesJeSw"];

export interface UserBalance {
  wallet: string;
  usdt: number;
  pkr: number;
  lastUpdated: string;
}

export interface PriceRatio {
  usdtToPkr: number;
  pkrToUsdt: number;
  updatedBy: string;
  timestamp: string;
}

export default function FiatSystem() {
  const navigate = useNavigate();
  const { wallet, publicKey } = useWallet();
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [priceRatio, setPriceRatio] = useState<PriceRatio | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("balance");

  const fetchBalance = async () => {
    if (!wallet) return;

    try {
      const response = await fetch(`/api/fiat/balance?wallet=${wallet}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error("Error fetching balance:", error);
      toast.error(`Failed to fetch balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const fetchPriceRatio = async () => {
    try {
      const response = await fetch("/api/fiat/price-ratio");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      setPriceRatio(data);
    } catch (error) {
      console.error("Error fetching price ratio:", error);
      toast.error(`Failed to fetch exchange rate: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchBalance(), fetchPriceRatio()]);
      setLoading(false);
    };

    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [wallet]);

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white flex items-center justify-center">
        <Card className="w-full max-w-lg mx-4">
          <CardContent className="pt-6">
            <p className="text-center text-gray-300 mb-4">
              Please connect your wallet to use the fiat system
            </p>
            <Button
              onClick={() => navigate("/")}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white">
      <div className="w-full max-w-lg mx-auto px-4 py-4 relative z-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            BACK
          </Button>
          <h1 className="text-2xl font-bold text-white uppercase">
            FIAT SYSTEM
          </h1>
          {wallet && ADMIN_WALLETS.includes(wallet) && (
            <Button
              onClick={() => navigate("/fiat/admin")}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-yellow-400"
              title="Admin Panel"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
          {wallet && !ADMIN_WALLETS.includes(wallet) && (
            <div className="w-10" />
          )}
        </div>

        {/* Balance Card */}
        {balance && (
          <div className="mb-6 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent rounded-2xl border border-blue-500/20 backdrop-blur-xl p-6 shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">TOTAL BALANCE</p>
                <h2 className="text-3xl font-bold text-white">Your Wallet</h2>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <Wallet className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30 backdrop-blur">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">USDT Balance</p>
                  <div className="w-8 h-8 bg-blue-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 text-sm font-bold">₹</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-200">
                  ${balance.usdt.toFixed(2)}
                </p>
                <p className="text-xs text-blue-400/60 mt-1">US Dollar</p>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl p-4 border border-purple-500/30 backdrop-blur">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider">PKR Balance</p>
                  <div className="w-8 h-8 bg-purple-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-purple-400 text-sm font-bold">৳</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-purple-200">
                  ₨{(balance.pkr || 0).toLocaleString("en-PK", {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-purple-400/60 mt-1">Pakistani Rupee</p>
              </div>
            </div>

            {priceRatio && (
              <div className="mt-4 pt-4 border-t border-gray-700/30 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Exchange Rate</p>
                  <p className="text-sm font-semibold text-gray-300">1 USDT = {priceRatio.usdtToPkr.toFixed(2)} PKR</p>
                </div>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
            )}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-gray-800/40 to-gray-900/40 border border-gray-700/30 backdrop-blur-xl rounded-xl p-1 gap-1">
            <TabsTrigger value="balance" className="text-xs rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/30 data-[state=active]:to-purple-500/30 data-[state=active]:border data-[state=active]:border-blue-500/30 transition-all duration-200">
              <span className="hidden sm:inline">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="deposit" className="text-xs rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500/30 data-[state=active]:to-emerald-500/30 data-[state=active]:border data-[state=active]:border-green-500/30 transition-all duration-200">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Deposit</span>
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="text-xs rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500/30 data-[state=active]:to-orange-500/30 data-[state=active]:border data-[state=active]:border-red-500/30 transition-all duration-200">
              <Send className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Withdraw</span>
            </TabsTrigger>
            <TabsTrigger value="exchange" className="text-xs rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:border data-[state=active]:border-purple-500/30 transition-all duration-200">
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Exchange</span>
            </TabsTrigger>
          </TabsList>

          {/* Balance Tab */}
          <TabsContent value="balance" className="mt-6 animate-in fade-in duration-300">
            <div className="space-y-4">
              {balance && (
                <>
                  <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 rounded-2xl p-5 border border-blue-500/20 backdrop-blur-xl shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-blue-300/70 text-xs font-semibold uppercase tracking-wider mb-1">USDT Balance</p>
                        <p className="text-4xl font-bold text-blue-100">
                          ${balance.usdt.toFixed(2)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/30 rounded-xl flex items-center justify-center border border-blue-500/30">
                        <span className="text-xl font-bold text-blue-300">₹</span>
                      </div>
                    </div>
                    <p className="text-xs text-blue-300/50">US Dollar Token</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 rounded-2xl p-5 border border-purple-500/20 backdrop-blur-xl shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-purple-300/70 text-xs font-semibold uppercase tracking-wider mb-1">PKR Balance</p>
                        <p className="text-4xl font-bold text-purple-100">
                          ₨
                          {(balance.pkr || 0).toLocaleString("en-PK", {
                            maximumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-500/30 rounded-xl flex items-center justify-center border border-purple-500/30">
                        <span className="text-xl font-bold text-purple-300">৳</span>
                      </div>
                    </div>
                    <p className="text-xs text-purple-300/50">Pakistani Rupee</p>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 gap-3 mt-6">
                <Button
                  onClick={() => setActiveTab("deposit")}
                  className="w-full bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 hover:from-green-700 hover:via-green-600 hover:to-emerald-700 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-green-500/20 transition-all duration-300 text-base"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Funds
                </Button>
                <Button
                  onClick={() => setActiveTab("exchange")}
                  className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 hover:from-purple-700 hover:via-purple-600 hover:to-blue-700 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all duration-300 text-base"
                >
                  <ArrowRightLeft className="h-5 w-5 mr-2" />
                  Exchange
                </Button>
                <Button
                  onClick={() => navigate("/fiat/transactions")}
                  className="w-full bg-gradient-to-r from-gray-700/50 to-gray-800/50 hover:from-gray-600/60 hover:to-gray-700/60 text-gray-100 font-semibold py-6 rounded-xl border border-gray-600/30 backdrop-blur transition-all duration-300 text-base"
                >
                  <History className="h-5 w-5 mr-2" />
                  Transaction History
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Deposit Tab */}
          <TabsContent value="deposit" className="mt-6">
            <FiatDeposit onRefresh={() => fetchBalance()} />
          </TabsContent>

          {/* Withdraw Tab */}
          <TabsContent value="withdraw" className="mt-6">
            <FiatWithdraw balance={balance} onRefresh={() => fetchBalance()} />
          </TabsContent>

          {/* Exchange Tab */}
          <TabsContent value="exchange" className="mt-6">
            <FiatExchange
              balance={balance}
              priceRatio={priceRatio}
              onRefresh={() => fetchBalance()}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Deposit Component
function FiatDeposit({ onRefresh }: { onRefresh: () => void }) {
  const { wallet } = useWallet();
  const [currency, setCurrency] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    if (!wallet || !amount) {
      toast.error("Please enter an amount");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      console.log("[Deposit] Sending request:", { wallet, currency, amount: numAmount, paymentMethod });

      const response = await fetch("/api/fiat/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          currency,
          amount: numAmount,
          paymentMethod,
        }),
      });

      const data = await response.json();
      console.log("[Deposit] Response:", { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error || data.details || "Deposit failed";
        toast.error(errorMsg);
        return;
      }

      toast.success(`Successfully deposited ${amount} ${currency}`);
      setAmount("");
      onRefresh();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Deposit error:", errorMsg);
      toast.error(`Failed to process deposit: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-green-600/20 to-emerald-700/10 rounded-2xl p-6 border border-green-500/20 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-green-100">Deposit Funds</h3>
          <div className="w-12 h-12 bg-green-500/30 rounded-xl flex items-center justify-center border border-green-500/30">
            <Plus className="h-6 w-6 text-green-300" />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-xl text-white font-medium focus:outline-none focus:border-green-500/50 transition-colors"
            >
              <option value="USDT">USDT (US Dollar Token)</option>
              <option value="PKR">PKR (Pakistani Rupee)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-xl text-white placeholder-gray-500 font-medium focus:outline-none focus:border-green-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-xl text-white font-medium focus:outline-none focus:border-green-500/50 transition-colors"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="easypaisa">Easypaisa</option>
              <option value="jazzc ash">JazzCash</option>
              <option value="nayapay">Nayapay</option>
              <option value="hbl_mobile">HBL Mobile</option>
              <option value="fawry">Fawry</option>
            </select>
          </div>

          <Button
            onClick={handleDeposit}
            disabled={loading || !amount}
            className="w-full bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 hover:from-green-700 hover:via-green-600 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-green-500/20 disabled:opacity-50 transition-all duration-300 mt-2"
          >
            {loading ? "Processing..." : "Deposit Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Withdraw Component
function FiatWithdraw({
  balance,
  onRefresh,
}: {
  balance: UserBalance | null;
  onRefresh: () => void;
}) {
  const { wallet } = useWallet();
  const [currency, setCurrency] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [loading, setLoading] = useState(false);

  const handleWithdraw = async () => {
    if (!wallet || !amount) {
      toast.error("Please enter an amount");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const currentBalance = currency === "USDT" ? balance?.usdt : balance?.pkr;
    if (!currentBalance || currentBalance < numAmount) {
      toast.error(`Insufficient ${currency} balance. Available: ${currentBalance || 0} ${currency}`);
      return;
    }

    setLoading(true);
    try {
      console.log("[Withdraw] Sending request:", { wallet, currency, amount: numAmount, paymentMethod });

      const response = await fetch("/api/fiat/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          currency,
          amount: numAmount,
          paymentMethod,
        }),
      });

      const data = await response.json();
      console.log("[Withdraw] Response:", { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error || data.details || "Withdrawal failed";
        toast.error(errorMsg);
        return;
      }

      toast.success(`Successfully withdrawn ${amount} ${currency}`);
      setAmount("");
      onRefresh();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Withdrawal error:", errorMsg);
      toast.error(`Failed to process withdrawal: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-red-600/20 to-orange-700/10 rounded-2xl p-6 border border-red-500/20 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-red-100">Withdraw Funds</h3>
          <div className="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center border border-red-500/30">
            <Send className="h-6 w-6 text-red-300" />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-xl text-white font-medium focus:outline-none focus:border-red-500/50 transition-colors"
            >
              <option value="USDT">USDT (US Dollar Token)</option>
              <option value="PKR">PKR (Pakistani Rupee)</option>
            </select>
          </div>

          <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/30">
            <p className="text-xs font-semibold text-gray-400 mb-1">AVAILABLE BALANCE</p>
            <p className="text-lg font-bold text-gray-100">
              {currency === "USDT" ? "$" : "₨"}
              {currency === "USDT"
                ? (balance?.usdt?.toFixed(2) ?? "0.00")
                : (balance?.pkr?.toLocaleString("en-PK", {
                    maximumFractionDigits: 0,
                  }) ?? "0.00")}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Amount to Withdraw</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-xl text-white placeholder-gray-500 font-medium focus:outline-none focus:border-red-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Withdrawal Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-xl text-white font-medium focus:outline-none focus:border-red-500/50 transition-colors"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="easypaisa">Easypaisa</option>
              <option value="jazzc ash">JazzCash</option>
              <option value="nayapay">Nayapay</option>
              <option value="hbl_mobile">HBL Mobile</option>
              <option value="fawry">Fawry</option>
            </select>
          </div>

          <Button
            onClick={handleWithdraw}
            disabled={loading || !amount}
            className="w-full bg-gradient-to-r from-red-600 via-red-500 to-orange-600 hover:from-red-700 hover:via-red-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-red-500/20 disabled:opacity-50 transition-all duration-300 mt-2"
          >
            {loading ? "Processing..." : "Withdraw Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Exchange Component
function FiatExchange({
  balance,
  priceRatio,
  onRefresh,
}: {
  balance: UserBalance | null;
  priceRatio: PriceRatio | null;
  onRefresh: () => void;
}) {
  const { wallet } = useWallet();
  const [fromCurrency, setFromCurrency] = useState("USDT");
  const [toAmount, setToAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const toCurrency = fromCurrency === "USDT" ? "PKR" : "USDT";

  const handleExchange = async () => {
    if (!wallet || !toAmount) {
      toast.error("Please enter an amount");
      return;
    }

    const numAmount = parseFloat(toAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      console.log("[Exchange] Sending request:", { wallet, fromCurrency, toAmount: numAmount, toCurrency });

      const response = await fetch("/api/fiat/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          fromCurrency,
          toAmount: numAmount,
        }),
      });

      const data = await response.json();
      console.log("[Exchange] Response:", { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error || data.details || "Exchange failed";
        toast.error(errorMsg);
        return;
      }

      const exchangedAmount = data.transaction?.fromAmount || numAmount;
      const receivedAmount = data.transaction?.toAmount || numAmount;

      toast.success(
        `Successfully exchanged ${exchangedAmount.toFixed(2)} ${fromCurrency} for ${receivedAmount.toFixed(2)} ${toCurrency}`,
      );
      setToAmount("");
      onRefresh();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Exchange error:", errorMsg);
      toast.error(`Failed to process exchange: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const currentBalance = fromCurrency === "USDT" ? balance?.usdt : balance?.pkr;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-purple-600/20 to-pink-700/10 rounded-2xl p-6 border border-purple-500/20 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-purple-100">Exchange Currency</h3>
          <div className="w-12 h-12 bg-purple-500/30 rounded-xl flex items-center justify-center border border-purple-500/30">
            <ArrowRightLeft className="h-6 w-6 text-purple-300" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30 backdrop-blur">
              <p className="text-blue-300/70 text-xs font-semibold uppercase tracking-wider mb-2">From</p>
              <p className="text-xl font-bold text-blue-100 mb-2">{fromCurrency}</p>
              <p className="text-xs text-blue-300/60">
                Available: {fromCurrency === "USDT" ? "$" : "₨"}
                {fromCurrency === "USDT"
                  ? (currentBalance?.toFixed(2) ?? "0.00")
                  : (currentBalance?.toLocaleString("en-PK", {
                      maximumFractionDigits: 0,
                    }) ?? "0.00")}
              </p>
            </div>

            <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 rounded-xl p-4 border border-pink-500/30 backdrop-blur">
              <p className="text-pink-300/70 text-xs font-semibold uppercase tracking-wider mb-2">To</p>
              <p className="text-xl font-bold text-pink-100 mb-2">{toCurrency}</p>
              <p className="text-xs text-pink-300/60">Receive amount</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Enter Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={toAmount}
              onChange={(e) => setToAmount(e.target.value)}
              placeholder={`Enter ${fromCurrency} amount`}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-xl text-white placeholder-gray-500 font-medium focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          {priceRatio && toAmount && priceRatio.usdtToPkr && (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/30 rounded-xl p-4 border border-gray-700/30 backdrop-blur">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Exchange Rate</span>
                  <span className="font-semibold text-gray-200">1 {fromCurrency} = {fromCurrency === "USDT"
                    ? priceRatio.usdtToPkr.toFixed(2)
                    : (1 / priceRatio.usdtToPkr).toFixed(4)} {toCurrency}</span>
                </div>
                {fromCurrency === "USDT" && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
                    <span className="text-gray-400">You will receive</span>
                    <span className="font-semibold text-green-300">≈ {(parseFloat(toAmount) / priceRatio.usdtToPkr).toFixed(0)} {toCurrency}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button
            onClick={handleExchange}
            disabled={loading || !toAmount}
            className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-600 hover:from-purple-700 hover:via-purple-600 hover:to-pink-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 transition-all duration-300 mt-2"
          >
            {loading ? "Processing..." : "Confirm Exchange"}
          </Button>
        </div>
      </div>
    </div>
  );
}
