import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { TokenBadge } from "./TokenBadge";
import { PriceCard } from "./token-detail/PriceCard";
import { birdeyeAPI } from "@/lib/services/birdeye";
import { BuySellLine } from "./token-detail/BuySellLine";

interface TokenDetailProps {
  tokenMint: string;
  onBack: () => void;
  onBuy: (tokenMint: string) => void;
  onSell: (tokenMint: string) => void;
  onSend: (tokenMint: string) => void;
  onReceive: (tokenMint: string) => void;
}

export const TokenDetail: React.FC<TokenDetailProps> = ({
  tokenMint,
  onBack,
  onBuy,
  onSell,
  onSend,
  onReceive,
}) => {
  const { tokens, refreshTokens } = useWallet();
  const { toast } = useToast();
  const [priceData, setPriceData] = useState<
    { time: string; price: number; volume: number }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [enhancedToken, setEnhancedToken] = useState<TokenInfo | null>(null);

  // Find the token from the tokens list
  const token = tokens.find((t) => t.mint === tokenMint);

  useEffect(() => {
    if (token) {
      setEnhancedToken(token);
    }
  }, [token]);

  // Load live price data from Birdeye for this token
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const birdeye = await birdeyeAPI.getTokenByMint(tokenMint);
        const price = birdeye?.priceUsd
          ? parseFloat(String(birdeye.priceUsd))
          : null;
        const change = birdeye?.priceChange?.h24 ?? 0;
        const base = price || 0;
        const data = Array.from({ length: 24 }, (_, i) => {
          // create simple intraday points around the base price using change to simulate trend
          const factor =
            1 +
            ((Math.sin((i / 24) * Math.PI * 2) * 0.5 + 0.5) *
              (change / 100 || 0)) /
              2;
          return {
            time: `${i}:00`,
            price: parseFloat((base * factor).toFixed(8)),
            volume: birdeye?.volume?.h24 || Math.random() * 100000,
          };
        });
        if (mounted) setPriceData(data);
      } catch (e) {
        if (mounted) setPriceData([]);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [tokenMint]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await refreshTokens();
      // reload prices
      const birdeye = await birdeyeAPI
        .getTokenByMint(tokenMint)
        .catch(() => null);
      if (birdeye?.priceUsd) {
        const base = parseFloat(String(birdeye.priceUsd));
        const data = Array.from({ length: 24 }, (_, i) => ({
          time: `${i}:00`,
          price: base,
          volume: birdeye.volume?.h24 || 0,
        }));
        setPriceData(data);
      }

      toast({
        title: "Refreshed",
        description: "Token data updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh token data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden flex items-center justify-center">
        {/* Decorative curved accent background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#22c55e] pointer-events-none" />
        <div className="text-center relative z-20">
          <p className="text-gray-900 text-lg mb-4">Token not found</p>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const displayToken = enhancedToken || token;

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#22c55e] pointer-events-none" />

      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <div className="mt-6 mb-1 rounded-lg p-6 border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden text-gray-900">
          <div className="flex items-center gap-2 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label="Back"
              className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-white/10 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 flex-1">
              <h1 className="text-lg font-semibold text-gray-900">
                {displayToken.symbol}
              </h1>
              <TokenBadge token={displayToken} />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-white/10 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Price Section (inside single card) */}
          <PriceCard
            token={displayToken}
            priceData={priceData}
            showBalance={showBalance}
            onToggleBalance={() => setShowBalance(!showBalance)}
            withinCard
            variant="light"
          />

          {/* Chart and actions */}
          <div className="px-4 pb-4 space-y-3">
            <div className="rounded-lg overflow-hidden border border-[#e6f6ec]/20 bg-white/80 text-gray-900">
              <div className="px-3 pt-3 text-sm font-medium text-gray-700">
                Buys vs Sells (5m → 24h)
              </div>
              <div className="p-3">
                <BuySellLine mint={tokenMint} priceData={priceData} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => onBuy(tokenMint)}
                className="h-10 font-semibold bg-gradient-to-r from-[#34d399] to-[#22c55e] hover:from-[#16a34a] hover:to-[#15803d] text-white"
              >
                BUY
              </Button>
              <Button
                onClick={() => onSell(tokenMint)}
                className="h-10 font-semibold bg-gradient-to-r from-[#34d399] to-[#22c55e] hover:from-[#16a34a] hover:to-[#15803d] text-white"
              >
                SELL
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
