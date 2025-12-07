import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { TokenDetailsPanel } from "./token-detail/TokenDetailsPanel";

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
  const [isLoading, setIsLoading] = useState(false);
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
    <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col">
      <div className="w-full md:max-w-lg mx-auto relative z-20 flex-1 flex flex-col">
        {/* Header Section - With padding */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
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
        </div>

        {/* Token Details Section - Scrollable */}
        <div className="px-4 py-4 flex-1 flex flex-col overflow-hidden">
          <TokenDetailsPanel token={displayToken} tokenMint={tokenMint} />
        </div>

        {/* QUICK BUY Button - Fixed at bottom with padding */}
        <div className="px-4 py-4 border-t border-gray-800">
          <Button
            onClick={() => onBuy(tokenMint)}
            className="w-full h-10 font-semibold rounded-[2px] bg-gradient-to-r from-[#34d399] to-[#22c55e] hover:from-[#16a34a] hover:to-[#15803d] text-white"
          >
            QUICK BUY
          </Button>
        </div>
      </div>
    </div>
  );
};
