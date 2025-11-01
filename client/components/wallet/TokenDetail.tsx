import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { TokenBadge } from "./TokenBadge";
import { PriceCard } from "./token-detail/PriceCard";
import { BuySellLine } from "./token-detail/BuySellLine";

interface TokenDetailProps {
  tokenMint: string;
  onBack: () => void;
  onBuy: (tokenMint: string) => void;
  onSell: (tokenMint: string) => void;
  onSend: (tokenMint: string) => void;
  onReceive: (tokenMint: string) => void;
}

// Mock price data for demonstration
const generateMockPriceData = () => {
  const basePrice = Math.random() * 100;
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    price: basePrice + (Math.random() - 0.5) * 20,
    volume: Math.random() * 1000000,
  }));
};

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
  const [priceData, setPriceData] = useState(generateMockPriceData());
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

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await refreshTokens();
      setPriceData(generateMockPriceData());
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
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden flex items-center justify-center">
        {/* Decorative curved accent background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />
        <div className="text-center relative z-20">
          <p className="text-white text-lg mb-4">Token not found</p>
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
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

      {/* Header */}
      <div className="bg-transparent sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Back"
            className="text-white hover:bg-[#a855f7]/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {displayToken.symbol}
            </h1>
            <TokenBadge token={displayToken} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-white hover:bg-[#FF7A5C]/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <div className="bg-transparent overflow-hidden">
          {/* Price Section (inside single card) */}
          <PriceCard
            token={displayToken}
            priceData={priceData}
            showBalance={showBalance}
            onToggleBalance={() => setShowBalance(!showBalance)}
            withinCard
          />

          {/* Chart and actions */}
          <div className="px-4 pb-4 space-y-3">
            <div className="rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-[#1a2540]/50 border-[#FF7A5C]/30 text-white">
              <div className="px-3 pt-3 text-sm font-medium text-gray-700">
                Buys vs Sells (5m → 24h)
              </div>
              <div className="p-3">
                <BuySellLine mint={tokenMint} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => onBuy(tokenMint)}
                className="h-10 font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white"
              >
                BUY
              </Button>
              <Button
                onClick={() => onSell(tokenMint)}
                className="h-10 font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white"
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
