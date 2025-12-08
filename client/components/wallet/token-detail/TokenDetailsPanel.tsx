import React, { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { TokenInfo } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  const [copiedAddress, setCopiedAddress] = useState(false);

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
    if (!num) return "—";
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (value: number | undefined) => {
    if (!value) return "0%";
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const isPositive = (token.priceChange24h || 0) >= 0;

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Main Token Card - All info in one place */}
      <Card className="bg-gray-800/50 border border-gray-700/50 overflow-hidden">
        <CardContent className="p-6">
          {/* Token Header with Logo and Badge */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex gap-4 items-start flex-1">
              {token.logoURI && (
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  className="w-16 h-16 rounded-full bg-gray-700 flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://via.placeholder.com/64x64?text=" +
                      token.symbol.substring(0, 2);
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-white truncate">
                    {token.name}
                  </h2>
                  <div className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/50 px-2 py-1 rounded-full flex-shrink-0">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400 uppercase">
                      Verified
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-400">{token.symbol}</p>
              </div>
            </div>
          </div>

          {/* Price and Change Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-700">
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                Price
              </p>
              <p className="text-xl font-bold text-white">
                ${(token.price || 0).toFixed(8)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                24h Change
              </p>
              <p className={`text-xl font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {formatPercent(token.priceChange24h)}
              </p>
            </div>
          </div>

          {/* Token Information Grid */}
          <div className="space-y-4 mb-6 pb-6 border-b border-gray-700">
            {/* Balance and Network Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                  Balance
                </p>
                <p className="text-sm font-semibold text-white">
                  {(token.amount || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {token.symbol}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                  Network
                </p>
                <p className="text-sm font-semibold text-white">Solana</p>
              </div>
            </div>

            {/* Chain ID and Token Type Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                  Chain ID
                </p>
                <p className="text-sm font-semibold text-white">Mainnet Beta</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                  Token Type
                </p>
                <p className="text-sm font-semibold text-blue-400">SPL</p>
              </div>
            </div>

            {/* Mint Authority */}
            <div>
              <p className="text-xs text-gray-400 font-semibold mb-2 uppercase">
                Mint Authority
              </p>
              <div className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded">
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400 uppercase">
                  Renounced
                </span>
              </div>
            </div>
          </div>

          {/* Contract Address */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 font-semibold uppercase">
              Contract Address
            </p>
            <div className="flex items-center gap-2 bg-gray-900/50 p-3 rounded border border-gray-700 group hover:border-gray-600 transition-colors">
              <code className="text-xs text-gray-300 flex-1 break-all font-mono">
                {shortenAddress(tokenMint)}
              </code>
              <button
                onClick={() => copyToClipboard(tokenMint)}
                className="p-1.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                title="Copy full address"
              >
                {copiedAddress ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
                )}
              </button>
              <a
                href={`https://solscan.io/token/${tokenMint}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                title="View on Solscan"
              >
                <ExternalLink className="w-4 h-4 text-gray-400 hover:text-gray-300" />
              </a>
            </div>
          </div>

          {/* View Full Details Button */}
          <Button
            asChild
            className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold uppercase text-xs h-10"
          >
            <a
              href={`https://solscan.io/token/${tokenMint}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Full Details on Solscan
              <ExternalLink className="w-3 h-3 ml-2" />
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Optional: Additional Info Cards could go below if needed */}
      {/* Keeping staking and other features would require separate cards below */}
    </div>
  );
};

export default TokenDetailsPanel;
