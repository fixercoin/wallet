import React, { useMemo, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl, getApiHeaders } from "@/lib/api-client";
import { useNavigate } from "react-router-dom";
import { TokenInfo } from "@/lib/wallet";
import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { connection as defaultConnection } from "@/lib/wallet";

export default function CreateToken() {
  const { wallet, balance, addCustomToken, refreshTokens, connection } =
    useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [logoURI, setLogoURI] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const decimals = 6;
  const maxSupply = 1_000_000_000n; // 1 billion

  const conn = (connection as any) || defaultConnection;

  const hasMinSol = useMemo(
    () => (typeof balance === "number" ? balance : 0) >= 0.002,
    [balance],
  );

  if (!wallet) {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white flex items-center justify-center">
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

  const createTokenOnChain = async () => {
    if (!wallet) return;
    if (!hasMinSol) {
      toast({
        title: "Insufficient SOL",
        description: "You need at least 0.002 SOL to create a token.",
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
      const payer = Keypair.fromSecretKey(wallet.secretKey as Uint8Array);
      const mint = Keypair.generate();

      // Rent for mint account
      const rent = await conn.getMinimumBalanceForRentExemption(MINT_SIZE);

      // Associated token account for payer
      const payerPub = new PublicKey(wallet.publicKey);
      const ata = await getAssociatedTokenAddress(mint.publicKey, payerPub);

      const tx = new Transaction();

      // Create mint account
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: payerPub,
          newAccountPubkey: mint.publicKey,
          lamports: rent,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
      );

      // Initialize mint with payer as mint authority
      tx.add(
        createInitializeMintInstruction(
          mint.publicKey,
          decimals,
          payerPub,
          null,
        ),
      );

      // Create associated token account for payer
      tx.add(
        createAssociatedTokenAccountInstruction(
          payerPub,
          ata,
          payerPub,
          mint.publicKey,
        ),
      );

      // Mint total supply to payer's ATA
      const amount = maxSupply * BigInt(10 ** decimals);
      tx.add(createMintToInstruction(mint.publicKey, ata, payerPub, amount));

      // recent blockhash and fee payer
      const { blockhash } = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = payerPub;

      // Sign with mint and payer
      tx.partialSign(mint);
      tx.partialSign(payer);

      const serialized = tx.serialize();
      const signedBase64 = Buffer.from(serialized).toString("base64");

      // Simulate
      const simResp = await fetch(resolveApiUrl("/api/solana-simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedBase64 }),
      });

      if (!simResp.ok) {
        const txt = await simResp.text().catch(() => "");
        throw new Error(txt || `Simulation failed (${simResp.status})`);
      }

      const simJson = await simResp.json();
      if (simJson?.insufficientLamports) {
        const d = simJson.insufficientLamports;
        toast({
          title: "Insufficient SOL",
          description: `You need ~${(d.diffSol ?? d.diff / 1e9 ?? 0).toFixed(6)} SOL more to cover fees/rent.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Send
      const sendResp = await fetch(resolveApiUrl("/api/solana-send"), {
        method: "POST",
        headers: getApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ signedBase64 }),
      });

      if (!sendResp.ok) {
        const txt = await sendResp.text().catch(() => "");
        throw new Error(txt || `Send failed (${sendResp.status})`);
      }

      const jb = await sendResp.json();
      if (jb.error)
        throw new Error(jb.error.message || JSON.stringify(jb.error));

      const signature = jb.result as string;

      // Add token to local list
      const newToken: TokenInfo = {
        mint: mint.publicKey.toBase58(),
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        decimals,
        logoURI: logoURI || undefined,
        balance: Number(maxSupply),
      };

      addCustomToken(newToken);
      setTimeout(() => refreshTokens(), 1500);

      toast({ title: "Token Created", description: `Mint tx: ${signature}` });
      navigate("/");
    } catch (e: any) {
      console.error("Create token error:", e);
      toast({
        title: "Create Failed",
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
            <span className="text-gray-400 text-xs">/ create token</span>
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
        <Card className="bg-transparent border-0">
          <CardHeader>
            <CardTitle className="text-lg">Create Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                Requires at least <strong>0.002 SOL</strong> for rent and fees.
              </AlertDescription>
            </Alert>

            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Token Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Token"
                  className="bg-transparent text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="MTK"
                  className="bg-transparent text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  value={logoURI}
                  onChange={(e) => setLogoURI(e.target.value)}
                  placeholder="https://..."
                  className="bg-transparent text-white"
                />
              </div>
              <div className="text-xs text-gray-400">
                Decimals: 6 • Max supply: 1,000,000,000
              </div>
            </div>

            <Button
              disabled={!hasMinSol || isLoading}
              onClick={createTokenOnChain}
              className="w-full h-12 rounded-xl font-semibold border-0 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg"
            >
              {isLoading ? "Creating..." : "Create Token on Solana"}
            </Button>

            {!hasMinSol && (
              <p className="text-red-400 text-xs">
                Balance is below 0.002 SOL.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
