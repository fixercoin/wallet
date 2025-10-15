import React, { useMemo, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

  const hasMinSol = useMemo(
    () => (typeof balance === "number" ? balance : 0) >= 0.002,
    [balance],
  );

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
    if (!hasMinSol) {
      toast({
        title: "Insufficient SOL",
        description: "You need at least 0.002 SOL to list a token.",
        variant: "destructive",
      });
      return;
    }
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
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-wide">
            <span className="text-cream">FIXORIUM</span>
            <span className="text-gray-400 text-xs">/ token listing</span>
          </div>
          <Button
            variant="ghost"
            className="h-8 px-3 text-cream hover:bg-[#38bdf8]/20"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="wallet-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Token Listing</span>
          </div>

          <Alert>
            <AlertDescription>
              Requires at least <strong>0.002 SOL</strong> in your wallet to
              confirm listing.
            </AlertDescription>
          </Alert>

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
            disabled={!hasMinSol || isLoading}
            onClick={handleList}
            className="h-11 w-full border-0 font-semibold dash-btn"
          >
            {isLoading ? "Listing..." : "Confirm Listing"}
          </Button>

          {!hasMinSol && (
            <p className="text-red-500 text-xs">Balance is below 0.002 SOL.</p>
          )}
        </div>
      </div>
    </div>
  );
}
