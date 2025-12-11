import React, { useMemo, useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { heliusAPI } from "@/lib/services/helius";
import { jupiterAPI } from "@/lib/services/jupiter";

const BASE_SOLSCAN_TX = (sig: string) => `https://solscan.io/tx/${sig}`;

interface ExtendedToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: number;
  price?: number;
  priceChange24h?: number;
}

const AssetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { wallet, tokens, refreshTokens } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [totalBalance, setTotalBalance] = useState<number>(0);

  useEffect(() => {
    const loadBalance = async () => {
      if (!wallet?.publicKey) return;

      setIsLoading(true);
      try {
        const response = await heliusAPI.getTokenBalances(
          wallet.publicKey.toString(),
        );
        setIsUsingCache(response.cacheUsed || false);

        let total = 0;
        tokens.forEach((token) => {
          if (
            typeof token.balance === "number" &&
            typeof token.price === "number"
          ) {
            const value = token.balance * token.price;
            if (isFinite(value)) {
              total += value;
            }
          }
        });

        setTotalBalance(total);
      } catch (error) {
        console.error("Failed to load balance:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBalance();
  }, [wallet?.publicKey, tokens]);

  const sortedTokens = useMemo(() => {
    return [...tokens].sort((a, b) => {
      const aValue = (a.balance || 0) * (a.price || 0);
      const bValue = (b.balance || 0) * (b.price || 0);
      return bValue - aValue;
    });
  }, [tokens]);

  const handleRefresh = async () => {
    if (!wallet?.publicKey) return;
    setIsLoading(true);
    try {
      await refreshTokens(wallet.publicKey.toString());
    } finally {
      setIsLoading(false);
    }
  };

  if (!wallet?.publicKey) {
    return (
      <div className="w-full min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-400">Please connect your wallet</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Go to Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-900 text-gray-100">
      <style>{`
        @keyframes blink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .blink-animation {
          animation: blink 1.2s ease-in-out infinite;
        }
      `}</style>
      <div className="w-full max-w-4xl mx-auto px-4 py-4 pt-8">
        <div className="px-0 mb-6">
          <button
            onClick={() => navigate("/")}
            className="text-white hover:text-gray-300 transition-colors mb-4 flex items-center"
            aria-label="Go back"
          >
            <ArrowLeft size={24} />
          </button>
          {isUsingCache ? (
            <div className="text-xs px-3 py-1 rounded-full bg-orange-500/20 text-orange-600 border border-orange-500/40 mb-3 inline-flex items-center gap-1.5">
              <span>⚠️ Unstable Connect - Using Cache</span>
            </div>
          ) : (
            <div className="text-xs px-3 py-1 rounded-full bg-green-500/20 text-green-600 border border-green-500/40 mb-3 inline-flex items-center gap-1.5">
              <span>✓ Stable Connect</span>
            </div>
          )}
          <div className="bg-transparent rounded-lg p-4 border border-[#22c55e]/30 flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Total Balance</p>
              <p className="text-3xl font-bold text-green-400">
                $
                {totalBalance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <Button
              onClick={() => navigate("/assets/deposit")}
              className="border border-green-500 text-green-500 hover:bg-green-500/10 bg-transparent rounded-lg px-4 py-2 text-sm font-medium transition-all"
            >
              DEPOSITE ASSET
            </Button>
          </div>
        </div>

        {sortedTokens.length === 0 ? (
          <div className="text-center py-8 text-gray-300">
            <p className="text-sm">
              {isLoading ? "Loading assets..." : "No tokens found"}
            </p>
          </div>
        ) : (
          <div className="w-full space-y-0">
            {sortedTokens.map((token, index) => {
              const tokenBalance =
                typeof token.balance === "number" &&
                typeof token.price === "number" &&
                isFinite(token.balance) &&
                isFinite(token.price)
                  ? token.balance * token.price
                  : 0;

              return (
                <div key={token.mint} className="w-full">
                  <div className="bg-transparent border border-gray-700 rounded-none cursor-pointer hover:border-gray-600 transition-colors">
                    <div className="w-full p-0">
                      <div className="flex items-start gap-4 p-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {token.logoURI && (
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              className="w-12 h-12 rounded-full flex-shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm text-white truncate">
                              {token.symbol || token.name}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {token.name}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-white">
                            ${tokenBalance.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {(token.balance || 0).toFixed(4)} {token.symbol}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssetsPage;
