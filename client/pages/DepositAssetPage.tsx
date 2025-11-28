import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";

export default function DepositAssetPage() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [selectedToken, setSelectedToken] = useState<string>("SOL");
  const [copied, setCopied] = useState<boolean>(false);

  const depositTokens = [
    {
      symbol: "SOL",
      name: "Solana",
      logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5Au7BXRSpJfDw3gEPrwwAau4vTNihtQ5go5Q/logo.png",
    },
    {
      symbol: "USDT",
      name: "Tether",
      logo: "https://cdn.builder.io/api/v1/image/assets%2F559a5e19be114c9d8427d6683b845144%2Fc2ea69828dbc4a90b2deed99c2291802?format=webp&width=800",
    },
    {
      symbol: "FIXERCOIN",
      name: "Fixercoin",
      logo: "https://raw.githubusercontent.com/Fixorium/token-list/main/assets/fixercoin.png",
    },
  ];

  const selectedTokenData = depositTokens.find(
    (t) => t.symbol === selectedToken,
  );

  const handleCopyAddress = () => {
    if (wallet?.publicKey) {
      navigator.clipboard.writeText(wallet.publicKey);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenAddress = (address: string) => {
    if (!address || address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  return (
    <div
      className="min-h-screen text-gray-100 pb-20"
      style={{ backgroundColor: "#1f1f1f" }}
    >
      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-4 pt-8">
        <div className="px-4 sm:px-0 mb-6">
          <button
            onClick={() => navigate("/assets")}
            className="text-white hover:text-gray-300 transition-colors mb-4 flex items-center"
            aria-label="Go back"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              DEPOSIT ASSET
            </h1>
            <p className="text-sm text-gray-400">
              SELECT A TOKEN AND SEND IT TO YOUR WALLET ADDRESS
            </p>
          </div>
        </div>

        {/* Wallet Address Card */}
        <div className="px-4 sm:px-0 mb-6">
          <Card className="bg-transparent border border-green-500/30 rounded-lg">
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  Your Wallet Address
                </p>
                <div className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <code className="text-sm text-green-400 flex-1 break-all font-mono">
                    {shortenAddress(wallet?.publicKey || "Not connected")}
                  </code>
                  <button
                    onClick={handleCopyAddress}
                    className="flex-shrink-0 p-2 hover:bg-gray-700 rounded transition-colors"
                    aria-label="Copy address"
                  >
                    {copied ? (
                      <Check size={16} className="text-green-400" />
                    ) : (
                      <Copy size={16} className="text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <Separator className="bg-gray-700" />

              <div className="space-y-2">
                <h3 className="font-semibold text-white text-sm">
                  Deposit Instructions:
                </h3>
                <ol className="text-xs text-gray-300 space-y-2 list-decimal list-inside">
                  <li>Copy your wallet address above</li>
                  <li>Go to your external wallet or exchange</li>
                  <li>Send {selectedTokenData?.symbol} to the address</li>
                  <li>
                    Tokens will appear in your account within a few minutes
                  </li>
                </ol>
              </div>

              <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/50">
                <p className="text-xs text-yellow-300">
                  <strong>Note:</strong> Only send {selectedTokenData?.symbol}{" "}
                  to this address. Sending other tokens may result in permanent
                  loss.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Network Info */}
        <div className="px-4 sm:px-0">
          <Card className="bg-transparent border border-gray-700 rounded-lg">
            <CardContent className="p-4">
              <div className="space-y-2">
                <p className="text-xs text-gray-400">
                  <strong>Network:</strong> Solana Mainnet
                </p>
                <p className="text-xs text-gray-400">
                  <strong>Token:</strong> {selectedTokenData?.symbol}
                </p>
                <p className="text-xs text-gray-400">
                  <strong>Status:</strong>{" "}
                  <span className="text-green-400">Ready to receive</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
