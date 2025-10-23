import React, { useMemo, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import { useNavigate } from "react-router-dom";
import { TokenInfo } from "@/lib/wallet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
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

const DECIMAL_OPTIONS = [6, 8, 9, 10];
const MAX_SUPPLY_OPTIONS = [
  { label: "1 Million", value: 1_000_000n },
  { label: "10 Million", value: 10_000_000n },
  { label: "100 Million", value: 100_000_000n },
  { label: "1 Billion", value: 1_000_000_000n },
  { label: "10 Billion", value: 10_000_000_000n },
  { label: "100 Billion", value: 100_000_000_000n },
  { label: "1 Trillion", value: 1_000_000_000_000n },
];

export default function CreateToken() {
  const { wallet, balance, addCustomToken, refreshTokens, connection } =
    useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [logoURI, setLogoURI] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [decimals, setDecimals] = useState(6);
  const [maxSupply, setMaxSupply] = useState(1_000_000_000n);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleNavigate = (path: string) => {
    setDropdownOpen(false);
    navigate(path);
  };

  const conn = (connection as any) || defaultConnection;

  // Fixorium wallet address that will hold mint authority
  const FIXORIUM_MINT_AUTHORITY = new PublicKey(
    "Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA",
  );

  const hasMinSol = useMemo(
    () => (typeof balance === "number" ? balance : 0) >= 0.002,
    [balance],
  );

  if (!wallet) {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />
        <div className="relative z-20 w-[90%] max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-[#0f1520]/30 border border-white/10">
          <h2 className="text-xl font-bold mb-4">Wallet Required</h2>
          <p className="text-sm text-gray-300 mb-6">
            Please set up or import a wallet first.
          </p>
          <div>
            <Button onClick={() => navigate("/")} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        </div>
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

      // Initialize mint with Fixorium wallet as mint authority
      tx.add(
        createInitializeMintInstruction(
          mint.publicKey,
          decimals,
          FIXORIUM_MINT_AUTHORITY,
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

      // Mint total supply to payer's ATA (user owns the tokens)
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
        headers: { "Content-Type": "application/json" },
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

      // Persist token metadata separately so we don't violate TokenInfo typing
      try {
        const meta = {
          description: description.trim() || undefined,
          website: website.trim() || undefined,
          twitter: twitter.trim() || undefined,
          telegram: telegram.trim() || undefined,
        } as any;
        try {
          localStorage.setItem(
            `token_metadata_${mint.publicKey.toBase58()}`,
            JSON.stringify(meta),
          );
        } catch (e) {
          console.warn("Failed to persist token metadata:", e);
        }
      } catch (e) {
        // noop
      }

      addCustomToken(newToken);
      setTimeout(() => refreshTokens(), 1500);

      toast({ title: "Token Created", description: `Mint tx: ${signature}` });
      navigate(`/token/${mint.publicKey.toBase58()}`);
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
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden flex items-center justify-center">
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 backdrop-blur-sm"
          aria-label="Go back"
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      <div className="w-full mx-auto px-4 sm:px-6 relative z-20 flex flex-col items-center mt-20">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-[#0f1520]/30 border border-white/10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl sm:text-2xl font-bold">Create Token</h1>
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-gray-300 hover:text-white"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleNavigate("/fixorium/create-pool")}>
                  Create Pool
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate("/fixorium/my-tokens")}>
                  My Tokens
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigate("/fixorium/token-listing")}>
                  Listed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Token Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Token"
                  className="bg-[#1a1a1a] text-white placeholder:text-white/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="MTK"
                  className="bg-[#1a1a1a] text-white placeholder:text-white/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  value={logoURI}
                  onChange={(e) => setLogoURI(e.target.value)}
                  placeholder="https://..."
                  className="bg-[#1a1a1a] text-white placeholder:text-white/70"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short token description"
                  className="bg-[#1a1a1a] text-white placeholder:text-white/70"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Official Website</Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourtoken.site"
                  className="bg-[#1a1a1a] text-white placeholder:text-white/70"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter">Twitter</Label>
                <Input
                  id="twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                  className="bg-[#1a1a1a] text-white placeholder:text-white/70"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telegram">Telegram</Label>
                <Input
                  id="telegram"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="https://t.me/yourgroup"
                  className="bg-[#1a1a1a] text-white placeholder:text-white/70"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="decimals">Decimals</Label>
                  <Select
                    value={decimals.toString()}
                    onValueChange={(value) => setDecimals(parseInt(value))}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] text-white border-white/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DECIMAL_OPTIONS.map((decimal) => (
                        <SelectItem key={decimal} value={decimal.toString()}>
                          {decimal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxSupply">Max Supply</Label>
                  <Select
                    value={maxSupply.toString()}
                    onValueChange={(value) => setMaxSupply(BigInt(value))}
                  >
                    <SelectTrigger className="bg-[#1a1a1a] text-white border-white/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAX_SUPPLY_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value.toString()}
                          value={option.value.toString()}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button
              disabled={!hasMinSol || isLoading}
              onClick={createTokenOnChain}
              className="w-full h-12 rounded-lg font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Token on Solana"}
            </Button>

            {!hasMinSol && (
              <p className="text-red-400 text-xs">
                Balance is below 0.002 SOL.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
