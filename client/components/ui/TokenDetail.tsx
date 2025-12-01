import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { PriceCard } from "./token-detail/PriceCard";
import { BuyPanel } from "./token-detail/BuyPanel";
import { SellPanel } from "./token-detail/SellPanel";

interface TokenDetailProps {
  tokenMint: string;
  onBack: () => void;
  onBuy: (tokenMint: string) => void;
  onSell: (tokenMint: string) => void;
  onSend: (tokenMint: string) => void;
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
}) => {
  const { tokens, balance, wallet, refreshTokens } = useWallet();
  const { toast } = useToast();
  const [priceData, setPriceData] = useState(generateMockPriceData());
  const [isLoading, setIsLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "buy" | "sell">(
    "overview",
  );
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
      <div className="min-h-screen bg-white text-[hsl(var(--foreground))] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[hsl(var(--foreground))] text-lg mb-4">
            Token not found
          </p>
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
    <div className="min-h-screen bg-white text-[hsl(var(--foreground))]">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="md:max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            aria-label="Back"
            className="text-white hover:bg-gray-700 rounded-[2px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {displayToken.symbol}
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-white hover:bg-gray-700 rounded-[2px]"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="md:max-w-lg mx-auto px-4 py-6">
        {/* Price Card */}
        <PriceCard
          token={displayToken}
          priceData={priceData}
          showBalance={showBalance}
          onToggleBalance={() => setShowBalance(!showBalance)}
        />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as any)}
          className="mt-6"
        >
          <TabsList className="grid w-full grid-cols-3 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary-foreground))]">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="buy"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              Buy
            </TabsTrigger>
            <TabsTrigger
              value="sell"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="text-white font-medium mb-2">Market Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Market Cap</span>
                    <p className="text-white font-medium">
                      ${displayToken.marketCap?.toLocaleString() || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">24h Volume</span>
                    <p className="text-white font-medium">
                      ${displayToken.volume24h?.toLocaleString() || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">24h Change</span>
                    <p
                      className={`font-medium ${
                        (displayToken.priceChange24h || 0) >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {displayToken.priceChange24h?.toFixed(2) || "0.00"}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Decimals</span>
                    <p className="text-white font-medium">
                      {displayToken.decimals}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="buy" className="mt-6">
            <BuyPanel
              token={displayToken}
              onBuy={() => onBuy(tokenMint)}
              quote={null}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="sell" className="mt-6">
            <SellPanel
              token={displayToken}
              onSell={() => onSell(tokenMint)}
              quote={null}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
