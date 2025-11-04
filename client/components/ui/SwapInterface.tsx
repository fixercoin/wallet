import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { bytesFromBase64, base64FromBytes } from "@/lib/bytes";

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
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>(
    tokens || [],
  );
  const allTokens = availableTokens;

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
        return;
      }

      if (parseFloat(fromAmount) <= 0) {
        setQuote(null);
        setToAmount("");
        return;
      }

      setIsLoading(true);
      try {
        const amount = jupiterAPI.formatSwapAmount(
          parseFloat(fromAmount),
          fromToken.decimals,
        );
        const q = await jupiterAPI.getQuote(
          fromToken.mint,
          toToken.mint,
          parseInt(amount),
          parseInt(slippage) * 100,
        );
        if (q) {
          setQuote(q);
          const out = jupiterAPI.parseSwapAmount(q.outAmount, toToken.decimals);
          setToAmount(out.toFixed(6));
        } else {
          setQuote(null);
          setToAmount("");
        }
      } catch (err) {
        console.error("Quote error:", err);
        setQuote(null);
        setToAmount("");
      } finally {
        setIsLoading(false);
      }
    };

    const t = setTimeout(getQuote, 500);
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
    if (isNaN(num)) return "0.00";
    if (symbol === "FIXERCOIN" || symbol === "LOCKER") {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
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
        secretKey = Uint8Array.from(bytesFromBase64(wallet.secretKey));
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
    setStep("confirm");
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

      const swapTransactionBuf = bytesFromBase64(swapResponse.swapTransaction);
      const tx = VersionedTransaction.deserialize(swapTransactionBuf);
      tx.sign([kp]);
      const serialized = tx.serialize();

      // If a connection is available in context, prefer it
      if (connection && typeof connection.sendRawTransaction === "function") {
        const sig = await connection.sendRawTransaction(serialized, {
          skipPreflight: false,
        });
        const latest = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
          signature: sig,
        });
        setTxSignature(sig);
        setStep("success");
        setTimeout(() => refreshBalance?.(), 2000);
        toast({
          title: "Swap Completed!",
          description: `Successfully swapped ${fromAmount} ${fromToken?.symbol} for ${toAmount} ${toToken?.symbol}`,
        });
        return;
      }

      // Fallback: submit signed transaction to server endpoints (/api/solana-simulate, /api/solana-send)
      const signedBase64 = (() => {
        let bin = "";
        const arr = serialized;
        for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
        try {
          return btoa(bin);
        } catch (e) {
          return base64FromBytes(arr);
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
        <label className="text-sm font-medium text-gray-400">{label}</label>
        <div>
          <Select
            value={selectedToken?.mint || ""}
            onValueChange={(v) => {
              const t = allTokens.find((x) => x.mint === v);
              if (t) onSelect(t);
            }}
          >
            <SelectTrigger className="w-full bg-gray-800/50 border-gray-600 text-white hover:bg-gray-700">
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
                    <span className="text-gray-400 text-sm">
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
            <SelectContent className="max-h-60 bg-gray-800 border-gray-600">
              {allTokens.map((token) => (
                <SelectItem
                  key={token.mint}
                  value={token.mint}
                  className="text-white hover:bg-gray-700 focus:bg-gray-700"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Avatar className="h-5 w-5 ring-1 ring-white/20">
                      <AvatarImage src={token.logoURI} alt={token.symbol} />
                      <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                        {token.symbol.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">
                      {token.symbol} ~{" "}
                      {formatAmount(getTokenBalance(token), token.symbol)}
                    </span>
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
      <div className="min-h-screen bg-gray-900 px-0 py-4 sm:px-4">
        <div className="max-w-none sm:max-w-md mx-auto pt-8">
          <Card className="bg-gray-800/50 border-gray-700 shadow-2xl">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 ring-2 ring-emerald-400/30">
                  <Check className="h-8 w-8 text-emerald-300" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Swap Completed!
                </h3>
                <p className="text-gray-300">
                  Your transaction has been successfully executed
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Swapped:</span>
                  <span className="font-medium text-white">
                    {fromAmount} {fromToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Received:</span>
                  <span className="font-medium text-white">
                    {toAmount} {toToken?.symbol}
                  </span>
                </div>
                {txSignature && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Transaction:</span>
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
                  className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  Swap Again
                </Button>
                <Button
                  onClick={onBack}
                  className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
                >
                  Back to Wallet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-0 py-4 sm:px-4">
      <div className="max-w-none sm:max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 pt-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-white hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Swap Tokens</h1>
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

        <Card className="bg-gray-800/50 border-gray-700 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span />
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === "form" ? (
              <div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-white">From</span>
                    {fromToken && (
                      <span className="text-sm text-gray-400">
                        Balance:{" "}
                        {formatAmount(
                          getTokenBalance(fromToken),
                          fromToken.symbol,
                        )}
                      </span>
                    )}
                  </div>

                  <div className="border border-gray-600 bg-gray-800/30 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                        className="border-0 text-2xl p-0 h-auto font-semibold bg-transparent text-white placeholder-gray-400"
                      />
                      {fromToken && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 ring-1 ring-white/20">
                            <AvatarImage
                              src={fromToken.logoURI}
                              alt={fromToken.symbol}
                            />
                            <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                              {fromToken.symbol.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-white">
                            {fromToken.symbol}
                          </span>
                        </div>
                      )}
                    </div>

                    <TokenSelector
                      selectedToken={fromToken}
                      onSelect={setFromToken}
                      label="Select token to swap from"
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSwapTokens}
                    className="rounded-full p-2 h-10 w-10 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <span className="text-sm font-medium text-white">
                    To (estimated)
                  </span>

                  <div className="border border-gray-600 bg-gray-800/30 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-semibold text-gray-300">
                        {toAmount
                          ? formatAmount(toAmount, toToken?.symbol)
                          : formatAmount(0, toToken?.symbol)}
                      </span>
                      {toToken && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 ring-1 ring-white/20">
                            <AvatarImage
                              src={toToken.logoURI}
                              alt={toToken.symbol}
                            />
                            <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                              {toToken.symbol.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-white">
                            {toToken.symbol}
                          </span>
                        </div>
                      )}
                    </div>

                    <TokenSelector
                      selectedToken={toToken}
                      onSelect={setToToken}
                      label="Select token to receive"
                    />
                  </div>
                </div>

                {quote && fromToken && toToken && (
                  <div className="bg-gray-800/30 border border-gray-600 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rate:</span>
                      <span className="text-white">
                        1 {fromToken.symbol} ≈{" "}
                        {(
                          parseFloat(toAmount) / parseFloat(fromAmount)
                        ).toFixed(6)}{" "}
                        {toToken.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price Impact:</span>
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
                      <span className="text-gray-400">Slippage:</span>
                      <span className="text-white">{slippage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Route:</span>
                      <span className="text-white">
                        {quote.routePlan.length} hop
                        {quote.routePlan.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Network Fee:</span>
                      <span className="text-white">~0.000005 SOL</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSwap}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-lg"
                  disabled={!fromToken || !toToken || !fromAmount}
                >
                  Review Swap
                </Button>
              </div>
            ) : (
              <div>
                <Alert className="bg-red-500/20 border-red-400/30 text-red-200">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Review your swap details carefully. This transaction is
                    final and cannot be reversed.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2 text-white">
                      {fromAmount} {fromToken?.symbol} → {toAmount}{" "}
                      {toToken?.symbol}
                    </div>
                    <p className="text-gray-400">Swap via Jupiter AMM</p>
                  </div>

                  <Separator className="border-white/20" />

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Exchange Rate:</span>
                      <span className="text-white">
                        1 {fromToken?.symbol} ={" "}
                        {(
                          parseFloat(toAmount) / parseFloat(fromAmount)
                        ).toFixed(6)}{" "}
                        {toToken?.symbol}
                      </span>
                    </div>
                    {quote && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price Impact:</span>
                        <span
                          className={
                            parseFloat(quote.priceImpactPct) > 1
                              ? "text-red-400"
                              : "text-emerald-400"
                          }
                        >
                          {parseFloat(quote.priceImpactPct).toFixed(3)}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Slippage:</span>
                      <span className="text-white">{slippage}%</span>
                    </div>
                    {quote && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Route:</span>
                        <span className="text-white">
                          {quote.routePlan
                            .map((route) => route.swapInfo.label)
                            .join(" → ")}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Network Fee:</span>
                      <span className="text-white">~0.000005 SOL</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep("form")}
                      className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={executeSwap}
                      className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-lg"
                      disabled={isLoading}
                    >
                      {isLoading ? "Swapping..." : "Confirm Swap"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
