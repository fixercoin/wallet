import React, { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import { TokenInfo } from "@/lib/wallet";

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
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white">
      <div className="bg-transparent sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-wide">
            <span className="text-cream">FIXORIUM</span>
            <span className="text-gray-400 text-xs">/ token listing</span>
          </div>
          <Button
            variant="ghost"
            className="h-8 px-3 text-white hover:bg-[#FF7A5C]/10"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Token Listing
            </span>
          </div>

          <div className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="mint">Token Mint Address</Label>
              <Input
                id="mint"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Mint address"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Token Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="MTK"
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={logoURI}
                onChange={(e) => setLogoURI(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <Button
            disabled={isLoading}
            onClick={handleList}
            className="h-11 w-full border-0 font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white"
          >
            {isLoading ? "Listing..." : "Confirm Listing"}
          </Button>
        </div>
      </div>
    </div>
  );
}
