import React, { useState } from "react";
import { ArrowLeft, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWallet } from "@/contexts/WalletContext";
import { useStakingTokens } from "@/hooks/use-staking-tokens";

interface StakeTokensProps {
  onBack: () => void;
  onTokenSelect?: (tokenMint: string) => void;
}

export const StakeTokens: React.FC<StakeTokensProps> = ({
  onBack,
  onTokenSelect,
}) => {
  const { wallet, tokens } = useWallet();
  const { stakingTokens, toggleStakingToken, isStaking } = useStakingTokens(
    wallet?.publicKey || null,
  );

  if (!wallet) {
    return (
      <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground p-4">
        <div className="w-full px-4 mx-auto pt-8">
          <div className="bg-transparent shadow-none rounded-lg p-6">
            <div className="p-8 text-center">
              <p className="text-[hsl(var(--muted-foreground))]">
                No wallet available. Please create or import a wallet first.
              </p>
              <div className="mt-4">
                <Button
                  onClick={onBack}
                  className="w-full bg-[#2d1b47]/50 text-white"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const excludedTokens = ["SOL", "USDC", "USDT", "FXM"];
  const filteredTokens = tokens.filter(
    (token) => !excludedTokens.includes(token.symbol.toUpperCase()),
  );

  return (
    <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground p-4">
      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-2">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={onBack}
            size="sm"
            className="h-8 w-8 p-0 rounded-md bg-transparent hover:bg-white/10 text-white ring-0 focus-visible:ring-0 border border-transparent"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <h1 className="text-xl font-semibold text-white">Stake Tokens</h1>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Click on any token to stake it. Earn 10% APY on your staked tokens.
        </p>

        {/* Token List */}
        <div className="w-full space-y-2">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No tokens in your wallet</p>
            </div>
          ) : (
            filteredTokens.map((token) => (
              <Card
                key={token.mint}
                className="w-full bg-transparent rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors"
              >
                <CardContent className="w-full p-0">
                  <button
                    onClick={() => onTokenSelect?.(token.mint)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={token.logoURI} alt={token.symbol} />
                        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-xs">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start">
                        <p className="text-sm font-semibold text-white">
                          {token.name}
                        </p>
                        <p className="text-xs text-gray-400">{token.symbol}</p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded">
                      Stake Now
                    </span>
                  </button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
