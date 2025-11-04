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
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import { jupiterAPI, JupiterQuoteResponse } from "@/lib/services/jupiter";
import { bytesFromBase64, base64FromBytes } from "@/lib/bytes";
import { birdeyeAPI } from "@/lib/services/birdeye";
import {
  Keypair,
  VersionedTransaction,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

interface SwapInterfaceProps {
  onBack: () => void;
}

const FEE_WALLET = "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM";
const SWAP_FEE_BPS = 30;

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
  const [meteoraQuote, setMeteoraQuote] = useState<any | null>(null);
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
          setQuoteError("");
          setIndicative(false);
          setIsLoading(false);
          return;
        }

        console.log(
          `Fetching quote for ${fromToken.symbol} -> ${toToken.symbol}, amount: ${amountInt}`,
        );

        let foundQuote = false;

        // Try Meteora first
        try {
          const mq = await getMeteoraQuote(
            fromToken.mint,
            toToken.mint,
            amountInt,
          );

          if (mq && mq.route) {
            console.log("Meteora provided a route", mq);
            setQuote(null);
            setMeteoraQuote(mq);

            const minReceivedRaw =
              mq.minimumReceived ??
              mq.minReceived ??
              mq.minimum_received ??
              mq.min_received ??
              mq.estimatedOut ??
              mq.outAmount ??
              null;

            if (minReceivedRaw != null && toToken?.decimals != null) {
              try {
                const outHuman =
                  typeof minReceivedRaw === "string"
                    ? parseInt(minReceivedRaw, 10) /
                      Math.pow(10, toToken.decimals)
                    : Number(minReceivedRaw) / Math.pow(10, toToken.decimals);
                setToAmount(isFinite(outHuman) ? outHuman.toFixed(6) : "");
                setQuoteError("");
                setIndicative(false);
                foundQuote = true;
              } catch (e) {
                console.debug("Failed to parse Meteora minReceived", e);
              }
            }

            if (foundQuote) {
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.debug("Meteora quote attempt failed silently:", e);
        }

        // Fall back to Birdeye pricing
        console.log(
          `Falling back to Birdeye pricing for ${fromToken.symbol} ↔ ${toToken.symbol}`,
        );
        const [fromBirdeye, toBirdeye] = await Promise.all([
          birdeyeAPI.getTokenByMint(fromToken.mint),
          birdeyeAPI.getTokenByMint(toToken.mint),
        ]);
        const fromUsd = fromBirdeye?.priceUsd
          ? parseFloat(String(fromBirdeye.priceUsd))
          : null;
        const toUsd = toBirdeye?.priceUsd
          ? parseFloat(String(toBirdeye.priceUsd))
          : null;

        if (fromUsd && toUsd && fromUsd > 0 && toUsd > 0) {
          const fromHuman = amountInt / Math.pow(10, fromToken.decimals);
          const estOutHuman = (fromHuman * fromUsd) / toUsd;
          setQuote(null);
          setToAmount(estOutHuman.toFixed(6));
          setQuoteError("");
          setIndicative(true);
        } else {
          console.debug(
            `No pricing data available: fromUsd=${fromUsd}, toUsd=${toUsd}`,
          );
          setQuote(null);
          setToAmount("");
          setQuoteError("");
          setIndicative(false);
        }
      } catch (err) {
        console.debug("Quote fetch error:", err);
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
        const tokens = await birdeyeAPI.getTokensByMints(mints);
        const birdeyeMap = birdeyeAPI.getTokenPrices(tokens);
        const fromPrice: number | null = fromToken?.mint
          ? (birdeyeMap[fromToken.mint] ?? null)
          : null;
        const toPrice: number | null = toToken?.mint
          ? (birdeyeMap[toToken.mint] ?? null)
          : null;
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
    if (isNaN(num)) return "0.00";
    if (symbol === "FIXERCOIN" || symbol === "LOCKER") {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return num.toFixed(3);
  };

  const validateSwap = (): string | null => {
    if (!fromToken || !toToken) return "Please select both tokens";
    if (!fromAmount || parseFloat(fromAmount) <= 0)
      return "Enter a valid amount";
    if (parseFloat(fromAmount) > getTokenBalance(fromToken))
      return "Insufficient balance";

    // Check if enough SOL for network fees
    const solToken = availableTokens.find((t) => t.symbol === "SOL");
    if (solToken) {
      const solBalance = getTokenBalance(solToken);
      const swapAmt = parseFloat(fromAmount || "0");
      // Need swap amount + transaction fee (~0.00025) + small buffer
      const minNeeded = fromToken?.symbol === "SOL" ? swapAmt + 0.0003 : 0.0005;
      if (solBalance < minNeeded) {
        return `Insufficient SOL. Need ${minNeeded.toFixed(6)} SOL, have ${solBalance.toFixed(6)} SOL`;
      }
    }

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

  const sendSwapFee = async (): Promise<void> => {
    if (!wallet || !connection || !fromToken) return;
    try {
      const kp = getKeypair();
      if (!kp) return;

      const feeRate = SWAP_FEE_BPS / 10000; // 0.30%
      const inputAmt = parseFloat(fromAmount || "0");
      if (!isFinite(inputAmt) || inputAmt <= 0) return;

      let feeInSol = 0;
      if (fromToken.symbol === "SOL") {
        feeInSol = inputAmt * feeRate;
      } else {
        const solInfo = await birdeyeAPI.getTokenByMint(TOKEN_MINTS.SOL);
        const solUsd = solInfo?.priceUsd || 0;
        const fromUsd = fromUsdPrice ?? null;
        const toUsd = toUsdPrice ?? null;
        const outAmt = parseFloat(toAmount || "0");

        let usdValue: number | null = null;
        if (fromUsd && isFinite(fromUsd)) {
          usdValue = inputAmt * fromUsd;
        } else if (toUsd && isFinite(toUsd) && isFinite(outAmt) && outAmt > 0) {
          usdValue = outAmt * toUsd;
        }

        if (usdValue && solUsd > 0) {
          feeInSol = (usdValue * feeRate) / solUsd;
        } else {
          return; // cannot price accurately; skip fee silently
        }
      }

      const feeLamports = Math.floor(feeInSol * LAMPORTS_PER_SOL);
      if (feeLamports <= 0) return;

      const feeWalletPubkey = new PublicKey(FEE_WALLET);
      const latestBlockhash = await connection.getLatestBlockhash();
      const tx = new Transaction({
        recentBlockhash: latestBlockhash.blockhash,
        feePayer: kp.publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: kp.publicKey,
          toPubkey: feeWalletPubkey,
          lamports: feeLamports,
        }),
      );

      tx.sign(kp);
      const serialized = tx.serialize();

      let bin = "";
      for (let i = 0; i < serialized.length; i++)
        bin += String.fromCharCode(serialized[i]);
      const signedBase64 = btoa(bin);

      const sendResp = await fetch(resolveApiUrl("/api/solana-send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedBase64 }),
      });

      if (!sendResp.ok) return;
      const jb = await sendResp.json();
      if (jb.result) {
        console.log("Swap fee transferred:", jb.result);
      }
    } catch (err) {
      console.warn("Failed to send swap fee:", err);
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
    if (!wallet) return;
    setIsLoading(true);

    try {
      // Helper to submit a single-quote swap via Jupiter
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
        const swapTransactionBuf = bytesFromBase64(
          swapResponse.swapTransaction,
        );
        const tx = VersionedTransaction.deserialize(swapTransactionBuf);
        tx.sign([kp]);
        const serialized = tx.serialize();

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
            return base64FromBytes(arr);
          }
        })();

        // Simulate
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

        // Send
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

      // If we have a direct quote, do normal single-leg swap
      if (quote) {
        const sig = await submitQuote(quote);
        setTxSignature(sig);
        setStep("success");
        setTimeout(() => refreshBalance?.(), 2000);
        toast({
          title: "Swap Submitted",
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
              title: "Swap Confirmed",
              description: `Swap ${fromAmount} ${fromToken?.symbol} → ${toAmount} ${toToken?.symbol} confirmed.`,
            });
            // Send fee silently after swap confirmation
            await sendSwapFee();
          } catch {}
        }
        return;
      }

      // If we have a direct quote, do normal single-leg swap
      if (quote) {
        const sig = await submitQuote(quote);
        setTxSignature(sig);
        setStep("success");
        setTimeout(() => refreshBalance?.(), 2000);
        toast({
          title: "Swap Submitted",
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
              title: "Swap Confirmed",
              description: `Swap ${fromAmount} ${fromToken?.symbol} → ${toAmount} ${toToken?.symbol} confirmed.`,
            });
            // Send fee silently after swap confirmation
            await sendSwapFee();
          } catch {}
        }
        return;
      }

      // If no Jupiter quote but we have a Meteora quote, use Meteora to build & send the swap
      if (!quote && meteoraQuote) {
        try {
          const swapTx = await buildMeteoraSwap(
            meteoraQuote.route,
            wallet.publicKey,
          );

          const txBase64 =
            swapTx?.transaction ||
            swapTx?.swapTransaction ||
            swapTx?.transactionBase64 ||
            swapTx?.base64 ||
            swapTx;
          if (!txBase64 || typeof txBase64 !== "string") {
            throw new Error("Invalid swap transaction returned from Meteora");
          }

          // Prefer provider-based signing (do NOT use raw secret keys)
          const provider =
            (window as any).solana ?? (window as any).fixorium ?? null;
          if (!provider || typeof provider.signTransaction !== "function") {
            throw new Error(
              "Wallet provider does not support signTransaction. Connect a compatible wallet/provider.",
            );
          }

          const tx = Transaction.from(Buffer.from(txBase64, "base64"));
          tx.feePayer = new PublicKey(wallet.publicKey);

          const signedTx = await provider.signTransaction(tx);

          let sig: string;
          if (
            connection &&
            typeof connection.sendRawTransaction === "function"
          ) {
            sig = await connection.sendRawTransaction(signedTx.serialize(), {
              skipPreflight: false,
            });
            // confirm
            const latest = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
              blockhash: latest.blockhash,
              lastValidBlockHeight: latest.lastValidBlockHeight,
              signature: sig,
            });
          } else {
            const signedBase64 = (() => {
              try {
                const arr = signedTx.serialize();
                let bin = "";
                for (let i = 0; i < arr.length; i++)
                  bin += String.fromCharCode(arr[i]);
                return btoa(bin);
              } catch (e) {
                return base64FromBytes(signedTx.serialize());
              }
            })();
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
            if (jb.error) throw new Error(jb.error?.message || "Send failed");
            sig = jb.result as string;
          }

          setTxSignature(sig);
          setStep("success");
          setTimeout(() => refreshBalance?.(), 2000);
          toast({
            title: "Swap Completed!",
            description: `Swap ${fromAmount} ${fromToken?.symbol} → ${toAmount} ${toToken?.symbol}`,
          });
          // send fee
          await sendSwapFee();
          return;
        } catch (e) {
          console.error("Meteora swap failed:", e);
          // continue to bridged attempts below
        }
      }

      // No direct route: attempt bridged two-leg swap via USDC or SOL
      if (!fromToken || !toToken) throw new Error("Missing tokens");
      const slippageBps = Math.max(
        1,
        Math.round(parseFloat(slippage || "0.5") * 100),
      );
      const amountInt = parseInt(
        jupiterAPI.formatSwapAmount(parseFloat(fromAmount), fromToken.decimals),
        10,
      );
      const BRIDGES = [TOKEN_MINTS.USDC, TOKEN_MINTS.USDT, TOKEN_MINTS.SOL];

      for (const bridge of BRIDGES) {
        if (bridge === fromToken.mint || bridge === toToken.mint) continue;
        const bridgeToken = allTokens.find((t) => t.mint === bridge);
        const bridgeDecimals =
          bridgeToken?.decimals ?? (bridge === BRIDGES[1] ? 9 : 6);

        const q1 = await jupiterAPI.getQuote(
          fromToken.mint,
          bridge,
          amountInt,
          slippageBps,
        );
        if (!q1) continue;
        const out1 = jupiterAPI.parseSwapAmount(q1.outAmount, bridgeDecimals);
        const amount2 = jupiterAPI.formatSwapAmount(out1, bridgeDecimals);
        const q2 = await jupiterAPI.getQuote(
          bridge,
          toToken.mint,
          parseInt(amount2, 10),
          slippageBps,
        );
        if (!q2) continue;

        // Execute leg1 then leg2
        const sig1 = await submitQuote(q1);
        toast({ title: "Leg 1 submitted", description: sig1 });
        const sig2 = await submitQuote(q2);
        setTxSignature(sig2);
        setToAmount(
          jupiterAPI.parseSwapAmount(q2.outAmount, toToken.decimals).toFixed(6),
        );
        setStep("success");
        setTimeout(() => refreshBalance?.(), 2000);
        toast({
          title: "Swap Completed!",
          description: `Bridged via ${bridgeToken?.symbol || "bridge"}`,
        });
        // Send fee silently after swap completion
        await sendSwapFee();
        return;
      }

      throw new Error(
        "No executable bridged route found. Liquidity may be insufficient.",
      );
    } catch (err: any) {
      console.error("Swap execution error:", err);

      let errorMsg = err instanceof Error ? err.message : String(err);

      // Improve error message for insufficient lamports
      if (
        errorMsg.includes("insufficient lamports") ||
        errorMsg.includes("Insufficient SOL")
      ) {
        errorMsg = `Insufficient SOL for transaction. You need more SOL to cover fees and rent. Current balance: ~${(balance || 0).toFixed(6)} SOL. Try adding more SOL to your wallet.`;
      } else if (errorMsg.includes("custom program error: 0x1")) {
        errorMsg = `Transaction failed: insufficient funds. You may need more SOL for transaction fees. Current balance: ~${(balance || 0).toFixed(6)} SOL. Add more SOL and try again.`;
      }

      toast({
        title: "Swap Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Meteora helpers - using proxied endpoints through server
  async function getMeteoraQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
  ) {
    const url = `${resolveApiUrl("/api/swap/meteora/quote")}?inputMint=${encodeURIComponent(
      inputMint,
    )}&outputMint=${encodeURIComponent(outputMint)}&amount=${encodeURIComponent(
      String(amount),
    )}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Meteora quote failed: ${resp.status}`);
    return resp.json();
  }

  async function buildMeteoraSwap(route: any, userPublicKey: string) {
    const res = await fetch(resolveApiUrl("/api/swap/meteora/swap"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route, userPublicKey }),
    });
    if (!res.ok) throw new Error(`Meteora build swap failed: ${res.status}`);
    return res.json();
  }

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
                      <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-gray-900">
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
                      <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-gray-900">
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
      <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 px-0 py-4 sm:px-4 relative overflow-hidden">
        <div className="w-full max-w-none sm:max-w-md mx-auto relative z-10 pt-8 px-0 sm:px-4">
          <div className="bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] border border-[#e6f6ec]/20 rounded-2xl">
            <div className="p-8 text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-emerald-500/10 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 ring-2 ring-emerald-200/30">
                  <Check className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Swap Completed!
                </h3>
                <p className="text-gray-600">
                  Your transaction has been successfully executed
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Swapped:</span>
                  <span className="font-medium text-gray-900">
                    {fromAmount} {fromToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Received:</span>
                  <span className="font-medium text-gray-900">
                    {toAmount} {toToken?.symbol}
                  </span>
                </div>
                {txSignature && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Transaction:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-emerald-500">
                        {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
                      </span>
                      <a
                        href={`https://solscan.io/tx/${txSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-500"
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
                  className="flex-1 bg-white/50 hover:bg-gray-50 border border-transparent text-gray-900"
                >
                  Swap Again
                </Button>
                <Button
                  onClick={onBack}
                  className="flex-1 bg-gradient-to-r from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] hover:from-[#f0fff4] hover:to-[#a7f3d0] text-gray-900"
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
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 px-0 py-4 sm:px-4 relative overflow-hidden">
      <div className="w-full max-w-none sm:max-w-md mx-auto relative z-10 px-0 sm:px-4">
        {/* Card */}
        <div className="rounded-none sm:rounded-2xl border-0 sm:border sm:border-[#e6f6ec]/20 overflow-hidden text-gray-900 bg-transparent sm:bg-gradient-to-br sm:from-[#ffffff] sm:via-[#f0fff4] sm:to-[#a7f3d0]">
          <div className="p-5 space-y-4">
            {/* Header with back button */}
            <div className="flex items-center gap-3 -mt-3 -mx-5 px-5 pt-3 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-lg font-semibold text-gray-900 flex-1">
                Swap
              </h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 text-gray-900 hover:text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            {/* FROM row */}
            <Card className="bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] border border-[#e6f6ec]/20 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <Input
                      type="number"
                      placeholder="0.000"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      className="w-full bg-transparent border-0 p-0 h-auto text-2xl leading-none tracking-tight text-gray-900 placeholder:text-gray-400 focus-visible:ring-0"
                    />
                    <div className="mt-2 text-xl text-gray-900">
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
                      <SelectTrigger className="h-11 rounded-full bg-white border border-[#e6f6ec]/20 text-gray-900 hover:bg-[#f0fff4] w-auto px-3 transition-colors">
                        <SelectValue>
                          <div className="flex items-center gap-2 text-gray-900">
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
                                <span className="font-medium text-gray-900">
                                  {fromToken.symbol}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-900">Select</span>
                            )}
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-gray-600 border border-[#e6f6ec]/20 text-gray-900">
                        {allTokens.map((token) => (
                          <SelectItem
                            key={token.mint}
                            value={token.mint}
                            className="text-gray-900 hover:bg-[#f0fff4]/50 focus:bg-[#f0fff4]/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Avatar className="h-5 w-5 ring-1 ring-white/20">
                                <AvatarImage
                                  src={token.logoURI}
                                  alt={token.symbol}
                                />
                                <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-gray-900">
                                  {token.symbol.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-xs whitespace-nowrap">
                                {token.symbol} ~{" "}
                                <span className="text-white">
                                  {formatAmount(
                                    getTokenBalance(token),
                                    token.symbol,
                                  )}
                                </span>
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fromToken ? (
                      <div className="mt-2 text-xs text-gray-900">
                        {formatAmount(
                          getTokenBalance(fromToken),
                          fromToken.symbol,
                        )}{" "}
                        {fromToken.symbol}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* swap arrow */}
            <div className="flex items-center justify-center py-1">
              <Button
                size="icon"
                onClick={handleSwapTokens}
                className="rounded-full h-9 w-9 bg-[#1a2540]/50 hover:bg-[#FF7A5C]/20 border border-[#FF7A5C]/30 text-gray-900 transition-colors"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>

            {/* TO row */}
            <Card className="bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] border border-[#e6f6ec]/20 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-3">
                    <div className="text-xl leading-none tracking-tight text-gray-900">
                      {toAmount
                        ? formatAmount(toAmount, toToken?.symbol)
                        : "0.000"}
                    </div>
                    <div className="mt-2 text-xl text-gray-900">
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
                      <SelectTrigger className="h-11 rounded-full bg-white border border-[#e6f6ec]/20 text-gray-900 hover:bg-[#f0fff4] w-auto px-3 transition-colors">
                        <SelectValue>
                          <div className="flex items-center gap-2 text-gray-900">
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
                                <span className="font-medium text-gray-900">
                                  {toToken.symbol}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-900">Select</span>
                            )}
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-60 bg-gray-600 border border-[#e6f6ec]/20 text-gray-900">
                        {allTokens.map((token) => (
                          <SelectItem
                            key={token.mint}
                            value={token.mint}
                            className="text-gray-900 hover:bg-[#f0fff4]/50 focus:bg-[#f0fff4]/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Avatar className="h-5 w-5 ring-1 ring-white/20">
                                <AvatarImage
                                  src={token.logoURI}
                                  alt={token.symbol}
                                />
                                <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-blue-600 text-gray-900">
                                  {token.symbol.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-xs whitespace-nowrap">
                                {token.symbol} ~{" "}
                                <span className="text-white">
                                  {formatAmount(
                                    getTokenBalance(token),
                                    token.symbol,
                                  )}
                                </span>
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {toToken ? (
                      <div className="mt-2 text-xs text-gray-900 font-mono">
                        {toToken.mint.slice(0, 4)}...{toToken.mint.slice(-3)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quote details */}
            {(quote || (indicative && toAmount)) && fromToken && toToken ? (
              <div className="mt-2 bg-[#1a2540]/50 border border-[#FF7A5C]/30 rounded-2xl p-4 space-y-3 text-gray-900">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">Quote</span>
                  <span className="text-sm text-gray-900">
                    1 {fromToken.symbol} ={" "}
                    {(
                      parseFloat(toAmount) / parseFloat(fromAmount || "1")
                    ).toFixed(4)}{" "}
                    {toToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-900">Network fee</span>
                  <span className="text-gray-900">Included</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-900">Time</span>
                  <span className="text-gray-900">&lt; 1 min</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-900">Rate includes</span>
                  <span className="text-gray-900">{slippage}% slippage</span>
                </div>
                <div className="text-right text-sm text-[#a855f7]">
                  More quotes
                </div>
              </div>
            ) : null}

            {/* Loading indicator */}
            {isLoading && (
              <Alert className="bg-yellow-500/10 border-yellow-400/20 text-yellow-200">
                Signing & Connecting - submitting transaction ...
              </Alert>
            )}

            {/* Quick % selector */}
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    const bal = getTokenBalance(fromToken || undefined);
                    const reserve = fromToken?.symbol === "SOL" ? 0.002 : 0; // leave SOL for fees
                    const usable = Math.max(0, (bal || 0) - reserve);
                    const amt = usable * (pct / 100);
                    const digits = Math.min(
                      6,
                      Math.max(0, fromToken?.decimals ?? 6),
                    );
                    setFromAmount(amt > 0 ? amt.toFixed(digits) : "");
                  }}
                  className="text-xs px-2 py-2 rounded-lg bg-[#1a2540]/50 hover:bg-[#FF7A5C]/20 text-gray-900 border border-[#FF7A5C]/30 transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>

            {/* Submit */}
            <Button
              onClick={handleSwap}
              className="mt-2 w-full h-12 rounded-xl font-semibold border-0 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-gray-900 shadow-lg hover:shadow-2xl transition-all"
              disabled={
                (!quote && !indicative) ||
                !!quoteError ||
                !fromToken ||
                !toToken ||
                !fromAmount ||
                isLoading
              }
            >
              {indicative ? "Swap (Estimated)" : "Submit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
