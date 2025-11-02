import React, { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { TokenInfo } from "@/lib/wallet";
import { ArrowLeft } from "lucide-react";

export default function TokenListing() {
  const { wallet, balance, addCustomToken, refreshTokens } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mint, setMint] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState<number>(6);
  const [logoURI, setLogoURI] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!wallet) {
    return (
      <div className="min-h-screen bg-white text-[hsl(var(--foreground))] flex items-center justify-center">
        <Card className="w-[90%] max-w-md">
          <CardHeader>
            <CardTitle>Wallet Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-300">
              Please set up or import a wallet first.
            </p>
            <div className="mt-4">
              <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleList = async () => {
    try {
      new PublicKey(mint.trim());
    } catch {
      toast({
        title: "Invalid Mint Address",
        description: "Enter a valid Solana mint address.",
        variant: "destructive",
      });
      return;
    }
    if (!name.trim() || !symbol.trim()) {
      toast({
        title: "Missing fields",
        description: "Enter token name and symbol.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token: TokenInfo = {
        mint: mint.trim(),
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        decimals: Number(decimals) || 6,
        logoURI: logoURI || undefined,
        balance: 0,
      };
      addCustomToken(token);
      setTimeout(() => refreshTokens(), 800);
      toast({
        title: "Token Listed",
        description: `${symbol.toUpperCase()} added to wallet.`,
      });
      navigate("/");
    } catch (e: any) {
      toast({
        title: "Listing failed",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <div className="mt-6 mb-1 rounded-lg p-6 border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden text-gray-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-white/10 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors"
                aria-label="Back"
                title="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold text-gray-900">
                Token Listing
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="mint" className="sr-only">
                Token Mint Address
              </Label>
              <Input
                id="mint"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Mint address"
                className="font-mono bg-white/50 text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Token Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Token"
                className="bg-white/50 border-[#e6f6ec]/20 text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="MTK"
                className="bg-white/50 border-[#e6f6ec]/20 text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decimals">Decimals</Label>
              <Input
                id="decimals"
                type="number"
                value={decimals}
                onChange={(e) => setDecimals(Number(e.target.value) || 0)}
                placeholder="6"
                className="bg-white/50 border-[#e6f6ec]/20 text-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={logoURI}
                onChange={(e) => setLogoURI(e.target.value)}
                placeholder="https://..."
                className="bg-white/50 border-[#e6f6ec]/20 text-gray-900"
              />
            </div>
          </div>

          <Button
            disabled={isLoading}
            onClick={handleList}
            className="h-11 w-full border-0 font-semibold bg-gradient-to-r from-[#34d399] to-[#22c55e] hover:from-[#16a34a] hover:to-[#15803d] text-white"
          >
            {isLoading ? "Listing..." : "Confirm Listing"}
          </Button>
        </div>
      </div>
    </div>
  );
}
