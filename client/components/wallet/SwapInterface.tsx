import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Settings, Check, ExternalLink } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import { jupiterAPI, JupiterQuoteResponse } from "@/lib/services/jupiter";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { localSwapAPI } from "@/lib/services/localswap";
import { Keypair, VersionedTransaction } from "@solana/web3.js";

interface SwapInterfaceProps {
  onBack: () => void;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({ onBack }) => {
  const { wallet, balance, tokens, refreshBalance, connection } =
    useWallet() as any;
  const { toast } = useToast();

  const [mode, setMode] = useState<"buy" | "sell">("buy");

  // Buy mode state
  const [buyUsdAmount, setBuyUsdAmount] = useState("");
  const [buyToken, setBuyToken] = useState<TokenInfo | null>(null);
  const [buyTokenAmount, setBuyTokenAmount] = useState("");
  const [buyQuote, setBuyQuote] = useState<JupiterQuoteResponse | null>(null);

  // Sell mode state
  const [sellTokenAmount, setSellTokenAmount] = useState("");
  const [sellToken, setSellToken] = useState<TokenInfo | null>(null);
  const [sellUsdPrice, setSellUsdPrice] = useState("");
  const [sellQuote, setSellQuote] = useState<JupiterQuoteResponse | null>(null);

  const [slippage, setSlippage] = useState("0.5");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>(
    tokens || [],
  );
  const allTokens = availableTokens;
  const [supportedMints, setSupportedMints] = useState<Set<string>>(new Set());
  const [quoteError, setQuoteError] = useState<string>("");
  const [buyTokenUsdPrice, setBuyTokenUsdPrice] = useState<number | null>(null);
  const [sellTokenUsdPrice, setSellTokenUsdPrice] = useState<number | null>(
    null,
  );
  const [solUsdPrice, setSolUsdPrice] = useState<number | null>(null);
  const [lastSwapFromToken, setLastSwapFromToken] = useState<TokenInfo | null>(
    null,
  );
  const [lastSwapToToken, setLastSwapToToken] = useState<TokenInfo | null>(
    null,
  );
  const [useLocalPool, setUseLocalPool] = useState(false);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        const jupiterTokens = await jupiterAPI.getStrictTokenList();

        // Ensure we have tokens (including fallback)
        if (!jupiterTokens || jupiterTokens.length === 0) {
          console.warn("No Jupiter tokens loaded, using user tokens only");
          setAvailableTokens(tokens || []);
          setSupportedMints(
            new Set((tokens || []).map((t: TokenInfo) => t.mint)),
          );
          return;
        }

        const popularTokens: TokenInfo[] = jupiterTokens
          .map((jt: any) => ({
            mint: jt.address,
            symbol: jt.symbol,
            name: jt.name,
            decimals: jt.decimals,
            logoURI: jt.logoURI,
          }));

        // Set supported mints from Jupiter (including any fallback tokens)
        const supportedMintSet = new Set(jupiterTokens.map((t: any) => t.address));
        setSupportedMints(supportedMintSet);

        // Log FXM token status for debugging
        const fxmMint = "Ghj3B53xFd3qUw3nywhRFbqAnoTEmLbLPaToM7gABm63";
        if (supportedMintSet.has(fxmMint)) {
          console.log("FXM token is in supported list");
        } else {
          console.warn("FXM token NOT in supported list - this may cause swap issues");
        }

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
        // Fallback to user tokens
        setAvailableTokens(tokens || []);
        setSupportedMints(
          new Set((tokens || []).map((t: TokenInfo) => t.mint)),
        );
      }
    };

    loadTokens();

    const sol = (tokens || []).find((t: TokenInfo) => t.symbol === "SOL");
    if (sol && !buyToken && !sellToken) {
      setBuyToken(sol);
      setSellToken(sol);
    }
  }, [tokens]);

  // Buy mode: Calculate token amount from USD amount
  useEffect(() => {
    const calculateBuyTokenAmount = async () => {
      if (!buyUsdAmount || !buyToken) {
        setBuyTokenAmount("");
        setBuyQuote(null);
        setQuoteError("");
        return;
      }

      const usdAmount = parseFloat(buyUsdAmount);
      if (usdAmount <= 0) {
        setBuyTokenAmount("");
        setBuyQuote(null);
        setQuoteError("");
        return;
      }

      try {
        const price = buyTokenUsdPrice;
        if (price && price > 0) {
          const tokenAmount = usdAmount / price;
          setBuyTokenAmount(tokenAmount.toFixed(6));
          setQuoteError("");
        } else {
          setBuyTokenAmount("");
          setQuoteError("Unable to fetch token price");
        }
      } catch (err) {
        console.error("Buy calculation error:", err);
        setBuyTokenAmount("");
        setQuoteError("");
      }
    };

    const t = setTimeout(calculateBuyTokenAmount, 300);
    return () => clearTimeout(t);
  }, [buyUsdAmount, buyToken, buyTokenUsdPrice]);

  // Sell mode: Calculate USD price from token amount
  useEffect(() => {
    const calculateSellUsdPrice = async () => {
      if (!sellTokenAmount || !sellToken) {
        setSellUsdPrice("");
        setSellQuote(null);
        setQuoteError("");
        return;
      }

      const tokenAmount = parseFloat(sellTokenAmount);
      if (tokenAmount <= 0) {
        setSellUsdPrice("");
        setSellQuote(null);
        setQuoteError("");
        return;
      }

      try {
        const price = sellTokenUsdPrice;
        if (price && price > 0) {
          const usdPrice = tokenAmount * price;
          setSellUsdPrice(usdPrice.toFixed(2));
          setQuoteError("");
        } else {
          setSellUsdPrice("");
          setQuoteError("Unable to fetch token price");
        }
      } catch (err) {
        console.error("Sell calculation error:", err);
        setSellUsdPrice("");
        setQuoteError("");
      }
    };

    const t = setTimeout(calculateSellUsdPrice, 300);
    return () => clearTimeout(t);
  }, [sellTokenAmount, sellToken, sellTokenUsdPrice]);

  // Load USD prices for buy token
  useEffect(() => {
    const loadBuyTokenPrice = async () => {
      if (!buyToken?.mint) {
        setBuyTokenUsdPrice(null);
        return;
      }
      try {
        const jupMap = await jupiterAPI.getTokenPrices([buyToken.mint]);
        let price: number | null = jupMap[buyToken.mint] ?? null;

        if (price == null || !(price > 0)) {
          const tokenData = await dexscreenerAPI.getTokenByMint(buyToken.mint);
          price = tokenData?.priceUsd ? parseFloat(tokenData.priceUsd) : null;
        }

        setBuyTokenUsdPrice(price ?? null);
      } catch (e) {
        setBuyTokenUsdPrice(null);
      }
    };
    loadBuyTokenPrice();
  }, [buyToken?.mint]);

  // Load USD prices for sell token
  useEffect(() => {
    const loadSellTokenPrice = async () => {
      if (!sellToken?.mint) {
        setSellTokenUsdPrice(null);
        return;
      }
      try {
        const jupMap = await jupiterAPI.getTokenPrices([sellToken.mint]);
        let price: number | null = jupMap[sellToken.mint] ?? null;

        if (price == null || !(price > 0)) {
          const tokenData = await dexscreenerAPI.getTokenByMint(sellToken.mint);
          price = tokenData?.priceUsd ? parseFloat(tokenData.priceUsd) : null;
        }

        setSellTokenUsdPrice(price ?? null);
      } catch (e) {
        setSellTokenUsdPrice(null);
      }
    };
    loadSellTokenPrice();
  }, [sellToken?.mint]);

  // Load SOL price
  useEffect(() => {
    const loadSolPrice = async () => {
      try {
        const jupMap = await jupiterAPI.getTokenPrices([
          "So11111111111111111111111111111111111111112",
        ]);
        let price: number | null =
          jupMap["So11111111111111111111111111111111111111112"] ?? null;

        if (price == null || !(price > 0)) {
          const tokenData = await dexscreenerAPI.getTokenByMint(
            "So11111111111111111111111111111111111111112",
          );
          price = tokenData?.priceUsd ? parseFloat(tokenData.priceUsd) : null;
        }

        setSolUsdPrice(price ?? null);
      } catch (e) {
        setSolUsdPrice(null);
      }
    };
    loadSolPrice();
  }, []);

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

  const validateBuySwap = (): string | null => {
    if (!buyToken) return "Please select a token";
    if (!buyUsdAmount || parseFloat(buyUsdAmount) <= 0)
      return "Enter a valid USD amount";
    return null;
  };

  const validateSellSwap = (): string | null => {
    if (!sellToken) return "Please select a token";
    if (!sellTokenAmount || parseFloat(sellTokenAmount) <= 0)
      return "Enter a valid token amount";
    if (parseFloat(sellTokenAmount) > getTokenBalance(sellToken))
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

  const handleBuyConfirm = () => {
    const err = validateBuySwap();
    if (err) {
      toast({
        title: "Invalid Transaction",
        description: err,
        variant: "destructive",
      });
      return;
    }
    executeBuySwap();
  };

  const handleSellConfirm = () => {
    const err = validateSellSwap();
    if (err) {
      toast({
        title: "Invalid Transaction",
        description: err,
        variant: "destructive",
      });
      return;
    }
    executeSellSwap();
  };

  const executeBuySwap = async () => {
    // For buy mode, we're buying the selected token with SOL
    if (!wallet || !buyToken) return;
    setIsLoading(true);

    try {
      const solToken = allTokens.find((t) => t.symbol === "SOL");
      if (!solToken) throw new Error("SOL token not found");

      const usdAmount = parseFloat(buyUsdAmount);

      // Use the state solUsdPrice if available, otherwise fetch it
      let fetchedSolUsdPrice = solUsdPrice;
      if (!fetchedSolUsdPrice || fetchedSolUsdPrice <= 0) {
        const solPrice = await jupiterAPI.getTokenPrices([solToken.mint]);
        fetchedSolUsdPrice = solPrice[solToken.mint] ?? null;
      }

      if (!fetchedSolUsdPrice || fetchedSolUsdPrice <= 0) {
        throw new Error("Unable to fetch SOL price");
      }

      const solAmountNeeded = usdAmount / fetchedSolUsdPrice;
      if (solAmountNeeded > balance) {
        throw new Error("Insufficient SOL balance for this purchase");
      }

      const amountInt = parseInt(
        jupiterAPI.formatSwapAmount(solAmountNeeded, solToken.decimals),
        10,
      );

      const quote = await jupiterAPI.getQuote(
        solToken.mint,
        buyToken.mint,
        amountInt,
        Math.max(1, Math.round(parseFloat(slippage || "0.5") * 100)),
      );

      if (!quote) {
        throw new Error("Unable to get swap quote");
      }

      const submitQuote = async (q: JupiterQuoteResponse): Promise<string> => {
        const swapRequest = {
          quoteResponse: q,
          userPublicKey: wallet.publicKey,
          wrapAndUnwrapSol: true,
        } as any;
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

        if (connection && typeof connection.sendRawTransaction === "function") {
          const sig = await connection.sendRawTransaction(serialized, {
            skipPreflight: false,
          });
          return sig;
        }

        const signedBase64 = (() => {
          let bin = "";
          const arr = serialized;
          for (let i = 0; i < arr.length; i++)
            bin += String.fromCharCode(arr[i]);
          try {
            return btoa(bin);
          } catch (e) {
            return Buffer.from(arr).toString("base64");
          }
        })();

        const simResp = await fetch(resolveApiUrl("/api/solana-simulate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedBase64 }),
        });
        if (!simResp.ok) {
          const txt = await simResp.text().catch(() => "");
          throw new Error(txt || simResp.statusText || "Simulation failed");
        }
        const simJson = await simResp.json();
        if (simJson?.insufficientLamports) {
          const d = simJson.insufficientLamports;
          const missingSOL = d.diffSol ?? (d.diff ? d.diff / 1e9 : null);
          throw new Error(
            `Insufficient SOL (~${missingSOL?.toFixed(6) ?? "0.000000"}) for fees/rent`,
          );
        }

        const sendResp = await fetch(resolveApiUrl("/api/solana-send"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedBase64 }),
        });
        if (!sendResp.ok) {
          const txt = await sendResp.text().catch(() => "");
          throw new Error(txt || sendResp.statusText || "Send failed");
        }
        const jb = await sendResp.json();
        if (jb.error) {
          throw new Error(jb.error?.message || "RPC send error");
        }
        return jb.result as string;
      };

      const sig = await submitQuote(quote);
      setTxSignature(sig);
      setLastSwapFromToken(solToken);
      setLastSwapToToken(buyToken);
      setStep("success");
      setTimeout(() => refreshBalance?.(), 2000);
      toast({
        title: "Buy Order Submitted",
        description: `Transaction submitted: ${sig}. Awaiting confirmation...`,
      });
      if (connection && typeof connection.getLatestBlockhash === "function") {
        try {
          const latest = await connection.getLatestBlockhash();
          await connection.confirmTransaction({
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight,
            signature: sig,
          });
          toast({
            title: "Buy Order Confirmed",
            description: `Purchased ${buyTokenAmount} ${buyToken?.symbol}`,
          });
        } catch {}
      }
    } catch (err: any) {
      console.error("Buy execution error:", err);
      toast({
        title: "Buy Failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const executeSellSwap = async () => {
    // For sell mode, we're selling the selected token for SOL
    if (!wallet || !sellToken) return;
    setIsLoading(true);

    try {
      const solToken = allTokens.find((t) => t.symbol === "SOL");
      if (!solToken) throw new Error("SOL token not found");

      const tokenAmount = parseFloat(sellTokenAmount);

      // Check for local pools first
      let localQuote = null;
      try {
        localQuote = await localSwapAPI.getQuote(
          sellToken.mint,
          solToken.mint,
          tokenAmount.toString(),
        );
      } catch (err) {
        console.log("Local pool not available:", err);
      }

      if (localQuote) {
        setUseLocalPool(true);
        // Execute local swap
        const executeLocalSwap = async () => {
          try {
            await localSwapAPI.executeSwap(
              localQuote.poolId,
              sellToken.mint,
              tokenAmount.toString(),
              localQuote.outputAmount,
            );
            setTxSignature(`local_${localQuote.poolId}`);
            setLastSwapFromToken(sellToken);
            setLastSwapToToken(solToken);
            setStep("success");
            setTimeout(() => refreshBalance?.(), 500);
            toast({
              title: "Swap Completed",
              description: `Swapped ${tokenAmount} ${sellToken.symbol} for ${localQuote.outputAmount} ${solToken.symbol}`,
            });
          } catch (err: any) {
            throw err;
          }
        };

        await executeLocalSwap();
        setIsLoading(false);
        return;
      }

      // Fall back to Jupiter
      const amountInt = parseInt(
        jupiterAPI.formatSwapAmount(tokenAmount, sellToken.decimals),
        10,
      );

      const quote = await jupiterAPI.getQuote(
        sellToken.mint,
        solToken.mint,
        amountInt,
        Math.max(1, Math.round(parseFloat(slippage || "0.5") * 100)),
      );

      if (!quote) {
        throw new Error("Unable to get swap quote");
      }

      setUseLocalPool(false);

      const submitQuote = async (q: JupiterQuoteResponse): Promise<string> => {
        const swapRequest = {
          quoteResponse: q,
          userPublicKey: wallet.publicKey,
          wrapAndUnwrapSol: true,
        } as any;
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

        if (connection && typeof connection.sendRawTransaction === "function") {
          const sig = await connection.sendRawTransaction(serialized, {
            skipPreflight: false,
          });
          return sig;
        }

        const signedBase64 = (() => {
          let bin = "";
          const arr = serialized;
          for (let i = 0; i < arr.length; i++)
            bin += String.fromCharCode(arr[i]);
          try {
            return btoa(bin);
          } catch (e) {
            return Buffer.from(arr).toString("base64");
          }
        })();

        const simResp = await fetch(resolveApiUrl("/api/solana-simulate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedBase64 }),
        });
        if (!simResp.ok) {
          const txt = await simResp.text().catch(() => "");
          throw new Error(txt || simResp.statusText || "Simulation failed");
        }
        const simJson = await simResp.json();
        if (simJson?.insufficientLamports) {
          const d = simJson.insufficientLamports;
          const missingSOL = d.diffSol ?? (d.diff ? d.diff / 1e9 : null);
          throw new Error(
            `Insufficient SOL (~${missingSOL?.toFixed(6) ?? "0.000000"}) for fees/rent`,
          );
        }

        const sendResp = await fetch(resolveApiUrl("/api/solana-send"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedBase64 }),
        });
        if (!sendResp.ok) {
          const txt = await sendResp.text().catch(() => "");
          throw new Error(txt || sendResp.statusText || "Send failed");
        }
        const jb = await sendResp.json();
        if (jb.error) {
          throw new Error(jb.error?.message || "RPC send error");
        }
        return jb.result as string;
      };

      const solReceived = jupiterAPI.parseSwapAmount(
        quote.outAmount,
        solToken.decimals,
      );
      const sig = await submitQuote(quote);
      setTxSignature(sig);
      setLastSwapFromToken(sellToken);
      setLastSwapToToken(solToken);
      setStep("success");
      setTimeout(() => refreshBalance?.(), 2000);
      toast({
        title: "Sell Order Submitted",
        description: `Transaction submitted: ${sig}. Awaiting confirmation...`,
      });
      if (connection && typeof connection.getLatestBlockhash === "function") {
        try {
          const latest = await connection.getLatestBlockhash();
          await connection.confirmTransaction({
            blockhash: latest.blockhash,
            lastValidBlockHeight: latest.lastValidBlockHeight,
            signature: sig,
          });
          toast({
            title: "Sell Order Confirmed",
            description: `Sold ${sellTokenAmount} ${sellToken?.symbol} for ${solReceived.toFixed(4)} SOL`,
          });
        } catch {}
      }
    } catch (err: any) {
      console.error("Sell execution error:", err);
      toast({
        title: "Sell Failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetSwap = () => {
    setBuyUsdAmount("");
    setBuyTokenAmount("");
    setSellTokenAmount("");
    setSellUsdPrice("");
    setStep("form");
    setTxSignature(null);
  };

  if (step === "success") {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white px-0 py-4 sm:px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

        <div className="w-full max-w-none sm:max-w-md mx-auto relative z-10 pt-8 px-0 sm:px-4">
          <div className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-2xl">
            <div className="p-8 text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 ring-2 ring-emerald-400/30">
                  <Check className="h-8 w-8 text-emerald-300" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Transaction Completed!
                </h3>
                <p className="text-white/80">
                  Your transaction has been successfully executed
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Sent:</span>
                  <span className="font-medium text-white">
                    {lastSwapFromToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Received:</span>
                  <span className="font-medium text-white">
                    {lastSwapToToken?.symbol}
                  </span>
                </div>
                {txSignature && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/70">Transaction:</span>
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
                  className="flex-1 bg-[#1a2540]/50 hover:bg-[#FF7A5C]/20 border border-[#FF7A5C]/30 text-white"
                >
                  New Transaction
                </Button>
                <Button
                  onClick={onBack}
                  className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white"
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
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white px-0 py-4 sm:px-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full max-w-none sm:max-w-md mx-auto relative z-10 px-0 sm:px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 pt-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-white hover:bg-[#FF7A5C]/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-white">
            {mode === "buy" ? "Buy" : "Sell"}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:text-white hover:bg-[#FF7A5C]/10 transition-colors"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Card */}
        <div className="bg-transparent border-0 rounded-none sm:rounded-2xl overflow-hidden text-white">
          <div className="p-5 space-y-4">
            {/* BUY/SELL Toggle */}
            <div className="flex gap-2">
              <Button
                onClick={() => setMode("buy")}
                className={`flex-1 rounded-lg font-semibold transition-all ${
                  mode === "buy"
                    ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white hover:from-[#FF6B4D] hover:to-[#FF4D7D]"
                    : "bg-[#1a2540]/50 text-white/70 border border-[#FF7A5C]/30 hover:bg-[#1a2540]/70 hover:text-white"
                }`}
              >
                BUY
              </Button>
              <Button
                onClick={() => setMode("sell")}
                className={`flex-1 rounded-lg font-semibold transition-all ${
                  mode === "sell"
                    ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white hover:from-[#FF6B4D] hover:to-[#FF4D7D]"
                    : "bg-[#1a2540]/50 text-white/70 border border-[#FF7A5C]/30 hover:bg-[#1a2540]/70 hover:text-white"
                }`}
              >
                SELL
              </Button>
            </div>
            {mode === "buy" ? (
              <>
                {/* BUY MODE */}
                <Card className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
                  <CardContent className="p-4">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                      Amount in USD
                    </label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={buyUsdAmount}
                      onChange={(e) => setBuyUsdAmount(e.target.value)}
                      className="w-full bg-transparent border-0 p-0 h-auto text-2xl leading-none tracking-tight text-white placeholder:text-gray-400 focus-visible:ring-0"
                    />
                    {buyUsdAmount && solUsdPrice && solUsdPrice > 0 && (
                      <div className="text-sm text-white/70 mt-3">
                        {(parseFloat(buyUsdAmount) / solUsdPrice).toFixed(6)}{" "}
                        SOL
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Token Amount Display */}
                {buyToken && (
                  <Card className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
                    <CardContent className="p-4">
                      <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                        You will receive
                      </label>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-semibold text-white">
                            {buyTokenAmount || "0.000000"}
                          </div>
                          <div className="text-sm text-white/70 mt-1">
                            {buyToken.symbol}
                          </div>
                        </div>
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={buyToken.logoURI}
                            alt={buyToken.symbol}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                            {buyToken.symbol.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Token Selector */}
                <Card className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
                  <CardContent className="p-4">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                      Select Token to Buy
                    </label>
                    <Select
                      value={buyToken?.mint || ""}
                      onValueChange={(v) => {
                        const t = allTokens.find((x) => x.mint === v);
                        if (t) setBuyToken(t);
                      }}
                    >
                      <SelectTrigger className="w-full bg-[#1a2540]/50 border-[#FF7A5C]/30 text-white hover:bg-[#1a2540]/70">
                        <SelectValue placeholder="Select a token">
                          {buyToken ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage
                                  src={buyToken.logoURI}
                                  alt={buyToken.symbol}
                                />
                                <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                                  {buyToken.symbol.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{buyToken.symbol}</span>
                            </div>
                          ) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-[#1a2540]/95 border border-[#FF7A5C]/30 text-white">
                        {allTokens.map((token) => (
                          <SelectItem
                            key={token.mint}
                            value={token.mint}
                            className="text-white hover:bg-[#FF7A5C]/20 focus:bg-[#FF7A5C]/20"
                          >
                            <div className="flex items-center gap-3 justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage
                                    src={token.logoURI}
                                    alt={token.symbol}
                                  />
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                                    {token.symbol.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{token.symbol}</span>
                              </div>
                              <span className="text-xs text-white/70">
                                {formatAmount(getTokenBalance(token))}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Alerts */}
                {quoteError && (
                  <Alert className="bg-red-500/10 border-red-400/20 text-red-200">
                    <AlertDescription>{quoteError}</AlertDescription>
                  </Alert>
                )}

                {/* Confirm Button */}
                <Button
                  onClick={handleBuyConfirm}
                  className="w-full h-12 rounded-xl font-semibold border-0 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-2xl transition-all mt-4"
                  disabled={!buyUsdAmount || !buyToken || isLoading}
                >
                  {isLoading ? "Processing..." : "CONFIRM BUY"}
                </Button>
              </>
            ) : (
              <>
                {/* SELL MODE */}
                <Card className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
                  <CardContent className="p-4">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                      Token Amount
                    </label>
                    <Input
                      type="number"
                      placeholder="0.000000"
                      value={sellTokenAmount}
                      onChange={(e) => setSellTokenAmount(e.target.value)}
                      className="w-full bg-transparent border-0 p-0 h-auto text-2xl leading-none tracking-tight text-white placeholder:text-gray-400 focus-visible:ring-0"
                    />
                    {sellToken && (
                      <div className="text-sm text-white/70 mt-2">
                        Balance: {formatAmount(getTokenBalance(sellToken))}{" "}
                        {sellToken.symbol}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Price in USD */}
                <Card className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
                  <CardContent className="p-4">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                      Price in USD
                    </label>
                    <div className="text-2xl font-semibold text-white">
                      ${sellUsdPrice || "0.00"}
                    </div>
                  </CardContent>
                </Card>

                {/* Token Selector */}
                <Card className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
                  <CardContent className="p-4">
                    <label className="text-sm font-medium text-[hsl(var(--muted-foreground))] block mb-2">
                      Select Token to Sell
                    </label>
                    <Select
                      value={sellToken?.mint || ""}
                      onValueChange={(v) => {
                        const t = allTokens.find((x) => x.mint === v);
                        if (t) setSellToken(t);
                      }}
                    >
                      <SelectTrigger className="w-full bg-[#1a2540]/50 border-[#FF7A5C]/30 text-white hover:bg-[#1a2540]/70">
                        <SelectValue placeholder="Select a token">
                          {sellToken ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage
                                  src={sellToken.logoURI}
                                  alt={sellToken.symbol}
                                />
                                <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                                  {sellToken.symbol.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{sellToken.symbol}</span>
                            </div>
                          ) : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-[#1a2540]/95 border border-[#FF7A5C]/30 text-white">
                        {allTokens.map((token) => (
                          <SelectItem
                            key={token.mint}
                            value={token.mint}
                            className="text-white hover:bg-[#FF7A5C]/20 focus:bg-[#FF7A5C]/20"
                          >
                            <div className="flex items-center gap-3 justify-between">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage
                                    src={token.logoURI}
                                    alt={token.symbol}
                                  />
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-white">
                                    {token.symbol.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{token.symbol}</span>
                              </div>
                              <span className="text-xs text-white/70">
                                {formatAmount(getTokenBalance(token))}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Alerts */}
                {quoteError && (
                  <Alert className="bg-red-500/10 border-red-400/20 text-red-200">
                    <AlertDescription>{quoteError}</AlertDescription>
                  </Alert>
                )}

                {/* Confirm Button */}
                <Button
                  onClick={handleSellConfirm}
                  className="w-full h-12 rounded-xl font-semibold border-0 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-2xl transition-all mt-4"
                  disabled={!sellTokenAmount || !sellToken || isLoading}
                >
                  {isLoading ? "Processing..." : "CONFIRM SELL"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
