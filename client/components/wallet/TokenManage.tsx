import React, { useState } from "react";
import { ArrowLeft, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import type { TokenInfo } from "@/lib/wallet";

interface TokenManageProps {
  tokenMint: string;
  onBack: () => void;
  onContinue: (tokenMint: string) => void;
}

export const TokenManage: React.FC<TokenManageProps> = ({
  tokenMint,
  onBack,
  onContinue,
}) => {
  const { tokens, removeToken } = useWallet();
  const { toast } = useToast();
  const [isRemoving, setIsRemoving] = useState(false);

  const token = tokens.find((t) => t.mint === tokenMint);

  if (!token) {
    return (
      <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
        <div className="w-full md:max-w-lg mx-auto px-0 sm:px-4 py-6 relative z-20">
          <div className="text-center">
            <p className="text-gray-500">Token not found</p>
            <Button onClick={onBack} className="mt-4 rounded-[2px]">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleRemoveToken = async () => {
    setIsRemoving(true);
    try {
      removeToken(token.mint);
      toast({
        title: "Token Removed",
        description: `${token.symbol} has been removed from your wallet`,
      });
      onBack();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to remove token";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const handleContinue = () => {
    onContinue(tokenMint);
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
      <div className="w-full md:max-w-lg mx-auto px-0 sm:px-4 py-6 relative z-20">
        <div className="rounded-none sm:rounded-lg p-4 sm:p-6 border-0 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 p-0 rounded-[2px] bg-transparent hover:bg-white/10 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 uppercase">
                MANAGE TOKEN
              </h1>
              <p className="text-xs text-gray-500 mt-1 uppercase">
                WHAT WOULD YOU LIKE TO DO WITH {token.symbol}?
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-transparent rounded-lg border border-gray-300/30">
              {token.logoURI && (
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  className="h-10 w-10 rounded-full"
                />
              )}
              <div>
                <p className="font-semibold text-sm text-gray-900 uppercase">
                  {token.symbol}
                </p>
                <p className="text-xs text-gray-500 uppercase">
                  {token.name || token.mint.slice(0, 8)}
                </p>
                {typeof token.balance === "number" && (
                  <p className="text-xs text-gray-600 mt-1 uppercase">
                    BALANCE: {token.balance.toFixed(token.decimals || 6)}{" "}
                    {token.symbol}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleContinue}
                className="w-full h-11 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-semibold rounded-[2px] shadow-lg uppercase"
                disabled={isRemoving}
              >
                VIEW TOKEN DETAILS
              </Button>
              <Button
                onClick={handleRemoveToken}
                disabled={isRemoving}
                className="w-full h-11 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-[2px] shadow-lg flex items-center justify-center gap-2 uppercase"
              >
                <Trash2 className="h-4 w-4" />
                {isRemoving ? "REMOVING..." : "REMOVE TOKEN"}
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2 mt-6">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-800">
                <p className="font-semibold mb-1 uppercase">
                  REMOVING THIS TOKEN
                </p>
                <p className="uppercase">
                  REMOVING A TOKEN FROM YOUR WALLET VIEW DOESN'T DELETE IT FROM
                  THE BLOCKCHAIN. YOU CAN ADD IT BACK ANYTIME.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
