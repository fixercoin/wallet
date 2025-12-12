import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Send } from "lucide-react";
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

export default function FiatWithdraw() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [currency, setCurrency] = useState("USDT");
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

          const { latestMethod } = await getPaymentMethods(wallet);
          setPaymentMethod(latestMethod);
        } catch (error) {
          console.error("Error loading data:", error);
        }
      }
    };

    loadData();
  }, [wallet]);

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
      navigate("/fiat");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Withdrawal error:", errorMsg);
      toast.error(`Failed to process withdrawal: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

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

        {/* Withdraw Card */}
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-red-600/20 to-orange-700/10 rounded-2xl p-6 border border-red-500/20 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-100 uppercase">
                Withdraw Funds
              </h3>
              <div className="w-12 h-12 bg-red-500/30 rounded-xl flex items-center justify-center border border-red-500/30">
                <Send className="h-6 w-6 text-red-300" />
              </div>
            </div>

            {paymentMethod ? (
              <>
                <div className="bg-gray-800/50 rounded-lg p-3 mb-4 border border-gray-700/30">
                  <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">
                    WITHDRAW TO ID
                  </p>
                  <p className="text-lg font-bold text-red-300 font-mono">
                    {paymentMethod.userId}
                  </p>
                </div>

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
                    <p className="text-xs font-semibold text-gray-400 mb-1 uppercase">
                      AVAILABLE BALANCE
                    </p>
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
                    disabled={loading || !amount}
                    className="w-full bg-gradient-to-r from-red-600 via-red-500 to-orange-600 hover:from-red-700 hover:via-red-600 hover:to-orange-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-red-500/20 disabled:opacity-50 transition-all duration-300 mt-2 uppercase"
                  >
                    {loading ? "Processing..." : "Withdraw Now"}
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
