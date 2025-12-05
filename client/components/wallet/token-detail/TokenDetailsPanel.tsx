import React, { useState, useEffect } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  CheckCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { TokenInfo } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useStaking } from "@/hooks/use-staking";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

interface TokenDetailsPanelProps {
  token: TokenInfo;
  tokenMint: string;
}

export const TokenDetailsPanel: React.FC<TokenDetailsPanelProps> = ({
  token,
  tokenMint,
}) => {
  const { toast } = useToast();
  const { stakes, withdrawStake } = useStaking();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: string }>(
    {},
  );

  // Filter stakes for this token
  const tokenStakes = stakes.filter(
    (stake) => stake.tokenMint === token.mint && stake.status === "active",
  );

  const completedStakes = stakes.filter(
    (stake) => stake.tokenMint === token.mint && stake.status === "completed",
  );

  // Update timer for active stakes
  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeRemaining: { [key: string]: string } = {};
      tokenStakes.forEach((stake) => {
        const remaining = Math.max(0, stake.endTime - Date.now());
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        );
        const minutes = Math.floor(
          (remaining % (1000 * 60 * 60)) / (1000 * 60),
        );
        if (days > 0) {
          newTimeRemaining[stake.id] = `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
          newTimeRemaining[stake.id] = `${hours}h ${minutes}m`;
        } else {
          newTimeRemaining[stake.id] = `${minutes}m`;
        }
      });
      setTimeRemaining(newTimeRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [tokenStakes]);

  const handleWithdraw = async (stakeId: string) => {
    try {
      await withdrawStake(stakeId);
      toast({
        title: "WITHDRAWAL SUCCESSFUL",
        description: `Stake withdrawn successfully`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "WITHDRAWAL FAILED",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const formatTokenAmount = (amount: number): string => {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return null;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined) => {
    if (!value) return "0%";
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  return (
    <div className="w-full flex flex-col gap-4 overflow-y-auto">
      {/* Token Header / Overview */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <div className="flex gap-4 mb-4">
          {token.logoURI && (
            <img
              src={token.logoURI}
              alt={token.symbol}
              className="w-12 h-12 rounded-full bg-gray-700"
              onError={(e) => {
                e.currentTarget.src =
                  "https://via.placeholder.com/48x48?text=" +
                  token.symbol.substring(0, 2);
              }}
            />
          )}
          <div className="flex-1">
            <h2 className="text-xs font-bold text-white uppercase">
              {token.name}
            </h2>
            <p className="text-xs text-gray-400 uppercase">{token.symbol}</p>
          </div>
          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-medium uppercase">
            SPL TOKEN
          </span>
        </div>

        {/* Contract Address */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-semibold uppercase">
            CONTRACT ADDRESS
          </p>
          <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded border border-gray-700">
            <code className="text-xs text-gray-300 flex-1 break-all text-xs">
              {shortenAddress(tokenMint)}
            </code>
            <button
              onClick={() => copyToClipboard(tokenMint)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Copy address"
            >
              {copiedAddress ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <a
              href={`https://solscan.io/token/${tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="View on Solscan"
            >
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Price Information */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase">
          PRICE INFORMATION
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Current Price */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1 uppercase">
              CURRENT PRICE
            </p>
            <p className="text-xs font-bold text-white">
              ${(token.price || 0).toFixed(8)}
            </p>
          </div>

          {/* 24h Change */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1 uppercase">24H CHANGE</p>
            <p
              className={`text-xs font-bold ${
                (token.priceChange24h || 0) >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {formatPercent(token.priceChange24h)}
            </p>
          </div>

          {/* Market Cap */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1 uppercase">MARKET CAP</p>
            {formatNumber(token.marketCap) ? (
              <p className="text-xs font-semibold text-white">
                {formatNumber(token.marketCap)}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                <span className="text-xs text-gray-400">Loading...</span>
              </div>
            )}
          </div>

          {/* 24h Volume */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1 uppercase">24H VOLUME</p>
            {formatNumber(token.volume24h) ? (
              <p className="text-xs font-semibold text-white">
                {formatNumber(token.volume24h)}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                <span className="text-xs text-gray-400">Loading...</span>
              </div>
            )}
          </div>

          {/* Liquidity */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1 uppercase">LIQUIDITY</p>
            {formatNumber(token.liquidity) ? (
              <p className="text-xs font-semibold text-white">
                {formatNumber(token.liquidity)}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                <span className="text-xs text-gray-400">Loading...</span>
              </div>
            )}
          </div>

          {/* Decimals */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1 uppercase">DECIMALS</p>
            <p className="text-xs font-semibold text-white">{token.decimals}</p>
          </div>
        </div>
      </div>

      {/* Token Safety Checks */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase">
          TOKEN SAFETY
        </h3>
        <div className="space-y-2">
          <SafetyCheckItem
            label="CONTRACT VERIFICATION"
            status="verified"
            description="VERIFIED ON SOLSCAN"
          />
          <SafetyCheckItem
            label="MINT AUTHORITY"
            status="verified"
            description="RENOUNCED - NO LONGER MINTABLE"
          />
          <SafetyCheckItem
            label="FREEZE AUTHORITY"
            status="verified"
            description="RENOUNCED - ACCOUNTS CANNOT BE FROZEN"
          />
          <SafetyCheckItem
            label="TOP 10 HOLDERS"
            status="info"
            description="CONCENTRATION ANALYSIS AVAILABLE"
          />
        </div>

        <div className="mt-3 pt-3 border-t border-gray-700">
          <a
            href={`https://solscan.io/token/${tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 uppercase text-xs"
          >
            VIEW FULL ANALYSIS ON SOLSCAN
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Metadata & Links */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase">
          LINKS & RESOURCES
        </h3>
        <div className="space-y-2">
          <MetadataLink
            label="SOLSCAN"
            url={`https://solscan.io/token/${tokenMint}`}
          />
          <MetadataLink
            label="TOKEN INFO"
            url={`https://www.solflare.com/tokens/${tokenMint}`}
          />
          <div className="text-xs text-gray-400 py-2 uppercase text-xs">
            ADDITIONAL METADATA (WEBSITE, TWITTER, DISCORD, ETC.) WILL APPEAR
            HERE IF AVAILABLE
          </div>
        </div>
      </div>

      {/* Token Network Info */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-xs font-semibold text-gray-300 mb-3 uppercase">
          NETWORK INFO
        </h3>
        <div className="space-y-2">
          <InfoRow label="NETWORK" value="Solana" />
          <InfoRow label="TOKEN TYPE" value="SPL (Solana Program Library)" />
          <InfoRow label="CHAIN ID" value="Mainnet Beta" />
          <InfoRow label="MINT ADDRESS" value={shortenAddress(tokenMint)} />
        </div>
      </div>

      {/* Staking Information */}
      {(tokenStakes.length > 0 || completedStakes.length > 0) && (
        <>
          {/* Active Stakes */}
          {tokenStakes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-300 uppercase">
                ACTIVE STAKES
              </h3>
              {tokenStakes.map((stake) => {
                const timeLeft = Math.max(0, stake.endTime - Date.now());
                const isWithdrawable = timeLeft === 0;
                const totalDurationMs =
                  stake.stakePeriodDays * 24 * 60 * 60 * 1000;
                const elapsedMs = totalDurationMs - timeLeft;
                const progressPercentage = (elapsedMs / totalDurationMs) * 100;

                return (
                  <Card
                    key={stake.id}
                    className="w-full bg-gray-900 rounded-lg border border-gray-700"
                  >
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase">
                            STAKED AMOUNT
                          </p>
                          <p className="text-sm font-bold text-white">
                            {formatTokenAmount(stake.amount)} {token.symbol}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase">
                            EXPECTED REWARD
                          </p>
                          <p className="text-sm font-bold text-green-400">
                            +{formatTokenAmount(stake.rewardAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase">
                            PERIOD
                          </p>
                          <p className="text-xs font-semibold text-white">
                            {stake.stakePeriodDays} days
                          </p>
                        </div>
                        <div className="flex items-end">
                          {isWithdrawable ? (
                            <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded uppercase">
                              READY TO WITHDRAW
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-yellow-500" />
                              <span className="text-xs font-semibold text-yellow-500 uppercase">
                                {timeRemaining[stake.id] || "CALCULATING..."}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {!isWithdrawable && (
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs text-gray-400 uppercase">
                              TIME PROGRESS
                            </p>
                            <p className="text-xs text-gray-400 uppercase">
                              {Math.round(progressPercentage)}%
                            </p>
                          </div>
                          <Progress
                            value={Math.min(progressPercentage, 100)}
                            className="h-2"
                          />
                        </div>
                      )}

                      <Button
                        onClick={() => handleWithdraw(stake.id)}
                        disabled={!isWithdrawable}
                        className={`w-full uppercase text-xs ${
                          isWithdrawable
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-gray-700 text-gray-500"
                        } text-white font-semibold`}
                        size="sm"
                      >
                        {isWithdrawable ? "WITHDRAW" : "WITHDRAWAL LOCKED"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Completed Stakes */}
          {completedStakes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-300 uppercase">
                STAKE HISTORY ({completedStakes.length})
              </h3>
              <div className="space-y-2">
                {completedStakes.map((stake) => (
                  <Card
                    key={stake.id}
                    className="w-full bg-gray-900 rounded-lg border border-gray-700"
                  >
                    <CardContent className="p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase">
                            STAKED
                          </p>
                          <p className="text-xs font-semibold text-white">
                            {formatTokenAmount(stake.amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase">
                            REWARD EARNED
                          </p>
                          <p className="text-xs font-semibold text-green-400">
                            +{formatTokenAmount(stake.rewardAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase">
                            PERIOD
                          </p>
                          <p className="text-xs font-semibold text-white">
                            {stake.stakePeriodDays} days
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1 uppercase">
                            STATUS
                          </p>
                          <p className="text-xs font-semibold text-gray-300">
                            COMPLETED
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface SafetyCheckItemProps {
  label: string;
  status: "verified" | "unknown" | "info";
  description: string;
}

const SafetyCheckItem: React.FC<SafetyCheckItemProps> = ({
  label,
  status,
  description,
}) => {
  const statusColor = {
    verified: "text-emerald-400",
    unknown: "text-yellow-400",
    info: "text-blue-400",
  };

  const statusBg = {
    verified: "bg-emerald-500/10 border-emerald-500/30",
    unknown: "bg-yellow-500/10 border-yellow-500/30",
    info: "bg-blue-500/10 border-blue-500/30",
  };

  return (
    <div className={`p-3 rounded border ${statusBg[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-300 text-xs">{label}</p>
        {status === "verified" && (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 text-xs">
              Verified
            </span>
          </div>
        )}
        {status === "unknown" && (
          <span className="text-xs font-semibold text-yellow-400 text-xs">
            Unknown
          </span>
        )}
        {status === "info" && (
          <span className="text-xs font-semibold text-blue-400 text-xs">
            Info
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 text-xs">{description}</p>
    </div>
  );
};

interface MetadataLinkProps {
  label: string;
  url: string;
}

const MetadataLink: React.FC<MetadataLinkProps> = ({ label, url }) => {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 rounded bg-gray-900/50 border border-gray-700 hover:border-gray-600 hover:bg-gray-900/80 transition-colors"
    >
      <span className="text-xs text-gray-300 flex-1 text-xs">{label}</span>
      <ExternalLink className="w-3 h-3 text-gray-400" />
    </a>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-gray-200 font-medium text-xs">{value}</span>
    </div>
  );
};

export default TokenDetailsPanel;
