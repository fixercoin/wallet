import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";

interface TokenOption {
  id: string;
  name: string;
  symbol: string;
  logo: string;
}

const SUPPORTED_TOKENS: TokenOption[] = [
  {
    id: "FIXERCOIN",
    name: "Fixercoin",
    symbol: "FIXERCOIN",
    logo: "https://raw.githubusercontent.com/Fixorium/token-list/main/assets/fixercoin.png",
  },
  {
    id: "SOL",
    name: "Solana",
    symbol: "SOL",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    id: "USDC",
    name: "USDC",
    symbol: "USDC",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5Au7BXRSpJfDw3gEPrwwAau4vTNihtQ5go5Q/logo.png",
  },
  {
    id: "USDT",
    name: "Tether",
    symbol: "USDT",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns/logo.png",
  },
  {
    id: "LOCKER",
    name: "Locker",
    symbol: "LOCKER",
    logo: "https://raw.githubusercontent.com/Fixorium/token-list/main/assets/locker.png",
  },
];

export default function BuyCrypto() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();

  const [selectedToken, setSelectedToken] = useState<TokenOption>(
    SUPPORTED_TOKENS[0]
  );
  const [amountPKR, setAmountPKR] = useState<string>("");
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Fetch exchange rate for selected token
  useEffect(() => {
    const fetchRate = async () => {
      setFetchingRate(true);
      try {
        const response = await fetch(
          `/api/exchange-rate?token=${selectedToken.id}`
        );
        if (!response.ok) throw new Error("Failed to fetch exchange rate");
        const data = await response.json();
        setExchangeRate(data.rate || 0);
      } catch (error) {
        console.error("Error fetching exchange rate:", error);
        setExchangeRate(0);
      } finally {
        setFetchingRate(false);
      }
    };

    fetchRate();
  }, [selectedToken]);

  // Calculate estimated tokens when amount changes
  useEffect(() => {
    if (amountPKR && exchangeRate > 0) {
      const tokens = Number(amountPKR) / exchangeRate;
      setEstimatedTokens(tokens);
    } else {
      setEstimatedTokens(0);
    }
  }, [amountPKR, exchangeRate]);

  const handleBuyClick = async () => {
    if (!wallet) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!amountPKR || Number(amountPKR) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount in PKR",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create payment intent with Razorpay
      const response = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: wallet.publicKey,
          amount: Math.round(Number(amountPKR) * 100), // Razorpay uses smallest currency unit
          currency: "PKR",
          tokenType: selectedToken.id,
          email: wallet.email || "user@fixorium.com",
          contact: wallet.phone || "",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create payment intent");
      }

      const data = await response.json();

      if (!data.orderId || !data.key) {
        throw new Error("Invalid payment response");
      }

      // Initialize Razorpay checkout
      const options = {
        key: data.key,
        amount: Math.round(Number(amountPKR) * 100),
        currency: "PKR",
        name: "Fixorium Wallet",
        description: `Buy ${selectedToken.symbol}`,
        order_id: data.orderId,
        handler: function (response: any) {
          toast({
            title: "Payment Successful",
            description: `Your wallet will be credited with ${estimatedTokens.toFixed(6)} ${selectedToken.symbol} shortly`,
          });
          setTimeout(() => {
            navigate("/");
          }, 2000);
        },
        prefill: {
          email: wallet.email,
          contact: wallet.phone,
        },
        theme: {
          color: "#8b5cf6",
        },
      };

      if ((window as any).Razorpay) {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        throw new Error("Razorpay not loaded");
      }
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description:
          error?.message || "An error occurred while processing payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Buy Crypto</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Info Card */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-white/20 shadow-lg">
          <CardContent className="pt-6">
            <p className="text-gray-700 leading-relaxed">
              Fixorium Wallet allows you to instantly buy Fixercoin, Solana
              (SOL), USDC (Solana), USDT (Solana), and LOCKER tokens using your
              Visa or Mastercard. Once your payment is confirmed, your wallet
              balance updates automatically — no manual confirmation needed. All
              payments are handled securely and verified through our gateway.
            </p>
          </CardContent>
        </Card>

        {/* Main Buy Card */}
        <Card className="bg-white/80 backdrop-blur-sm border-white/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-gray-900">Select Token & Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Choose Token to Buy
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {SUPPORTED_TOKENS.map((token) => (
                  <button
                    key={token.id}
                    onClick={() => setSelectedToken(token)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      selectedToken.id === token.id
                        ? "border-purple-500 bg-purple-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <Avatar className="w-10 h-10 mx-auto mb-2">
                      <AvatarImage src={token.logo} alt={token.symbol} />
                      <AvatarFallback>{token.symbol[0]}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-semibold text-gray-900">
                      {token.symbol}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (PKR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amountPKR}
                  onChange={(e) => setAmountPKR(e.target.value)}
                  placeholder="Enter amount in PKR"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <Separator />

            {/* Exchange Rate & Calculation */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Exchange Rate:</span>
                  {fetchingRate ? (
                    <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                  ) : (
                    <span className="font-semibold text-gray-900">
                      1 {selectedToken.symbol} = {exchangeRate.toFixed(2)} PKR
                    </span>
                  )}
                </div>
                <Separator className="bg-purple-200" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">You Will Receive:</span>
                  <span className="text-lg font-bold text-purple-600">
                    {estimatedTokens.toFixed(6)} {selectedToken.symbol}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Wallet Info */}
            {wallet && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Wallet Address:</span>{" "}
                  <span className="font-mono text-blue-600">
                    {wallet.publicKey.slice(0, 8)}...
                    {wallet.publicKey.slice(-8)}
                  </span>
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Tokens will be credited to this wallet after payment confirmation
                </p>
              </div>
            )}

            {/* Buy Button */}
            <Button
              onClick={handleBuyClick}
              disabled={
                loading ||
                !amountPKR ||
                Number(amountPKR) <= 0 ||
                estimatedTokens === 0
              }
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ₨${Number(amountPKR).toLocaleString()} & Buy ${selectedToken.symbol}`
              )}
            </Button>

            <p className="text-xs text-gray-600 text-center">
              By continuing, you agree to our terms and conditions. Payments are
              processed securely through Razorpay.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Load Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
    </div>
  );
}
