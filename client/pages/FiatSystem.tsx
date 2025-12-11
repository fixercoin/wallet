import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send,
  Plus,
  ArrowRightLeft,
  History,
  Settings,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { PaymentMethodSetup } from "@/components/ui/PaymentMethodSetup";
import { getPaymentMethods, PaymentMethod } from "@/lib/payment-utils";

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
  const { wallet } = useWallet();
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [priceRatio, setPriceRatio] = useState<PriceRatio | null>(null);
  const [loading, setLoading] = useState(true);

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

        {/* Main Dashboard - Balance Card */}
        <div className="space-y-6">
          {/* Total Balance Card */}
          {balance && (
            <Card className="bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent border-purple-500/20 rounded-2xl shadow-2xl overflow-hidden">
              <CardContent className="pt-8 pb-6 px-6">
                <div className="text-center space-y-4">
                  {/* Total Balance Section */}
                  <div>
                    <div className="text-5xl font-bold text-white mb-3">
                      {balance.usdt.toFixed(2)} $
                    </div>
                    <div className="text-lg text-gray-300 font-semibold">
                      {balance.usdt.toFixed(2)} $ -{" "}
                      {(balance.pkr || 0).toFixed(2)} PKR
                    </div>
                  </div>

                  {/* Three Main Buttons */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <Button
                      onClick={() => navigate("/fiat/deposit")}
                      className="flex flex-col items-center justify-center py-8 rounded-xl font-bold uppercase text-sm bg-transparent border border-green-500 text-green-400 hover:bg-green-500/10 transition-all duration-300"
                    >
                      <Plus className="h-6 w-6" />
                      DEPOSIT
                    </Button>

                    <Button
                      onClick={() => navigate("/fiat/withdraw")}
                      className="flex flex-col items-center justify-center py-8 rounded-xl font-bold uppercase text-sm bg-transparent border border-green-500 text-green-400 hover:bg-green-500/10 transition-all duration-300"
                    >
                      <Send className="h-6 w-6" />
                      WITHDRAW
                    </Button>

                    <Button
                      onClick={() => navigate("/fiat/exchange")}
                      className="flex flex-col items-center justify-center py-8 rounded-xl font-bold uppercase text-sm bg-transparent border border-green-500 text-green-400 hover:bg-green-500/10 transition-all duration-300"
                    >
                      <ArrowRightLeft className="h-6 w-6" />
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
                    onClick={() => navigate("/fiat/payment")}
                    className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-600 hover:from-purple-700 hover:via-purple-600 hover:to-pink-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-purple-500/20 transition-all duration-300 uppercase"
                  >
                    PAYMENT METHOD
                  </Button>

                  {/* Exchange Rate */}
                  {priceRatio && (
                    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30 mt-4">
                      <p className="text-xs text-gray-400 mb-1 uppercase font-semibold">
                        EXCHANGE RATE
                      </p>
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

          {/* PAYMENT TAB */}
          <div className="mt-6 animate-in fade-in duration-300">
            <div className="space-y-4">
              {paymentMethod ? (
                <>
                  <Card className="bg-gradient-to-br from-green-600/20 to-emerald-700/10 border-green-500/20 rounded-2xl shadow-xl">
                    <CardContent className="pt-6">
                      <div className="text-center mb-6">
                        <p className="text-green-300 text-sm font-bold uppercase mb-2">
                          Active Payment Method
                        </p>
                        <h3 className="text-3xl font-bold text-white font-mono">
                          {paymentMethod.userId}
                        </h3>
                      </div>

                      <div className="bg-gray-800/50 rounded-xl p-4 space-y-3 border border-gray-700/30">
                        <div className="text-left">
                          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                            METHOD
                          </p>
                          <p className="text-white font-semibold">
                            {paymentMethod.name}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                            WALLET
                          </p>
                          <p className="text-white font-mono text-sm break-all">
                            {paymentMethod.walletAddress}
                          </p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
