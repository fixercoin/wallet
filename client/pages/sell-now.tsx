import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADMIN_WALLET } from "@/lib/p2p";

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
];

export default function SellNow() {
  const navigate = useNavigate();
  const { wallet, tokens: walletTokens = [] } = useWallet();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<TokenOption[]>(DEFAULT_TOKENS);
  const [selectedToken, setSelectedToken] = useState<TokenOption>(
    DEFAULT_TOKENS[0],
  );
  const [sellAmountTokens, setSellAmountTokens] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  const selectedTokenBalance = useMemo(() => {
    const t = (walletTokens || []).find(
      (tk) =>
        (tk.symbol || "").toUpperCase() === selectedToken.symbol.toUpperCase(),
    );
    return t?.balance || 0;
  }, [walletTokens, selectedToken]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const mints = Object.values(SUPPORTED_TOKEN_MINTS);
        const dexTokens = await dexscreenerAPI.getTokensByMints(mints);
        const enriched = DEFAULT_TOKENS.map((token) => {
          const dexData = dexTokens.find(
            (dt) => dt.baseToken.address === token.mint,
          );
          return {
            ...token,
            logo: dexData?.info?.imageUrl || token.logo,
            price: dexData?.priceUsd ? parseFloat(dexData.priceUsd) : undefined,
          } as TokenOption;
        });
        setTokens(enriched);
        setSelectedToken(enriched[0]);
      } catch (error) {
        console.warn("DexScreener fetch failed, using defaults", error);
        setTokens(DEFAULT_TOKENS);
      }
    };
    fetchTokens();
  }, []);

  useEffect(() => {
    const fetchRate = async () => {
      setFetchingRate(true);
      try {
        const url = `/api/token/price?token=${selectedToken.id}`;
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Rate fetch failed ${response.status}`);
        const data = await response.json();
        const rate = data.rate || data.priceInPKR || 0;
        setExchangeRate(typeof rate === "number" && rate > 0 ? rate : 0);
      } catch (error) {
        console.error("Exchange rate error:", error);
        setExchangeRate(0);
      } finally {
        setFetchingRate(false);
      }
    };
    fetchRate();
  }, [selectedToken]);

  const addPendingOrder = (o: any) => {
    try {
      const cur = JSON.parse(localStorage.getItem("orders_pending") || "[]");
      const arr = Array.isArray(cur) ? cur : [];
      arr.unshift({ ...o, status: "pending" });
      localStorage.setItem("orders_pending", JSON.stringify(arr));
    } catch {}
  };

  const handleSellClick = async () => {
    if (!wallet) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }
    const amount = Number(sellAmountTokens);
    if (
      !sellAmountTokens ||
      !isFinite(amount) ||
      amount <= 0 ||
      !exchangeRate
    ) {
      toast({
        title: "Invalid Amount",
        description: "Enter a valid token amount",
        variant: "destructive",
      });
      return;
    }
    try {
      const order = {
        id: `SELL-${Date.now()}`,
        token: selectedToken.id,
        amountTokens: amount,
        amountPKR: amount * exchangeRate,
        pricePKRPerQuote: exchangeRate,
        paymentMethod: "easypaisa",
        sellerWallet: wallet.publicKey,
        adminWallet: ADMIN_WALLET,
        createdAt: Date.now(),
      };
      try {
        localStorage.setItem("sellnote_order", JSON.stringify(order));
      } catch {}
      addPendingOrder(order);
      navigate("/sellnote");
    } catch (error: any) {
      toast({
        title: "Failed to start chat",
        description: error?.message || String(error),
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]"
      style={{ fontSize: "10px" }}
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => navigate("/p2p")}
            className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
          </button>
          <div className="flex-1 text-center font-medium text-sm">Sell Now</div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <Card className="bg-transparent backdrop-blur-xl rounded-md">
          <CardContent className="space-y-6 pt-6">
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
                <SelectTrigger className="bg-[#1a2540]/50 focus:ring-2 focus:ring-[#FF7A5C] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2540]">
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

            <div className="p-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white">
              <div className="text-xs opacity-80">Available Balance</div>
              <div className="mt-1 text-sm">
                <span className="font-semibold">
                  {selectedTokenBalance.toFixed(6)} {selectedToken.symbol}
                </span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-white/80 mb-2">
                Amount ({selectedToken.symbol})
              </label>
              <input
                type="number"
                value={sellAmountTokens}
                onChange={(e) => setSellAmountTokens(e.target.value)}
                placeholder={`Enter amount in ${selectedToken.symbol}`}
                className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C] text-white placeholder-white/40"
                min="0"
                step="0.000001"
              />
            </div>

            <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Exchange Rate:</span>
                  {fetchingRate ? (
                    <Loader2 className="w-4 h-4 text-[#FF7A5C] animate-spin" />
                  ) : (
                    <span className="font-semibold text-[#FF7A5C]">
                      1 {selectedToken.symbol} ={" "}
                      {exchangeRate > 0
                        ? exchangeRate < 1
                          ? exchangeRate.toFixed(6)
                          : exchangeRate.toFixed(2)
                        : "0.00"}{" "}
                      PKR
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70">You Will Receive:</span>
                  <span className="font-bold text-[#FF7A5C]">
                    {(
                      Number(sellAmountTokens || 0) * (exchangeRate || 0)
                    ).toFixed(2)}{" "}
                    PKR
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSellClick}
              disabled={
                loading ||
                !sellAmountTokens ||
                Number(sellAmountTokens) <= 0 ||
                !exchangeRate
              }
              className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "SELL FOR PKR"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
