import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { TokenQuickInfoCard } from "./token-detail/TokenQuickInfoCard";
import { birdeyeAPI } from "@/lib/services/birdeye";
import { BuySellLine } from "./token-detail/BuySellLine";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";

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
      <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground relative overflow-hidden flex items-center justify-center">
        <div className="text-center relative z-20">
          <p className="text-foreground text-lg mb-4">Token not found</p>
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
    <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="w-full md:max-w-lg mx-auto px-4 py-6 relative z-20">
        <div className="mt-6 mb-1 rounded-lg p-6 border border-gray-300/30 bg-transparent relative overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              aria-label="Back"
              className="h-8 w-8 p-0 rounded-[2px] bg-transparent hover:bg-card text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 flex-1">
              <h1 className="text-lg font-semibold text-foreground">
                {displayToken.symbol}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0 rounded-[2px] bg-transparent hover:bg-card text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Token Quick Info Card */}
          <div className="px-4 py-3">
            <TokenQuickInfoCard token={displayToken} />
          </div>

          {/* Chart and actions */}
          <div className="px-4 pb-4 space-y-3">
            {/* Trading Chart Section */}
            <div className="rounded-lg overflow-hidden border-0 bg-transparent">
              <div className="px-3 pt-3 text-sm font-medium text-foreground">
                Trading Chart
              </div>
              <div className="p-3 bg-gray-900/50 rounded-lg overflow-hidden">
                {tokenMint === TOKEN_MINTS.SOL ? (
                  // Binance SOL/USDT Chart via TradingView
                  <iframe
                    key="binance-chart"
                    src="https://www.tradingview.com/widgetembed/?symbol=BINANCE:SOLUSDT&interval=60&symboledit=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc/UTC&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=&utm_medium=&utm_campaign="
                    style={{
                      width: "100%",
                      height: "500px",
                      border: "none",
                    }}
                    allow="clipboard-read clipboard-write web-share"
                  />
                ) : tokenMint === TOKEN_MINTS.FIXERCOIN ||
                  tokenMint === TOKEN_MINTS.USDC ? (
                  // CoinMarketCap DEX Chart for FIXERCOIN/USDT
                  <iframe
                    key="cmc-fixercoin-chart"
                    src="https://coinmarketcap.com/dexscan/solana/H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                    style={{
                      width: "100%",
                      height: "500px",
                      border: "none",
                    }}
                    allow="clipboard-read clipboard-write web-share"
                  />
                ) : tokenMint === "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump" ? (
                  // CoinMarketCap DEX Chart for LOCKER/USDT
                  <iframe
                    key="cmc-locker-chart"
                    src="https://coinmarketcap.com/dexscan/solana/EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump_EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                    style={{
                      width: "100%",
                      height: "500px",
                      border: "none",
                    }}
                    allow="clipboard-read clipboard-write web-share"
                  />
                ) : (
                  // Fallback Buys vs Sells chart for other tokens
                  <div>
                    <BuySellLine mint={tokenMint} priceData={priceData} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => onBuy(tokenMint)}
                className="h-10 font-semibold rounded-[2px] bg-gradient-to-r from-[#34d399] to-[#22c55e] hover:from-[#16a34a] hover:to-[#15803d] text-white"
              >
                BUY
              </Button>
              <Button
                onClick={() => onSell(tokenMint)}
                className="h-10 font-semibold rounded-[2px] bg-gradient-to-r from-[#34d399] to-[#22c55e] hover:from-[#16a34a] hover:to-[#15803d] text-white"
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
