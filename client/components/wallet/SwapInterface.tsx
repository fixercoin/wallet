import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUpDown,
  Settings,
  Check,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import { jupiterAPI, JupiterQuoteResponse } from "@/lib/services/jupiter";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { Keypair, VersionedTransaction } from "@solana/web3.js";

interface SwapInterfaceProps {
  onBack: () => void;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({ onBack }) => {
  const { wallet, balance, tokens, refreshBalance, connection } =
    useWallet() as any;
  const { toast } = useToast();

  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<JupiterQuoteResponse | null>(null);
  const [indicative, setIndicative] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>(
    tokens || [],
  );
  const allTokens = availableTokens;
  const [supportedMints, setSupportedMints] = useState<Set<string>>(new Set());
  const [quoteError, setQuoteError] = useState<string>("");
  const [fromUsdPrice, setFromUsdPrice] = useState<number | null>(null);
  const [toUsdPrice, setToUsdPrice] = useState<number | null>(null);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        const jupiterTokens = await jupiterAPI.getStrictTokenList();
        const popularTokens: TokenInfo[] = (jupiterTokens || [])
          .slice(0, 50)
          .map((jt: any) => ({
            mint: jt.address,
            symbol: jt.symbol,
            name: jt.name,
            decimals: jt.decimals,
            logoURI: jt.logoURI,
          }));
        setSupportedMints(
          new Set((jupiterTokens || []).map((t: any) => t.address)),
        );

        const userTokens = tokens || [];
        const combined = [
          ...userTokens,
          ...popularTokens.filter(
            (pt) => !userTokens.some((t: TokenInfo) => t.mint === pt.mint),
          ),
        ];
        setAvailableTokens(combined);
      } catch (err) {
        console.error("Error loading tokens:", err);
        setAvailableTokens(tokens || []);
      }
    };

    loadTokens();

    const sol = (tokens || []).find((t: TokenInfo) => t.symbol === "SOL");
    if (sol && !fromToken) setFromToken(sol);
  }, [tokens, fromToken]);

  useEffect(() => {
    const getQuote = async () => {
      if (!fromAmount || !fromToken || !toToken) {
        setQuote(null);
        setToAmount("");
        setQuoteError("");
        setIndicative(false);
        return;
      }

      if (
        supportedMints.size > 0 &&
        (!supportedMints.has(fromToken.mint) ||
          !supportedMints.has(toToken.mint))
      ) {
        setQuote(null);
        setToAmount("");
        setQuoteError("Quotes unavailable for this pair on Jupiter");
        setIndicative(false);
        return;
      }
      setQuoteError("");

      if (parseFloat(fromAmount) <= 0) {
        setQuote(null);
        setToAmount("");
        setIndicative(false);
        return;
      }

      setIsLoading(true);
      try {
        const amount = jupiterAPI.formatSwapAmount(
          parseFloat(fromAmount),
          fromToken.decimals,
        );
        const amountInt = parseInt(amount, 10);
        if (!amountInt || amountInt <= 0) {
          setQuote(null);
          setToAmount("");
          setIndicative(false);
          setIsLoading(false);
          return;
        }
        const q = await jupiterAPI.getQuote(
          fromToken.mint,
          toToken.mint,
          amountInt,
          Math.max(1, Math.round(parseFloat(slippage || "0.5") * 100)),
        );
        if (q) {
          setQuote(q);
          const out = jupiterAPI.parseSwapAmount(q.outAmount, toToken.decimals);
          setToAmount(out.toFixed(6));
          setQuoteError("");
          setIndicative(false);
        } else {
          const [fromDex, toDex] = await Promise.all([
            dexscreenerAPI.getTokenByMint(fromToken.mint),
            dexscreenerAPI.getTokenByMint(toToken.mint),
          ]);
          const fromUsd = fromDex?.priceUsd
            ? parseFloat(fromDex.priceUsd)
            : null;
          const toUsd = toDex?.priceUsd ? parseFloat(toDex.priceUsd) : null;
          if (fromUsd && toUsd && fromUsd > 0 && toUsd > 0) {
            const fromHuman = amountInt / Math.pow(10, fromToken.decimals);
            const estOutHuman = (fromHuman * fromUsd) / toUsd;
            setQuote(null);
            setToAmount(estOutHuman.toFixed(6));
            setQuoteError("");
            setIndicative(true);
          } else {
            setQuote(null);
            setToAmount("");
            setQuoteError(
              `No liquidity found for ${fromToken.symbol} ↔ ${toToken.symbol}. Try a different trading pair or amount.`,
            );
            setIndicative(false);
          }
        }
      } catch (err) {
        console.error("Quote error:", err);
        setQuote(null);
        setToAmount("");
        setQuoteError("");
        setIndicative(false);
      } finally {
        setIsLoading(false);
      }
    };

    const t = setTimeout(getQuote, 300);
    return () => clearTimeout(t);
  }, [fromAmount, fromToken, toToken, slippage]);

  // Load USD prices for selected tokens
  useEffect(() => {
    const loadPrices = async () => {
      if (!fromToken && !toToken) {
        setFromUsdPrice(null);
        setToUsdPrice(null);
        return;
      }
      const mints: string[] = [];
      if (fromToken?.mint) mints.push(fromToken.mint);
      if (toToken?.mint && toToken.mint !== fromToken?.mint)
        mints.push(toToken.mint);
      if (mints.length === 0) {
        setFromUsdPrice(null);
        setToUsdPrice(null);
        return;
      }
      try {
        // Prefer Jupiter price API for reliable USD prices
        const jupMap = await jupiterAPI.getTokenPrices(mints);
        let fromPrice: number | null = fromToken?.mint
          ? (jupMap[fromToken.mint] ?? null)
          : null;
        let toPrice: number | null = toToken?.mint
          ? (jupMap[toToken.mint] ?? null)
          : null;

        // Fallback to DexScreener if Jupiter didn't return prices
        if (
          fromPrice == null ||
          !(fromPrice > 0) ||
          toPrice == null ||
          !(toPrice > 0)
        ) {
          const tokens = await dexscreenerAPI.getTokensByMints(mints);
          const dsMap = dexscreenerAPI.getTokenPrices(tokens);
          if (fromPrice == null || !(fromPrice > 0)) {
            fromPrice = fromToken?.mint
              ? (dsMap[fromToken.mint] ?? null)
              : null;
          }
          if (toPrice == null || !(toPrice > 0)) {
            toPrice = toToken?.mint ? (dsMap[toToken.mint] ?? null) : null;
          }
        }

        setFromUsdPrice(fromPrice ?? null);
        setToUsdPrice(toPrice ?? null);
      } catch (e) {
        setFromUsdPrice(null);
        setToUsdPrice(null);
      }
    };
    loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken?.mint, toToken?.mint]);

  const handleSwapTokens = () => {
    const prevFrom = fromToken;
    const prevFromAmount = fromAmount;
    setFromToken(toToken);
    setToToken(prevFrom);
    setFromAmount(toAmount);
    setToAmount(prevFromAmount);
  };

  const getTokenBalance = (token?: TokenInfo) => {
    if (!token) return 0;
    if (token.symbol === "SOL") return balance || 0;
    return token.balance || 0;
  };

  const formatAmount = (amount: number | string, symbol?: string) => {
    const num =
      typeof amount === "string" ? parseFloat(amount) : (amount as number);
    if (isNaN(num)) return "0.000";
    return num.toFixed(3);
  };

  const validateSwap = (): string | null => {
    if (!fromToken || !toToken) return "Please select both tokens";
    if (!fromAmount || parseFloat(fromAmount) <= 0)
      return "Enter a valid amount";
    if (parseFloat(fromAmount) > getTokenBalance(fromToken))
      return "Insufficient balance";
    return null;
  };

  const getKeypair = (): Keypair | null => {
    try {
      if (!wallet?.secretKey) return null;
      let secretKey: Uint8Array;
      if (typeof wallet.secretKey === "string") {
        secretKey = Uint8Array.from(Buffer.from(wallet.secretKey, "base64"));
      } else if (Array.isArray(wallet.secretKey)) {
        secretKey = Uint8Array.from(wallet.secretKey);
      } else {
        secretKey = wallet.secretKey;
      }
      return Keypair.fromSecretKey(secretKey);
    } catch (err) {
      console.error("getKeypair error:", err);
      return null;
    }
  };

  const handleSwap = () => {
    const err = validateSwap();
    if (err) {
      toast({
        title: "Invalid Swap",
        description: err,
        variant: "destructive",
      });
      return;
    }
    executeSwap();
  };

  const executeSwap = async () => {
    if (!quote || !wallet) return;
    setIsLoading(true);

    try {
      if (!quote) throw new Error("Swap quote missing");
      const swapRequest = {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey,
        wrapAndUnwrapSol: true,
      } as any;
      console.debug("Sending swap request to Jupiter proxy:", swapRequest);
      const swapResponse = await jupiterAPI.getSwapTransaction(swapRequest);
      if (!swapResponse || !swapResponse.swapTransaction)
        throw new Error("Failed to get swap transaction");

      const kp = getKeypair();
      if (!kp) throw new Error("Missing wallet key to sign transaction");

      const swapTransactionBuf = Buffer.from(
        swapResponse.swapTransaction,
        "base64",
      );
      const tx = VersionedTransaction.deserialize(swapTransactionBuf);
      tx.sign([kp]);
      const serialized = Buffer.from(tx.serialize());

      // If a connection is available in context, prefer it
      if (connection && typeof connection.sendRawTransaction === "function") {
        try {
          const sig = await connection.sendRawTransaction(serialized, {
            skipPreflight: false,
          });

          // Immediately update UI and return; perform confirmation in background
          setTxSignature(sig);
          setStep("success");
          setTimeout(() => refreshBalance?.(), 2000);
          toast({
            title: "Swap Submitted",
            description: `Transaction submitted: ${sig}. Awaiting confirmation...`,
          });

          (async () => {
            try {
              const latest = await connection.getLatestBlockhash();
              await connection.confirmTransaction({
                blockhash: latest.blockhash,
                lastValidBlockHeight: latest.lastValidBlockHeight,
                signature: sig,
              });
              toast({
                title: "Swap Confirmed",
                description: `Swap ${fromAmount} ${fromToken?.symbol} → ${toAmount} ${toToken?.symbol} confirmed.`,
              });
            } catch (err) {
              console.warn("Background confirmation failed:", err);
            }
          })();

          return;
        } catch (e: any) {
          console.warn(
            "connection.sendRawTransaction failed, falling back to server send:",
            e?.message || e,
          );
          // Continue to fallback to server-side submission below
        }
      }

      // Fallback: submit signed transaction to server endpoints (/api/solana-simulate, /api/solana-send)
      const signedBase64 = (() => {
        let bin = "";
        const arr = serialized;
        for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
        try {
          return btoa(bin);
        } catch (e) {
          return Buffer.from(arr).toString("base64");
        }
      })();

      // Simulate first
      try {
        const simResp = await fetch(resolveApiUrl("/api/solana-simulate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedBase64 }),
        });

        if (!simResp.ok) {
          const txt = await simResp.text().catch(() => "");
          let parsed: any = null;
          try {
            parsed = txt ? JSON.parse(txt) : null;
          } catch {}
          const msg =
            parsed?.error?.message ||
            txt ||
            simResp.statusText ||
            `Simulation failed (${simResp.status})`;
          throw new Error(msg);
        }

        const simJson = await simResp.json();
        if (simJson?.insufficientLamports) {
          const d = simJson.insufficientLamports;
          const missingSOL = d.diffSol ?? (d.diff ? d.diff / 1e9 : null);
          toast({
            title: "Insufficient SOL",
            description: `You need ~${missingSOL?.toFixed(6) ?? "0.000000"} SOL more to cover fees/rent.`,
            variant: "destructive",
          });
          setIsLoading(false);
          setStep("form");
          return;
        }
      } catch (e: any) {
        throw new Error(
          `Simulation request failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      // Send via server
      try {
        const sendResp = await fetch(resolveApiUrl("/api/solana-send"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedBase64 }),
        });

        if (!sendResp.ok) {
          const txt = await sendResp.text().catch(() => "");
          let parsed: any = null;
          try {
            parsed = txt ? JSON.parse(txt) : null;
          } catch {}
          const details = parsed?.error?.details
            ? JSON.stringify(parsed.error.details)
            : txt || sendResp.statusText;
          throw new Error(
            `${sendResp.status} : ${parsed?.error?.message || txt} | details: ${details}`,
          );
        }

        const jb = await sendResp.json();
        if (jb.error) {
          const det = jb.error.details
            ? JSON.stringify(jb.error.details)
            : JSON.stringify(jb.error);
          throw new Error(
            `RPC send error: ${jb.error.message || JSON.stringify(jb.error)} | details: ${det}`,
          );
        }

        const signature = jb.result as string;
        setTxSignature(signature);
        setStep("success");
        setTimeout(() => refreshBalance?.(), 2000);
        toast({
          title: "Swap Completed!",
          description: `Successfully swapped ${fromAmount} ${fromToken?.symbol} for ${toAmount} ${toToken?.symbol}`,
        });
        return;
      } catch (e: any) {
        throw new Error(
          `Send request failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } catch (err: any) {
      console.error("Swap execution error:", err);
      toast({
        title: "Swap Failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetSwap = () => {
    setFromAmount("");
    setToAmount("");
    setStep("form");
    setTxSignature(null);
  };

  const TokenSelector: React.FC<{
    selectedToken: TokenInfo | null;
    onSelect: (t: TokenInfo) => void;
    label: string;
  }> = ({ selectedToken, onSelect, label }) => {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          {label}
        </label>
        <div>
          <Select
            value={selectedToken?.mint || ""}
            onValueChange={(v) => {
              const t = allTokens.find((x) => x.mint === v);
              if (t) onSelect(t);
            }}
          >
            <SelectTrigger className="w-full bg-[hsl(var(--card))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70">
              <SelectValue placeholder="Select a token">
                {selectedToken ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5 ring-1 ring-white/20">
                      <AvatarImage
                        src={selectedToken.logoURI}
                        alt={selectedToken.symbol}
                      />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                        {selectedToken.symbol.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{selectedToken.symbol}</span>
                    <span className="text-[hsl(var(--muted-foreground))] text-sm">
                      (
                      {formatAmount(
                        getTokenBalance(selectedToken),
                        selectedToken.symbol,
                      )}
                      )
                    </span>
                  </div>
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60 bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))]">
              {allTokens.map((token) => (
                <SelectItem
                  key={token.mint}
                  value={token.mint}
                  className="text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70 focus:bg-[hsl(var(--card))]/70"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Avatar className="h-5 w-5 ring-1 ring-white/20">
                      <AvatarImage src={token.logoURI} alt={token.symbol} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                        {token.symbol.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{token.symbol}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {formatAmount(getTokenBalance(token), token.symbol)}
                        </span>
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {token.name}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] p-4">
        <div className="max-w-md mx-auto pt-8">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg">
            <div className="p-8 text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 ring-2 ring-emerald-400/30">
                  <Check className="h-8 w-8 text-emerald-300" />
                </div>
                <h3 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">
                  Swap Completed!
                </h3>
                <p className="text-[hsl(var(--muted-foreground))]">
                  Your transaction has been successfully executed
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">
                    Swapped:
                  </span>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {fromAmount} {fromToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--muted-foreground))]">
                    Received:
                  </span>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {toAmount} {toToken?.symbol}
                  </span>
                </div>
                {txSignature && (
                  <div className="flex justify-between items-center">
                    <span className="text-[hsl(var(--muted-foreground))]">
                      Transaction:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-emerald-400">
                        {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
                      </span>
                      <a
                        href={`https://solscan.io/tx/${txSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={resetSwap}
                  className="flex-1 bg-[hsl(var(--card))]/70 border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/80"
                >
                  Swap Again
                </Button>
                <Button
                  onClick={onBack}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                >
                  Back to Wallet
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] p-4">
      <div className="max-w-md mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Swap</h1>
          <Button
            variant="ghost"
            size="icon"
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Card */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden">
          <div className="p-5 space-y-4">
            {/* FROM row */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-3">
                  <Input
                    type="number"
                    placeholder="0.000"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="w-full bg-transparent border-0 p-0 h-auto text-2xl leading-none tracking-tight text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:ring-0"
                  />
                  <div className="mt-2 text-xl text-[hsl(var(--muted-foreground))]">
                    {(() => {
                      const amt = parseFloat(fromAmount || "0");
                      const price = fromUsdPrice ?? 0;
                      const usd = amt * price;
                      return `${usd > 0 ? usd.toFixed(2) : "0.00"} USD`;
                    })()}
                  </div>
                </div>

                {/* Token select pill (from) */}
                <div className="flex flex-col items-end min-w-[8.5rem]">
                  <Select
                    value={fromToken?.mint || ""}
                    onValueChange={(v) => {
                      const t = allTokens.find((x) => x.mint === v);
                      if (t) setFromToken(t);
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-full bg-[hsl(var(--card))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70 w-auto px-3">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          {fromToken ? (
                            <>
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src={fromToken.logoURI}
                                  alt={fromToken.symbol}
                                />
                                <AvatarFallback className="text-xs">
                                  {fromToken.symbol.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {fromToken.symbol}
                              </span>
                            </>
                          ) : (
                            <span>Select</span>
                          )}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))]">
                      {allTokens.map((token) => (
                        <SelectItem
                          key={token.mint}
                          value={token.mint}
                          className="text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70 focus:bg-[hsl(var(--card))]/70"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Avatar className="h-5 w-5 ring-1 ring-white/20">
                              <AvatarImage
                                src={token.logoURI}
                                alt={token.symbol}
                              />
                              <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                                {token.symbol.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {token.symbol}
                                </span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {formatAmount(
                                    getTokenBalance(token),
                                    token.symbol,
                                  )}
                                </span>
                              </div>
                              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                {token.name}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fromToken ? (
                    <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {formatAmount(
                        getTokenBalance(fromToken),
                        fromToken.symbol,
                      )}{" "}
                      {fromToken.symbol}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* swap arrow */}
            <div className="flex items-center justify-center py-1">
              <Button
                size="icon"
                onClick={handleSwapTokens}
                className="rounded-full h-9 w-9 bg-[hsl(var(--card))]/70 hover:bg-[hsl(var(--card))]/80 border border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            {/* TO row */}
            <div className="bg-purple-200/60 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-3">
                  <div className="text-xl leading-none tracking-tight text-[hsl(var(--muted-foreground))]">
                    {toAmount
                      ? formatAmount(toAmount, toToken?.symbol)
                      : "0.000"}
                  </div>
                  <div className="mt-2 text-xl text-[hsl(var(--muted-foreground))]">
                    {(() => {
                      const amt = parseFloat(toAmount || "0");
                      const price = toUsdPrice ?? 0;
                      const usd = amt * price;
                      return `${usd > 0 ? usd.toFixed(2) : "0.00"} USD`;
                    })()}
                  </div>
                </div>

                {/* Token select pill (to) */}
                <div className="flex flex-col items-end min-w-[8.5rem]">
                  <Select
                    value={toToken?.mint || ""}
                    onValueChange={(v) => {
                      const t = allTokens.find((x) => x.mint === v);
                      if (t) setToToken(t);
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-full bg-[hsl(var(--card))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70 w-auto px-3">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          {toToken ? (
                            <>
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src={toToken.logoURI}
                                  alt={toToken.symbol}
                                />
                                <AvatarFallback className="text-xs">
                                  {toToken.symbol.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {toToken.symbol}
                              </span>
                            </>
                          ) : (
                            <span>Select</span>
                          )}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))]">
                      {allTokens.map((token) => (
                        <SelectItem
                          key={token.mint}
                          value={token.mint}
                          className="text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70 focus:bg-[hsl(var(--card))]/70"
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Avatar className="h-5 w-5 ring-1 ring-white/20">
                              <AvatarImage
                                src={token.logoURI}
                                alt={token.symbol}
                              />
                              <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                                {token.symbol.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {token.symbol}
                                </span>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  {formatAmount(
                                    getTokenBalance(token),
                                    token.symbol,
                                  )}
                                </span>
                              </div>
                              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                {token.name}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {toToken ? (
                    <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))] font-mono">
                      {toToken.mint.slice(0, 4)}...{toToken.mint.slice(-3)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Quote details */}
            {(quote || (indicative && toAmount)) && fromToken && toToken ? (
              <div className="mt-2 bg-[hsl(var(--card))]/30 border border-[hsl(var(--border))] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Quote
                  </span>
                  <span className="text-sm">
                    1 {fromToken.symbol} ={" "}
                    {(
                      parseFloat(toAmount) / parseFloat(fromAmount || "1")
                    ).toFixed(4)}{" "}
                    {toToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">
                    Network fee
                  </span>
                  <span className="text-[hsl(var(--foreground))]">
                    Included
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">
                    Time
                  </span>
                  <span className="text-[hsl(var(--foreground))]">
                    &lt; 1 min
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">
                    Rate includes
                  </span>
                  <span className="text-[hsl(var(--foreground))]">
                    {slippage}% slippage
                  </span>
                </div>
                <div className="text-right text-sm text-blue-400">
                  More quotes
                </div>
              </div>
            ) : null}

            {/* Alerts */}
            {isLoading && (
              <Alert className="bg-yellow-500/10 border-yellow-400/20 text-yellow-200">
                Signing with local wallet and submitting transaction...
              </Alert>
            )}
            {indicative && (
              <Alert className="bg-amber-500/10 border-amber-400/20 text-amber-100">
                <AlertDescription>
                  ⚠️ <strong>Estimated price only</strong> — Jupiter has no direct route for this pair. Price is estimated from DEX data and may vary. You can still attempt the swap, but execution depends on available liquidity.
                </AlertDescription>
              </Alert>
            )}
            {quoteError && !indicative && (
              <Alert className="bg-red-500/10 border-red-400/20 text-red-200">
                <AlertDescription>{quoteError}</AlertDescription>
              </Alert>
            )}

            {/* Submit */}
            <Button
              onClick={handleSwap}
              className="mt-2 w-full h-12 rounded-xl dash-btn font-semibold border-0 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={
                !quote ||
                indicative ||
                !!quoteError ||
                !fromToken ||
                !toToken ||
                !fromAmount ||
                isLoading
              }
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
