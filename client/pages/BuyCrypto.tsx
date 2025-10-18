import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  dexscreenerAPI,
  type DexscreenerToken,
} from "@/lib/services/dexscreener";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TokenOption {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  mint?: string;
  price?: number;
}

const SUPPORTED_TOKEN_MINTS: Record<string, string> = {
  FIXERCOIN: TOKEN_MINTS.FIXERCOIN,
  SOL: TOKEN_MINTS.SOL,
  USDC: TOKEN_MINTS.USDC,
  USDT: TOKEN_MINTS.USDT,
  LOCKER: TOKEN_MINTS.LOCKER,
};

const DEFAULT_TOKENS: TokenOption[] = [
  {
    id: "FIXERCOIN",
    name: "Fixercoin",
    symbol: "FIXERCOIN",
    logo: "https://raw.githubusercontent.com/Fixorium/token-list/main/assets/fixercoin.png",
    mint: SUPPORTED_TOKEN_MINTS.FIXERCOIN,
  },
  {
    id: "SOL",
    name: "Solana",
    symbol: "SOL",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    mint: SUPPORTED_TOKEN_MINTS.SOL,
  },
  {
    id: "USDC",
    name: "USDC",
    symbol: "USDC",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5Au7BXRSpJfDw3gEPrwwAau4vTNihtQ5go5Q/logo.png",
    mint: SUPPORTED_TOKEN_MINTS.USDC,
  },
  {
    id: "USDT",
    name: "Tether",
    symbol: "USDT",
    logo: "https://cdn.builder.io/api/v1/image/assets%2F559a5e19be114c9d8427d6683b845144%2Fc2ea69828dbc4a90b2deed99c2291802?format=webp&width=800",
    mint: SUPPORTED_TOKEN_MINTS.USDT,
  },
  {
    id: "LOCKER",
    name: "Locker",
    symbol: "LOCKER",
    logo: "https://raw.githubusercontent.com/Fixorium/token-list/main/assets/locker.png",
    mint: SUPPORTED_TOKEN_MINTS.LOCKER,
  },
];

export default function BuyCrypto() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<TokenOption[]>(DEFAULT_TOKENS);
  const [selectedToken, setSelectedToken] = useState<TokenOption>(
    DEFAULT_TOKENS[0],
  );
  const [amountPKR, setAmountPKR] = useState<string>("");
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Fetch token data from Dexscreener
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const mints = Object.values(SUPPORTED_TOKEN_MINTS);
        const dexTokens = await dexscreenerAPI.getTokensByMints(mints);

        // Merge Dexscreener data with our token list
        const enrichedTokens = DEFAULT_TOKENS.map((token) => {
          const dexData = dexTokens.find(
            (dt) => dt.baseToken.address === token.mint,
          );
          return {
            ...token,
            logo: dexData?.info?.imageUrl || token.logo,
            price: dexData?.priceUsd ? parseFloat(dexData.priceUsd) : undefined,
          };
        });

        setTokens(enrichedTokens);
        setSelectedToken(enrichedTokens[0]);
      } catch (error) {
        console.error("Error fetching tokens from Dexscreener:", error);
        setTokens(DEFAULT_TOKENS);
      }
    };

    fetchTokens();
  }, []);

  // Fetch exchange rate for selected token
  useEffect(() => {
    const fetchRate = async () => {
      setFetchingRate(true);
      try {
        const url = `/api/exchange-rate?token=${selectedToken.id}`;
        console.log(`[BuyCrypto] Fetching exchange rate from: ${url}`);

        const response = await fetch(url);
        console.log(`[BuyCrypto] Exchange rate response status: ${response.status}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch exchange rate: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[BuyCrypto] Exchange rate response:`, data);

        const rate = data.rate || data.priceInPKR || 0;
        console.log(
          `[BuyCrypto] Setting exchange rate for ${selectedToken.id}: ${rate} PKR`,
        );

        if (typeof rate !== "number" || rate <= 0) {
          console.warn(
            `[BuyCrypto] Invalid rate received: ${rate}, will show 0`,
          );
        }

        setExchangeRate(rate);
      } catch (error) {
        console.error("[BuyCrypto] Error fetching exchange rate:", error);
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
          color: "#FF7A5C",
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
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]"
      style={{ fontSize: "10px" }}
    >
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      {/* Header: back only */}
      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        {/* Main Buy Card */}
        <Card className="bg-transparent backdrop-blur-xl rounded-md">
          <CardContent className="space-y-6 pt-6">
            {/* Token Selection Dropdown */}
            <div>
              <label className="block font-medium text-white/80 mb-3">
                Select Token
              </label>
              <Select
                value={selectedToken.id}
                onValueChange={(id) => {
                  const token = tokens.find((t) => t.id === id);
                  if (token) setSelectedToken(token);
                }}
              >
                <SelectTrigger className="bg-[#1a2540]/50 border-none focus:ring-2 focus:ring-[#FF7A5C] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2540] border-none">
                  {tokens.map((token) => (
                    <SelectItem
                      key={token.id}
                      value={token.id}
                      className="text-white"
                    >
                      {token.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            {/* Amount Input */}
            <div>
              <label className="block font-medium text-white/80 mb-2">
                Amount (PKR)
              </label>
              <input
                type="number"
                value={amountPKR}
                onChange={(e) => setAmountPKR(e.target.value)}
                placeholder="Enter amount in PKR"
                className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                min="0"
                step="100"
              />
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            {/* Exchange Rate & Calculation */}
            <div className="bg-transparent p-4 rounded-lg">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Exchange Rate:</span>
                  {fetchingRate ? (
                    <Loader2 className="w-4 h-4 text-[#FF7A5C] animate-spin" />
                  ) : (
                    <span className="font-semibold text-[#FF7A5C]">
                      1 {selectedToken.symbol} = {exchangeRate.toFixed(2)} PKR
                    </span>
                  )}
                </div>
                <Separator className="bg-[#FF7A5C]/20" />
                <div className="flex justify-between items-center">
                  <span className="text-white/70">You Will Receive:</span>
                  <span className="font-bold text-[#FF7A5C]">
                    {estimatedTokens.toFixed(6)} {selectedToken.symbol}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="bg-[#FF7A5C]/20" />

            {/* Buy Button */}
            <Button
              onClick={handleBuyClick}
              disabled={
                loading ||
                !amountPKR ||
                Number(amountPKR) <= 0 ||
                estimatedTokens === 0
              }
              className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `PAY TO BUY CRYPTO CURRENCY`
              )}
            </Button>

            <p className="text-white/50 text-center">
              Payments processed securely through Razorpay
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Load Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
    </div>
  );
}
