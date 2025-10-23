import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Copy, ExternalLink, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";

export default function TokenDetailsPage() {
  const { mint } = useParams<{ mint: string }>();
  const navigate = useNavigate();
  const { wallet, tokens, balance } = useWallet();
  const { toast } = useToast();
  const [isCopied, setIsCopied] = useState(false);

  const token = tokens.find((t) => t.mint === mint);

  useEffect(() => {
    if (!wallet) {
      navigate("/");
    }
  }, [wallet, navigate]);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Token Not Found</h2>
          <p className="text-gray-400">
            The token you're looking for doesn't exist.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C]"
          >
            Go Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleCopyMint = async () => {
    const success = await copyToClipboard(token.mint);
    if (success) {
      setIsCopied(true);
      toast({
        title: "Copied",
        description: "Mint address copied to clipboard",
      });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const solscanUrl = `https://solscan.io/token/${token.mint}`;
  const formatBalance = (amount: number | undefined): string => {
    if (!amount || isNaN(amount)) return "0.00";
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatTokenPriceDisplay = (price?: number): string => {
    if (typeof price !== "number" || !isFinite(price)) return "0.000000";
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  };

  const percentChange =
    typeof token.priceChange24h === "number" && isFinite(token.priceChange24h)
      ? token.priceChange24h
      : null;
  const isPositive = (percentChange ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-sm bg-[#0f1520]/50 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold">Token Details</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 relative z-10">
        {/* Token Header Card */}
        <Card className="bg-[#0f1520]/30 border border-white/10 mb-6">
          <CardContent className="p-6 space-y-6">
            {/* Token Logo and Name */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={token.logoURI} alt={token.symbol} />
                <AvatarFallback className="bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] text-white font-bold text-2xl">
                  {token.symbol.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-3xl font-bold">{token.name}</h2>
                <p className="text-xl text-gray-400">{token.symbol}</p>
              </div>
              <a
                href={solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="View on Solscan"
              >
                <ExternalLink className="w-6 h-6" />
              </a>
            </div>

            {/* Mint Address */}
            <div className="space-y-2 border-t border-white/10 pt-6">
              <label className="text-sm text-gray-400">Mint Address</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-[#1a1a1a] p-3 rounded-lg text-sm font-mono text-gray-300 break-all">
                  {token.mint}
                </code>
                <button
                  onClick={handleCopyMint}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  title="Copy mint address"
                >
                  <Copy
                    className={`w-5 h-5 ${isCopied ? "text-green-400" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* Price Info */}
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Current Price</label>
                <p className="text-2xl font-bold text-white">
                  ${formatTokenPriceDisplay(token.price)}
                </p>
              </div>
              {percentChange !== null && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">24h Change</label>
                  <p
                    className={`text-2xl font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}
                  >
                    {isPositive ? "+" : ""}
                    {percentChange.toFixed(2)}%
                  </p>
                </div>
              )}
            </div>

            {/* Balance */}
            <div className="space-y-2 border-t border-white/10 pt-6">
              <label className="text-sm text-gray-400">Your Balance</label>
              <p className="text-3xl font-bold text-white">
                {formatBalance(token.balance)}
              </p>
              {typeof token.price === "number" && token.price > 0 && (
                <p className="text-lg text-gray-400">
                  ${formatBalance((token.balance || 0) * token.price)}
                </p>
              )}
            </div>

            {/* Solscan Link */}
            <div className="border-t border-white/10 pt-6">
              <a
                href={solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white hover:text-white"
              >
                <span className="font-semibold">View on Solscan</span>
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Button
            onClick={() => navigate(-1)}
            className="h-12 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20"
          >
            Go Back
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="h-12 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white font-semibold rounded-lg"
          >
            View All Tokens
          </Button>
        </div>
      </div>
    </div>
  );
}
