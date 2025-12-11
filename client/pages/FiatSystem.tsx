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
  TrendingUp,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { PaymentMethodSetup } from "@/components/ui/PaymentMethodSetup";
import { getPaymentMethods, PaymentMethod, PaymentMethodData } from "@/lib/payment-utils";

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
  const [activeTab, setActiveTab] = useState("home");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

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
    }
  };

  const fetchPaymentMethods = async () => {
    if (!wallet) return;

    try {
      const { latestMethod } = await getPaymentMethods(wallet);
      setPaymentMethod(latestMethod);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (wallet) {
        await Promise.all([
          fetchBalance(),
          fetchPriceRatio(),
          fetchPaymentMethods(),
        ]);
      }
      setLoading(false);
    };

    loadData();
    const interval = setInterval(loadData, 30000);
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

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-gray-800/40 to-gray-900/40 border border-gray-700/30 backdrop-blur-xl rounded-xl p-1 gap-1">
            <TabsTrigger
              value="home"
              className="text-xs rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500/30 data-[state=active]:to-purple-500/30 data-[state=active]:border data-[state=active]:border-blue-500/30 transition-all duration-200"
            >
              HOME
            </TabsTrigger>
            <TabsTrigger
              value="payment"
              className="text-xs rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:border data-[state=active]:border-purple-500/30 transition-all duration-200"
            >
              PAYMENT
            </TabsTrigger>
          </TabsList>

          {/* HOME TAB - Main Dashboard */}
          <TabsContent value="home" className="mt-6 animate-in fade-in duration-300">
            <div className="space-y-6">
              {/* Total Balance Card */}
              {balance && (
                <Card className="bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent border-purple-500/20 rounded-2xl shadow-2xl overflow-hidden">
                  <CardContent className="pt-8 pb-6 px-6">
                    <div className="text-center space-y-4">
                      {/* Total Balance Section */}
                      <div>
                        <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">
                          TOTAL BALANCE
                        </p>
                        <div className="text-5xl font-bold text-white mb-3">
                          {balance.usdt.toFixed(2)} $
                        </div>
                        <div className="text-lg text-gray-300 font-semibold">
                          {balance.usdt.toFixed(2)} $ - {(balance.pkr || 0).toFixed(2)} PKR
                        </div>
                      </div>

                      {/* Three Main Buttons */}
                      <div className="grid grid-cols-3 gap-3 pt-6">
                        <Button
                          onClick={() => setActiveTab("deposit")}
                          className="flex flex-col items-center justify-center py-8 rounded-xl font-bold uppercase text-sm bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-green-500/30 transition-all duration-300"
                        >
                          <Plus className="h-6 w-6 mb-2" />
                          DEPOSIT
                        </Button>

                        <Button
                          onClick={() => setActiveTab("withdraw")}
                          className="flex flex-col items-center justify-center py-8 rounded-xl font-bold uppercase text-sm bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg hover:shadow-red-500/30 transition-all duration-300"
                        >
                          <Send className="h-6 w-6 mb-2" />
                          WITHDRAW
                        </Button>

                        <Button
                          onClick={() => setActiveTab("exchange")}
                          className="flex flex-col items-center justify-center py-8 rounded-xl font-bold uppercase text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
                        >
                          <ArrowRightLeft className="h-6 w-6 mb-2" />
                          EXCHANGE
                        </Button>
                      </div>

                      {/* Token Image - 300x300px */}
                      <div className="flex justify-center py-4">
                        <div className="w-72 h-72 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-2xl shadow-2xl flex items-center justify-center border border-white/10 overflow-hidden">
                          <img
                            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='grad'%3E%3Cstop offset='0%25' style='stop-color:%23a78bfa;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%236366f1;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='100' cy='100' r='95' fill='url(%23grad)'/%3E%3Ctext x='50%25' y='50%25' font-size='80' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central' font-family='Arial'%3E%24%3C/text%3E%3C/svg%3E"
                            alt="Token Icon"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* Payment Method Button */}
                      <Button
                        onClick={() => setActiveTab("payment")}
                        className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-600 hover:from-purple-700 hover:via-purple-600 hover:to-pink-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all duration-300 uppercase"
                      >
                        PAYMENT METHOD
                      </Button>

                      {/* Exchange Rate */}
                      {priceRatio && (
                        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30 mt-4">
                          <p className="text-xs text-gray-400 mb-1 uppercase font-semibold">EXCHANGE RATE</p>
                          <p className="text-lg font-bold text-gray-200">
                            1 USDT = {priceRatio.usdtToPkr.toFixed(2)} PKR
                          </p>
                        </div>
                      )}

                      {/* Transaction History Button */}
                      <Button
                        onClick={() => navigate("/fiat/transactions")}
                        className="w-full mt-4 bg-gradient-to-r from-gray-700/50 to-gray-800/50 hover:from-gray-600/60 hover:to-gray-700/60 text-gray-100 font-semibold py-3 rounded-xl border border-gray-600/30 backdrop-blur transition-all duration-300 uppercase"
                      >
                        <History className="h-5 w-5 mr-2" />
                        Transaction History
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* PAYMENT TAB */}
          <TabsContent value="payment" className="mt-6 animate-in fade-in duration-300">
            <div className="space-y-4">
              {paymentMethod ? (
                <>
                  <Card className="bg-gradient-to-br from-green-600/20 to-emerald-700/10 border-green-500/20 rounded-2xl shadow-xl">
                    <CardContent className="pt-6">
                      <div className="text-center mb-6">
                        <p className="text-green-300 text-sm font-bold uppercase mb-2">Active Payment Method</p>
                        <h3 className="text-3xl font-bold text-white font-mono">{paymentMethod.userId}</h3>
                      </div>

                      <div className="bg-gray-800/50 rounded-xl p-4 space-y-3 border border-gray-700/30">
                        <div className="text-left">
                          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">METHOD</p>
                          <p className="text-white font-semibold">{paymentMethod.name}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">WALLET</p>
                          <p className="text-white font-mono text-sm break-all">{paymentMethod.walletAddress}</p>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 text-center mt-4">
                        Use this ID to receive fiat and crypto transfers
                      </p>

                      <Button
                        onClick={() => setPaymentMethod(null)}
                        className="w-full mt-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-2 rounded-lg uppercase"
                      >
                        Add New Method
                      </Button>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <PaymentMethodSetup
                  wallet={wallet}
                  onMethodSaved={(method) => {
                    setPaymentMethod(method);
                    toast.success("Payment method created successfully!");
                  }}
                />
              )}
            </div>
          </TabsContent>

          {/* DEPOSIT TAB */}
          <TabsContent value="deposit" className="mt-6">
            <FiatDeposit onRefresh={() => fetchBalance()} paymentMethod={paymentMethod} />
          </TabsContent>

          {/* WITHDRAW TAB */}
          <TabsContent value="withdraw" className="mt-6">
            <FiatWithdraw
              balance={balance}
              onRefresh={() => fetchBalance()}
              paymentMethod={paymentMethod}
            />
          </TabsContent>

          {/* EXCHANGE TAB */}
          <TabsContent value="exchange" className="mt-6">
            <FiatExchange
              balance={balance}
              priceRatio={priceRatio}
              onRefresh={() => fetchBalance()}
              paymentMethod={paymentMethod}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Deposit Component
function FiatDeposit({
  onRefresh,
  paymentMethod,
}: {
  onRefresh: () => void;
  paymentMethod: PaymentMethod | null;
}) {
  const { wallet } = useWallet();
  const [currency, setCurrency] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    if (!wallet || !amount) {
      toast.error("Please enter an amount");
      return;
    }

    if (!paymentMethod) {
      toast.error("Please setup a payment method first");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/fiat/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          currency,
          amount: numAmount,
          paymentMethod: paymentMethod.name,
          userId: paymentMethod.userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.details || "Deposit failed";
        toast.error(errorMsg);
        return;
      }

      updatePaymentMethodLastUsed(paymentMethod.id);
      toast.success(
        `Successfully deposited ${amount} ${currency} to ID: ${paymentMethod.userId}`,
      );
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
          <h3 className="text-2xl font-bold text-green-100 uppercase">Deposit Funds</h3>
          <div className="w-12 h-12 bg-green-500/30 rounded-xl flex items-center justify-center border border-green-500/30">
            <Plus className="h-6 w-6 text-green-300" />
          </div>
        </div>

        {paymentMethod && (
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4 border border-gray-700/30">
            <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">DEPOSIT TO ID</p>
            <p className="text-lg font-bold text-green-300 font-mono">{paymentMethod.userId}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
              Currency
            </label>
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
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
              Amount
            </label>
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

          <Button
            onClick={handleDeposit}
            disabled={loading || !amount || !paymentMethod}
            className="w-full bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 hover:from-green-700 hover:via-green-600 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-green-500/20 disabled:opacity-50 transition-all duration-300 mt-2 uppercase"
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
  paymentMethod,
}: {
  balance: UserBalance | null;
  onRefresh: () => void;
  paymentMethod: PaymentMethod | null;
}) {
  const { wallet } = useWallet();
  const [currency, setCurrency] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleWithdraw = async () => {
    if (!wallet || !amount) {
      toast.error("Please enter an amount");
      return;
    }

    if (!paymentMethod) {
      toast.error("Please setup a payment method first");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const currentBalance = currency === "USDT" ? balance?.usdt : balance?.pkr;
    if (!currentBalance || currentBalance < numAmount) {
      toast.error(
        `Insufficient ${currency} balance. Available: ${currentBalance || 0} ${currency}`,
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/fiat/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          currency,
          amount: numAmount,
          paymentMethod: paymentMethod.name,
          userId: paymentMethod.userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.details || "Withdrawal failed";
        toast.error(errorMsg);
        return;
      }

      toast.success(
        `Successfully withdrawn ${amount} ${currency} to ID: ${paymentMethod.userId}`,
      );
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
          <h3 className="text-2xl font-bold text-red-100 uppercase">Withdraw Funds</h3>
          <div className="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center border border-red-500/30">
            <Send className="h-6 w-6 text-red-300" />
          </div>
        </div>

        {paymentMethod && (
          <div className="bg-gray-800/50 rounded-lg p-3 mb-4 border border-gray-700/30">
            <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">WITHDRAW TO ID</p>
            <p className="text-lg font-bold text-red-300 font-mono">{paymentMethod.userId}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
              Currency
            </label>
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
            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase">AVAILABLE BALANCE</p>
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
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
              Amount to Withdraw
            </label>
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

          <Button
            onClick={handleWithdraw}
            disabled={loading || !amount || !paymentMethod}
            className="w-full bg-gradient-to-r from-red-600 via-red-500 to-orange-600 hover:from-red-700 hover:via-red-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-red-500/20 disabled:opacity-50 transition-all duration-300 mt-2 uppercase"
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
  paymentMethod,
}: {
  balance: UserBalance | null;
  priceRatio: PriceRatio | null;
  onRefresh: () => void;
  paymentMethod: PaymentMethod | null;
}) {
  const { wallet } = useWallet();
  const [exchangeMode, setExchangeMode] = useState<"USDT-FIAT" | "FIAT-USDT">(
    "USDT-FIAT",
  );
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExchange = async () => {
    if (!wallet || !amount) {
      toast.error("Please enter an amount");
      return;
    }

    if (!paymentMethod) {
      toast.error("Please setup a payment method first");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const fromCurrency = exchangeMode === "USDT-FIAT" ? "USDT" : "PKR";
    const currentBalance =
      fromCurrency === "USDT" ? balance?.usdt : balance?.pkr;

    if (!currentBalance || currentBalance < numAmount) {
      toast.error(
        `Insufficient ${fromCurrency} balance. Available: ${currentBalance || 0} ${fromCurrency}`,
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/fiat/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          fromCurrency,
          toAmount: numAmount,
          userId: paymentMethod.userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || data.details || "Exchange failed";
        toast.error(errorMsg);
        return;
      }

      const toCurrency = exchangeMode === "USDT-FIAT" ? "PKR" : "USDT";
      toast.success(
        `Successfully exchanged ${numAmount} ${fromCurrency} to ${toCurrency}`,
      );
      setAmount("");
      onRefresh();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Exchange error:", errorMsg);
      toast.error(`Failed to process exchange: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const fromCurrency = exchangeMode === "USDT-FIAT" ? "USDT" : "PKR";
  const toCurrency = exchangeMode === "USDT-FIAT" ? "PKR" : "USDT";
  const currentBalance =
    fromCurrency === "USDT" ? balance?.usdt : balance?.pkr;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-gradient-to-br from-purple-600/20 to-pink-700/10 rounded-2xl p-6 border border-purple-500/20 backdrop-blur-xl shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-purple-100 uppercase">
            Exchange Currency
          </h3>
          <div className="w-12 h-12 bg-purple-500/30 rounded-xl flex items-center justify-center border border-purple-500/30">
            <ArrowRightLeft className="h-6 w-6 text-purple-300" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setExchangeMode("USDT-FIAT")}
              variant={exchangeMode === "USDT-FIAT" ? "default" : "outline"}
              className={`uppercase font-bold py-2 rounded-lg transition-all ${
                exchangeMode === "USDT-FIAT"
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                  : "border-gray-600/30 text-gray-400 hover:text-gray-300"
              }`}
            >
              USDT → PKR
            </Button>
            <Button
              onClick={() => setExchangeMode("FIAT-USDT")}
              variant={exchangeMode === "FIAT-USDT" ? "default" : "outline"}
              className={`uppercase font-bold py-2 rounded-lg transition-all ${
                exchangeMode === "FIAT-USDT"
                  ? "bg-gradient-to-r from-pink-600 to-pink-700 text-white"
                  : "border-gray-600/30 text-gray-400 hover:text-gray-300"
              }`}
            >
              PKR → USDT
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl p-4 border border-blue-500/30 backdrop-blur">
              <p className="text-blue-300/70 text-xs font-semibold uppercase tracking-wider mb-2">
                From
              </p>
              <p className="text-xl font-bold text-blue-100 mb-2">
                {fromCurrency}
              </p>
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
              <p className="text-pink-300/70 text-xs font-semibold uppercase tracking-wider mb-2">
                To
              </p>
              <p className="text-xl font-bold text-pink-100 mb-2">
                {toCurrency}
              </p>
              <p className="text-xs text-pink-300/60">Receive amount</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase">
              Enter Amount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter ${fromCurrency} amount`}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 backdrop-blur rounded-xl text-white placeholder-gray-500 font-medium focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          {paymentMethod && (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
              <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">Exchange via ID</p>
              <p className="text-lg font-bold text-purple-300 font-mono">{paymentMethod.userId}</p>
            </div>
          )}

          {priceRatio && amount && (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/30 rounded-xl p-4 border border-gray-700/30 backdrop-blur">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 uppercase font-semibold">Exchange Rate</span>
                  <span className="font-semibold text-gray-200">
                    1 {fromCurrency} ={" "}
                    {fromCurrency === "USDT"
                      ? priceRatio.usdtToPkr.toFixed(2)
                      : (1 / priceRatio.usdtToPkr).toFixed(4)}{" "}
                    {toCurrency}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
                  <span className="text-gray-400 uppercase font-semibold">You will receive</span>
                  <span className="font-semibold text-green-300">
                    ≈{" "}
                    {fromCurrency === "USDT"
                      ? (parseFloat(amount) * priceRatio.usdtToPkr).toFixed(0)
                      : (parseFloat(amount) / priceRatio.usdtToPkr).toFixed(2)}{" "}
                    {toCurrency}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleExchange}
            disabled={loading || !amount || !paymentMethod}
            className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-600 hover:from-purple-700 hover:via-purple-600 hover:to-pink-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 transition-all duration-300 mt-2 uppercase"
          >
            {loading ? "Processing..." : "Confirm Exchange"}
          </Button>
        </div>
      </div>
    </div>
  );
}
