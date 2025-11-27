import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { TokenInfo, shortenAddress } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { formatTokenAmount } from "@/lib/utils";
import { PriceLoader } from "@/components/ui/price-loader";

interface TokenInfoCardProps {
  token: TokenInfo;
}

export const TokenInfoCard: React.FC<TokenInfoCardProps> = ({ token }) => {
  const { toast } = useToast();

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(token.mint);
      toast({
        title: "Address Copied",
        description: "Token mint address copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy address to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleViewOnExplorer = () => {
    const url = `https://solscan.io/token/${token.mint}`;
    window.open(url, "_blank");
  };

  return (
    <Card className="bg-gray-800 border-gray-700 mt-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-white">
          Token Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-400">Name</span>
            <p className="text-white font-medium">{token.name}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Symbol</span>
            <p className="text-white font-medium">{token.symbol}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Decimals</span>
            <p className="text-white font-medium">{token.decimals}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Balance</span>
            <p className="text-white font-medium">
              {formatTokenAmount(token.balance || 0, token.symbol)}
            </p>
          </div>
        </div>

        <div>
          <span className="text-sm text-gray-400 block mb-2">Mint Address</span>
          <div className="flex items-center gap-2">
            <code className="text-xs text-white bg-gray-700 px-2 py-1 rounded flex-1">
              {shortenAddress(token.mint, 6)}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-[2px]"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewOnExplorer}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-[2px]"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
          <div>
            <span className="text-sm text-gray-400">Current Price</span>
            {token.price ? (
              <p className="text-white font-medium">
                $
                {token.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </p>
            ) : (
              <div className="font-medium py-1">
                {["SOL", "USDC", "FIXERCOIN", "LOCKER", "FXM"].includes(
                  token.symbol,
                ) ? (
                  <PriceLoader />
                ) : (
                  <p className="text-gray-400">—</p>
                )}
              </div>
            )}
          </div>
          <div>
            <span className="text-sm text-gray-400">24h Change</span>
            {typeof token.priceChange24h === "number" &&
            isFinite(token.priceChange24h) ? (
              <p
                className={`font-medium ${token.priceChange24h >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {token.priceChange24h.toFixed(2)}%
              </p>
            ) : (
              <p className="font-medium text-gray-400">—</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
