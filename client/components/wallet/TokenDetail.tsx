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
      <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] flex items-center justify-center">
        <div className="text-center">
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
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      {/* Header */}
      <div className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Back"
            className="text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
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
            className="text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden">
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
            <div className="rounded-lg overflow-hidden border border-[hsl(var(--border))] bg-white">
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
                className="h-10 font-semibold bg-pink-100 text-pink-900 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-100 dark:hover:bg-pink-900/40"
              >
                BUY
              </Button>
              <Button
                onClick={() => onSell(tokenMint)}
                className="h-10 font-semibold bg-pink-100 text-pink-900 hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-100 dark:hover:bg-pink-900/40"
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
