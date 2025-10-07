import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  Zap,
  AlertTriangle,
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
              "Quotes temporarily unavailable. Try another pair or amount.",
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
    if (isNaN(num)) return "0.0000";
    if (symbol === "FIXERCOIN" || symbol === "FIXER") return num.toFixed(8);
    return num.toFixed(4);
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
        <div className="flex items-center justify-between mb-6 pt-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              Swap Tokens
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-yellow-500/20 text-yellow-300 border-yellow-400/30"
            >
              <Zap className="h-3 w-3" />
              Jupiter
            </Badge>
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-green-500/20 text-green-300 border-green-400/30"
            >
              LIVE
            </Badge>
          </div>
        </div>

        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm rounded-lg">
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between text-[hsl(var(--primary))]">
              <span />
              <Button
                variant="ghost"
                size="sm"
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/70"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-6 p-6">
            {step !== "success" ? (
              <div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                      Swap
                    </span>
                    {fromToken && (
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        Balance:{" "}
                        {formatAmount(
                          getTokenBalance(fromToken),
                          fromToken.symbol,
                        )}
                      </span>
                    )}
                  </div>

                  <div className="border border-[hsl(var(--border))] bg-[hsl(var(--card))]/30 rounded-lg p-4 space-y-4">
                    {/* From */}
                    <div>
                      <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                        From
                      </label>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {fromToken && (
                            <Avatar className="h-6 w-6 ring-1 ring-white/20">
                              <AvatarImage
                                src={fromToken.logoURI}
                                alt={fromToken.symbol}
                              />
                              <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                                {fromToken.symbol.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="font-medium text-[hsl(var(--foreground))]">
                            {fromToken?.symbol || "Select"}
                          </span>
                        </div>

                        <Input
                          type="number"
                          placeholder="0.00"
                          value={fromAmount}
                          onChange={(e) => setFromAmount(e.target.value)}
                          className="border-0 text-2xl p-0 h-auto font-semibold bg-transparent text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                        />
                      </div>

                      <div className="mt-3">
                        <TokenSelector
                          selectedToken={fromToken}
                          onSelect={setFromToken}
                          label="Select token to swap from"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-center">
                      <Button
                        size="sm"
                        onClick={handleSwapTokens}
                        className="rounded-full p-2 h-10 w-10 bg-[hsl(var(--card))]/70 border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--card))]/80"
                      >
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* To */}
                    <div>
                      <label className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                        To (estimated)
                      </label>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {toToken && (
                            <Avatar className="h-6 w-6 ring-1 ring-white/20">
                              <AvatarImage
                                src={toToken.logoURI}
                                alt={toToken.symbol}
                              />
                              <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                                {toToken.symbol.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="font-medium text-[hsl(var(--foreground))]">
                            {toToken?.symbol || "Select"}
                          </span>
                        </div>

                        <span className="text-2xl font-semibold text-[hsl(var(--muted-foreground))]">
                          {toAmount
                            ? formatAmount(toAmount, toToken?.symbol)
                            : formatAmount(0, toToken?.symbol)}
                        </span>
                      </div>

                      <div className="mt-3">
                        <TokenSelector
                          selectedToken={toToken}
                          onSelect={setToToken}
                          label="Select token to receive"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {isLoading && (
                  <Alert className="bg-yellow-500/20 border-yellow-400/30 text-yellow-200">
                    Signing with local wallet and submitting transaction...
                  </Alert>
                )}

                {indicative && (
                  <Alert className="mt-3 bg-blue-500/10 border-blue-400/30 text-blue-200">
                    <AlertDescription>
                      Indicative price shown (no route available). Try adjusting
                      amount or pair.
                    </AlertDescription>
                  </Alert>
                )}

                {quoteError && !indicative && (
                  <Alert className="mt-3 bg-red-500/10 border-red-400/30 text-red-200">
                    <AlertDescription>{quoteError}</AlertDescription>
                  </Alert>
                )}

                {quote && fromToken && toToken && (
                  <div className="bg-[hsl(var(--card))]/30 border border-[hsl(var(--border))] rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">
                        Rate:
                      </span>
                      <span className="text-[hsl(var(--foreground))]">
                        1 {fromToken.symbol} ≈{" "}
                        {(
                          parseFloat(toAmount) / parseFloat(fromAmount)
                        ).toFixed(6)}{" "}
                        {toToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">
                        Price Impact:
                      </span>
                      <span
                        className={
                          parseFloat(quote.priceImpactPct) > 1
                            ? "text-red-400"
                            : "text-emerald-400"
                        }
                      >
                        {parseFloat(quote.priceImpactPct).toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">
                        Slippage:
                      </span>
                      <span className="text-[hsl(var(--foreground))]">
                        {slippage}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">
                        Route:
                      </span>
                      <span className="text-[hsl(var(--foreground))]">
                        {quote.routePlan.length} hop
                        {quote.routePlan.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">
                        Network Fee:
                      </span>
                      <span className="text-[hsl(var(--foreground))]">
                        ~0.000005 SOL
                      </span>
                    </div>
                  </div>
                )}

                {!quote && indicative && fromToken && toToken && toAmount && (
                  <div className="bg-[hsl(var(--card))]/30 border border-[hsl(var(--border))] rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">
                        Indicative Rate:
                      </span>
                      <span className="text-[hsl(var(--foreground))]">
                        1 {fromToken.symbol} ≈{" "}
                        {(
                          parseFloat(toAmount) / parseFloat(fromAmount || "1")
                        ).toFixed(6)}{" "}
                        {toToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">
                        Slippage:
                      </span>
                      <span className="text-[hsl(var(--foreground))]">
                        {slippage}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">
                        Route:
                      </span>
                      <span className="text-[hsl(var(--foreground))]">N/A</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSwap}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
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
                  {isLoading ? "Signing & Sending..." : "Confirm Transaction"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
