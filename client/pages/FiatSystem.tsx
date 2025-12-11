import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, Plus, ArrowRightLeft, History, Settings } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

// Admin wallets - keep in sync with FiatAdmin.tsx
const ADMIN_WALLETS = [
  "FxmrDJB16th5FeZ3RBwAScwxt6iGz5pmpKGisTJQcWMf",
];

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
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [priceRatio, setPriceRatio] = useState<PriceRatio | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("balance");

  const fetchBalance = async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(
        `/api/fiat/balance?wallet=${publicKey.toString()}`,
      );
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error("Error fetching balance:", error);
      toast.error("Failed to fetch balance");
    }
  };

  const fetchPriceRatio = async () => {
    try {
      const response = await fetch("/api/fiat/price-ratio");
      const data = await response.json();
      setPriceRatio(data);
    } catch (error) {
      console.error("Error fetching price ratio:", error);
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
  }, [publicKey]);

  if (!publicKey) {
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
          {publicKey && ADMIN_WALLETS.includes(publicKey.toString()) && (
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
          {publicKey && !ADMIN_WALLETS.includes(publicKey.toString()) && (
            <div className="w-10" />
          )}
        </div>

        {/* Balance Card */}
        {balance && (
          <Card className="mb-6 bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-lg">Your Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">USDT Balance</p>
                  <p className="text-2xl font-bold text-blue-400">
                    ${balance.usdt.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">PKR Balance</p>
                  <p className="text-2xl font-bold text-purple-400">
                    ₨{balance.pkr.toLocaleString("en-PK", { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {priceRatio && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400">
                    Exchange Rate: 1 USDT = {priceRatio.usdtToPkr} PKR
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800/50 border border-gray-700">
            <TabsTrigger value="balance" className="text-xs">
              <span className="hidden sm:inline">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="deposit" className="text-xs">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Deposit</span>
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="text-xs">
              <Send className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Withdraw</span>
            </TabsTrigger>
            <TabsTrigger value="exchange" className="text-xs">
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Exchange</span>
            </TabsTrigger>
          </TabsList>

          {/* Balance Tab */}
          <TabsContent value="balance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Balance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {balance && (
                    <>
                      <div className="p-4 bg-gray-800/50 rounded-lg">
                        <p className="text-gray-400 text-sm mb-2">
                          USDT (US Dollar Token)
                        </p>
                        <p className="text-3xl font-bold text-blue-400">
                          ${balance.usdt.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-800/50 rounded-lg">
                        <p className="text-gray-400 text-sm mb-2">
                          PKR (Pakistani Rupee)
                        </p>
                        <p className="text-3xl font-bold text-purple-400">
                          ₨{balance.pkr.toLocaleString("en-PK", { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </>
                  )}
                  <Button
                    onClick={() => setActiveTab("deposit")}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2 rounded-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Funds
                  </Button>
                  <Button
                    onClick={() => setActiveTab("exchange")}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 rounded-lg"
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Exchange
                  </Button>
                  <Button
                    onClick={() => navigate("/fiat/transactions")}
                    variant="outline"
                    className="w-full border-gray-700 text-gray-300 hover:text-white"
                  >
                    <History className="h-4 w-4 mr-2" />
                    Transaction History
                  </Button>
                </div>
              </CardContent>
            </Card>
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
  const { publicKey } = useWallet();
  const [currency, setCurrency] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    if (!publicKey || !amount) {
      toast.error("Please enter an amount");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/fiat/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          currency,
          amount: parseFloat(amount),
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Deposit failed");
        return;
      }

      toast.success(`Deposited ${amount} ${currency}`);
      setAmount("");
      onRefresh();
    } catch (error) {
      console.error("Deposit error:", error);
      toast.error("Failed to process deposit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deposit Funds</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="USDT">USDT (US Dollar Token)</option>
            <option value="PKR">PKR (Pakistani Rupee)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
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
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Processing..." : "Deposit"}
        </Button>
      </CardContent>
    </Card>
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
  const { publicKey } = useWallet();
  const [currency, setCurrency] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [loading, setLoading] = useState(false);

  const handleWithdraw = async () => {
    if (!publicKey || !amount) {
      toast.error("Please enter an amount");
      return;
    }

    const currentBalance =
      currency === "USDT" ? balance?.usdt : balance?.pkr;
    if (!currentBalance || currentBalance < parseFloat(amount)) {
      toast.error(`Insufficient ${currency} balance`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/fiat/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          currency,
          amount: parseFloat(amount),
          paymentMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Withdrawal failed");
        return;
      }

      toast.success(`Withdrawn ${amount} ${currency}`);
      setAmount("");
      onRefresh();
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast.error("Failed to process withdrawal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw Funds</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            <option value="USDT">USDT (US Dollar Token)</option>
            <option value="PKR">PKR (Pakistani Rupee)</option>
          </select>
        </div>

        <div>
          <p className="text-sm text-gray-400 mb-2">
            Available: {currency === "USDT" ? "$" : "₨"}
            {currency === "USDT"
              ? balance?.usdt.toFixed(2)
              : balance?.pkr.toLocaleString("en-PK", { maximumFractionDigits: 2 })}
          </p>
          <label className="block text-sm font-medium mb-2">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Withdrawal Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
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
          className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Processing..." : "Withdraw"}
        </Button>
      </CardContent>
    </Card>
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
  const { publicKey } = useWallet();
  const [fromCurrency, setFromCurrency] = useState("USDT");
  const [toAmount, setToAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const toCurrency = fromCurrency === "USDT" ? "PKR" : "USDT";

  const handleExchange = async () => {
    if (!publicKey || !toAmount) {
      toast.error("Please enter an amount");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/fiat/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          fromCurrency,
          toAmount: parseFloat(toAmount),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Exchange failed");
        return;
      }

      toast.success(
        `Exchanged ${data.transaction.fromAmount} ${fromCurrency} for ${data.transaction.toAmount} ${toCurrency}`,
      );
      setToAmount("");
      onRefresh();
    } catch (error) {
      console.error("Exchange error:", error);
      toast.error("Failed to process exchange");
    } finally {
      setLoading(false);
    }
  };

  const currentBalance =
    fromCurrency === "USDT" ? balance?.usdt : balance?.pkr;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exchange Currency</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-gray-800/50 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">From</p>
          <p className="text-lg font-semibold text-white">{fromCurrency}</p>
          <p className="text-xs text-gray-400 mt-2">
            Available: {fromCurrency === "USDT" ? "$" : "₨"}
            {fromCurrency === "USDT"
              ? currentBalance?.toFixed(2)
              : currentBalance?.toLocaleString("en-PK", { maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="p-3 bg-gray-800/50 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">To</p>
          <p className="text-lg font-semibold text-white">{toCurrency}</p>
          <label className="block text-sm font-medium mb-2 mt-3">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={toAmount}
            onChange={(e) => setToAmount(e.target.value)}
            placeholder={`Enter ${toCurrency} amount`}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500"
          />
        </div>

        {priceRatio && toAmount && (
          <div className="text-xs text-gray-400">
            <p>
              Exchange Rate: 1 {fromCurrency} = {fromCurrency === "USDT" ? priceRatio.usdtToPkr : (1 / priceRatio.usdtToPkr).toFixed(4)} {toCurrency}
            </p>
            {fromCurrency === "USDT" && (
              <p className="mt-1">
                You will receive ≈ {(parseFloat(toAmount) / priceRatio.usdtToPkr).toFixed(2)} {fromCurrency}
              </p>
            )}
          </div>
        )}

        <Button
          onClick={handleExchange}
          disabled={loading || !toAmount}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Processing..." : "Exchange"}
        </Button>
      </CardContent>
    </Card>
  );
}
