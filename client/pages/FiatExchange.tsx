import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { PaymentMethod, getPaymentMethods } from "@/lib/payment-utils";
import { PaymentMethodSetup } from "@/components/ui/PaymentMethodSetup";

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

export default function FiatExchange() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [priceRatio, setPriceRatio] = useState<PriceRatio | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [exchangeMode, setExchangeMode] = useState<"USDT-FIAT" | "FIAT-USDT">(
    "USDT-FIAT",
  );
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (wallet) {
        try {
          const response = await fetch(`/api/fiat/balance?wallet=${wallet}`);
          if (response.ok) {
            const data = await response.json();
            setBalance(data);
          }

          const ratioResponse = await fetch("/api/fiat/price-ratio");
          if (ratioResponse.ok) {
            const data = await ratioResponse.json();
            setPriceRatio(data);
          }

          const { latestMethod } = await getPaymentMethods(wallet);
          setPaymentMethod(latestMethod);
        } catch (error) {
          console.error("Error loading data:", error);
        }
      }
    };

    loadData();
  }, [wallet]);

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
      navigate("/fiat");
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
  const currentBalance = fromCurrency === "USDT" ? balance?.usdt : balance?.pkr;

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
      <div className="w-full max-w-lg mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            onClick={() => navigate("/fiat")}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            BACK
          </Button>
        </div>

        {/* Exchange Card */}
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

            {paymentMethod ? (
              <>
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

                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                    <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">
                      Exchange via ID
                    </p>
                    <p className="text-lg font-bold text-purple-300 font-mono">
                      {paymentMethod.userId}
                    </p>
                  </div>

                  {priceRatio && amount && (
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/30 rounded-xl p-4 border border-gray-700/30 backdrop-blur">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 uppercase font-semibold">
                            Exchange Rate
                          </span>
                          <span className="font-semibold text-gray-200">
                            1 {fromCurrency} ={" "}
                            {fromCurrency === "USDT"
                              ? priceRatio.usdtToPkr.toFixed(2)
                              : (1 / priceRatio.usdtToPkr).toFixed(4)}{" "}
                            {toCurrency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-gray-700/30">
                          <span className="text-gray-400 uppercase font-semibold">
                            You will receive
                          </span>
                          <span className="font-semibold text-green-300">
                            ≈{" "}
                            {fromCurrency === "USDT"
                              ? (parseFloat(amount) * priceRatio.usdtToPkr).toFixed(0)
                              : (parseFloat(amount) / priceRatio.usdtToPkr).toFixed(
                                  2,
                                )}{" "}
                            {toCurrency}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleExchange}
                    disabled={loading || !amount}
                    className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-600 hover:from-purple-700 hover:via-purple-600 hover:to-pink-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 transition-all duration-300 mt-2 uppercase"
                  >
                    {loading ? "Processing..." : "Confirm Exchange"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <PaymentMethodSetup
                  wallet={wallet}
                  onMethodSaved={(method) => {
                    setPaymentMethod(method);
                    toast.success("Payment method created successfully!");
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
