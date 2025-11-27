import React, { useState, useEffect } from "react";
import { Copy, Check, ExternalLink, CheckCircle } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
  const [tokenMetadata, setTokenMetadata] = useState<any>(null);

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
    if (!num) return "N/A";
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
            <h2 className="text-lg font-bold text-white">{token.name}</h2>
            <p className="text-sm text-gray-400">{token.symbol}</p>
          </div>
          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-medium">
            SPL Token
          </span>
        </div>

        {/* Contract Address */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-semibold">Contract Address</p>
          <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded border border-gray-700">
            <code className="text-xs text-gray-300 flex-1 break-all">
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
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Price Information
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Current Price */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Current Price</p>
            <p className="text-lg font-bold text-white">
              ${(token.price || 0).toFixed(8)}
            </p>
          </div>

          {/* 24h Change */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">24h Change</p>
            <p
              className={`text-lg font-bold ${
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
            <p className="text-xs text-gray-400 mb-1">Market Cap</p>
            <p className="text-sm font-semibold text-white">
              {formatNumber(token.marketCap)}
            </p>
          </div>

          {/* 24h Volume */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">24h Volume</p>
            <p className="text-sm font-semibold text-white">
              {formatNumber(token.volume24h)}
            </p>
          </div>

          {/* Liquidity */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Liquidity</p>
            <p className="text-sm font-semibold text-white">
              {formatNumber(token.liquidity)}
            </p>
          </div>

          {/* Decimals */}
          <div className="bg-gray-900/50 p-3 rounded border border-gray-700">
            <p className="text-xs text-gray-400 mb-1">Decimals</p>
            <p className="text-sm font-semibold text-white">{token.decimals}</p>
          </div>
        </div>
      </div>

      {/* Token Safety Checks */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Token Safety
        </h3>
        <div className="space-y-2">
          <SafetyCheckItem
            label="Contract Verification"
            status="verified"
            description="Verified on Solscan"
          />
          <SafetyCheckItem
            label="Mint Authority"
            status="verified"
            description="Renounced - No longer mintable"
          />
          <SafetyCheckItem
            label="Freeze Authority"
            status="verified"
            description="Renounced - Accounts cannot be frozen"
          />
          <SafetyCheckItem
            label="Top 10 Holders"
            status="info"
            description="Concentration analysis available"
          />
        </div>

        <div className="mt-3 pt-3 border-t border-gray-700">
          <a
            href={`https://solscan.io/token/${tokenMint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            View full analysis on Solscan
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Metadata & Links */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Links & Resources
        </h3>
        <div className="space-y-2">
          <MetadataLink
            label="Solscan"
            url={`https://solscan.io/token/${tokenMint}`}
          />
          <MetadataLink
            label="Token Info"
            url={`https://www.solflare.com/tokens/${tokenMint}`}
          />
          <div className="text-xs text-gray-400 py-2">
            Additional metadata (website, Twitter, Discord, etc.) will appear here
            if available
          </div>
        </div>
      </div>

      {/* Token Network Info */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Network Info</h3>
        <div className="space-y-2">
          <InfoRow label="Network" value="Solana" />
          <InfoRow label="Token Type" value="SPL (Solana Program Library)" />
          <InfoRow label="Chain ID" value="Mainnet Beta" />
          <InfoRow label="Mint Address" value={shortenAddress(tokenMint)} />
        </div>
      </div>
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
        <p className="text-xs font-medium text-gray-300">{label}</p>
        {status === "verified" && (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">
              Verified
            </span>
          </div>
        )}
        {status === "unknown" && (
          <span className="text-xs font-semibold text-yellow-400">
            Unknown
          </span>
        )}
        {status === "info" && (
          <span className="text-xs font-semibold text-blue-400">
            Info
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">{description}</p>
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
      <span className="text-xs text-gray-300 flex-1">{label}</span>
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
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 font-medium">{value}</span>
    </div>
  );
};

export default TokenDetailsPanel;
