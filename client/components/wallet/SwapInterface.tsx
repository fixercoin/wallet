import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import { jupiterV6API } from "@/lib/services/jupiter-v6";
import { rpcCall } from "@/lib/rpc-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SystemProgram,
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { bytesFromBase64, base64FromBytes } from "@/lib/bytes";

const FIXER_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const FEE_WALLET = "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM";
const FEE_PERCENTAGE = 0.01;

const BloomExplosion: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  const colors = [
    "#ff006e",
    "#fb5607",
    "#ffbe0b",
    "#8338ec",
    "#3a86ff",
    "#06ffa5",
    "#ff006e",
    "#fb5607",
    "#ffbe0b",
    "#8338ec",
    "#3a86ff",
    "#06ffa5",
    "#ff006e",
    "#fb5607",
    "#ffbe0b",
    "#8338ec",
    "#3a86ff",
    "#06ffa5",
  ];

  const particles = Array.from({ length: 150 }).map((_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 400;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const width = 4 + Math.random() * 6;
    const height = 6 + Math.random() * 10;
    const delay = Math.random() * 0.2;
    const rotation = Math.random() * 360;
    const spinSpeed = 1 + Math.random() * 3;

    return {
      tx,
      ty,
      id: i,
      color: colors[i % colors.length],
      width,
      height,
      delay,
      rotation,
      spinSpeed,
    };
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <style>{`
        @keyframes burst-particle {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1) rotate(var(--rotation));
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx), var(--ty)) scale(0) rotate(calc(var(--rotation) + 720deg));
          }
        }
        @keyframes done-pulse {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          40% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>

      {particles.map((p) => (
        <div
          key={p.id}
          style={
            {
              position: "fixed",
              left: "50%",
              top: "50%",
              width: `${p.width}px`,
              height: `${p.height}px`,
              backgroundColor: p.color,
              borderRadius: "2px",
              marginLeft: `-${p.width / 2}px`,
              marginTop: `-${p.height / 2}px`,
              "--tx": `${p.tx}px`,
              "--ty": `${p.ty}px`,
              "--rotation": `${p.rotation}deg`,
              animation: `burst-particle 2s ease-out forwards`,
              animationDelay: `${p.delay}s`,
            } as any
          }
        />
      ))}

      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          animation: "done-pulse 0.8s ease-out forwards",
          zIndex: 60,
        }}
      >
        <div
          className="text-5xl font-bold text-white drop-shadow-lg"
          style={{
            textShadow:
              "0 0 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.4)",
            letterSpacing: "0.1em",
          }}
        >
          DONE
        </div>
      </div>
    </div>
  );
};

function addFeeTransferInstruction(
  tx: VersionedTransaction,
  fromMint: string,
  fromAmount: string,
  decimals: number,
  userPublicKey: string,
): VersionedTransaction {
  const feeAmount = BigInt(
    Math.floor(parseFloat(fromAmount) * 10 ** decimals * FEE_PERCENTAGE),
  );

  if (feeAmount === 0n) {
    return tx;
  }

  try {
    const feeWalletPubkey = new PublicKey(FEE_WALLET);
    const userPubkey = new PublicKey(userPublicKey);
    const fromMintPubkey = new PublicKey(fromMint);

    let feeInstruction: TransactionInstruction;

    if (fromMint === SOL_MINT) {
      feeInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: feeWalletPubkey,
        lamports: Number(feeAmount),
      });
    } else {
      const userTokenAccount = getAssociatedTokenAddress(
        fromMintPubkey,
        userPubkey,
        false,
      );
      const feeTokenAccount = getAssociatedTokenAddress(
        fromMintPubkey,
        feeWalletPubkey,
        false,
      );

      feeInstruction = createTransferCheckedInstruction(
        userTokenAccount,
        fromMintPubkey,
        feeTokenAccount,
        userPubkey,
        Number(feeAmount),
        decimals,
      );
    }

    tx.message.instructions.push(feeInstruction);
    return tx;
  } catch (error) {
    console.error("Error adding fee transfer instruction:", error);
    return tx;
  }
}

function coerceSecretKey(val: unknown): Uint8Array | null {
  try {
    if (!val) return null;
    if (val instanceof Uint8Array) return val;
    if (Array.isArray(val)) return Uint8Array.from(val as number[]);
    if (typeof val === "string") {
      try {
        const bin = atob(val);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        if (out.length > 0) return out;
      } catch {}
      try {
        const arr = JSON.parse(val);
        if (Array.isArray(arr)) return Uint8Array.from(arr as number[]);
      } catch {}
    }
    if (typeof val === "object") {
      const values = Object.values(val as Record<string, unknown>).filter(
        (x) => typeof x === "number",
      ) as number[];
      if (values.length > 0) return Uint8Array.from(values);
    }
  } catch {}
  return null;
}

function getKeypair(walletData: any): Keypair | null {
  try {
    const sk = coerceSecretKey(walletData?.secretKey);
    if (!sk || sk.length === 0) return null;
    return Keypair.fromSecretKey(sk);
  } catch {
    return null;
  }
}

async function sendSignedTx(
  txBase64: string,
  keypair: Keypair,
): Promise<string> {
  const buf = bytesFromBase64(txBase64);
  const vtx = VersionedTransaction.deserialize(buf);
  vtx.sign([keypair]);
  const signed = vtx.serialize();
  const signedBase64 = base64FromBytes(signed);

  // Send transaction through backend proxy to avoid CORS issues
  try {
    const response = await fetch("/api/solana-send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signedBase64,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.signature || data.result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to send transaction: ${msg}`);
  }
}

export const SwapInterface: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { wallet, tokens: userTokens } = useWallet();
  const { toast } = useToast();

  const [tokenList, setTokenList] = useState([]);
  const [fromMint, setFromMint] = useState(SOL_MINT);
  const [toMint, setToMint] = useState(FIXER_MINT);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [quoteAge, setQuoteAge] = useState(0);

  // Quote validity constants (in milliseconds)
  const QUOTE_MAX_AGE_MS = 30000; // Jupiter quotes valid for 30 seconds
  const QUOTE_WARNING_THRESHOLD_MS = 5000; // Show warning at 5 seconds remaining

  const fromToken = tokenList.find((t) => t.address === fromMint);
  const toToken = tokenList.find((t) => t.address === toMint);
  const fromTokenBalance =
    userTokens?.find((t) => t.mint === fromMint)?.balance || 0;
  const toTokenBalance =
    userTokens?.find((t) => t.mint === toMint)?.balance || 0;

  const initTokenList = async () => {
    if (initialized) return;

    try {
      // Build token list from TOKEN_MINTS constants + user tokens
      const tokenMintEntries = Object.entries(TOKEN_MINTS);
      const standardTokens = tokenMintEntries.map(([symbol, mint]) => ({
        address: mint,
        symbol,
        decimals: symbol === "SOL" ? 9 : 6,
        name: symbol,
      }));

      // Add user tokens if available (avoid duplicates with standard tokens)
      const standardMints = new Set(standardTokens.map((t) => t.address));
      const userTokensNotInStandard = (userTokens || []).filter(
        (ut) => !standardMints.has(ut.mint),
      );

      const combinedTokens = [
        ...standardTokens,
        ...userTokensNotInStandard.map((ut) => ({
          address: ut.mint,
          symbol: ut.symbol,
          decimals: ut.decimals,
          name: ut.name,
        })),
      ];

      // Sort: SOL first, then FIXERCOIN, then alphabetical
      combinedTokens.sort((a, b) => {
        if (a.address === SOL_MINT) return -1;
        if (b.address === SOL_MINT) return 1;
        if (a.address === FIXER_MINT) return -1;
        if (b.address === FIXER_MINT) return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      setTokenList(combinedTokens);
      setInitialized(true);
      setStatus("");
    } catch (err) {
      console.error("[SwapInterface] Error loading tokens:", err);
      // Fallback to minimal token list
      const fallbackTokens = [
        { address: SOL_MINT, symbol: "SOL", decimals: 9, name: "Solana" },
        {
          address: FIXER_MINT,
          symbol: "FIXERCOIN",
          decimals: 6,
          name: "FIXERCOIN",
        },
      ];
      setTokenList(fallbackTokens);
      setInitialized(true);
      setStatus("");
    }
  };

  useEffect(() => {
    if (!wallet) return;

    setInitialized(false);

    if (userTokens && userTokens.length > 0 && tokenList.length === 0) {
      const fallbackTokens = userTokens.map((ut) => ({
        address: ut.mint,
        symbol: ut.symbol,
        decimals: ut.decimals,
        name: ut.name,
      }));
      setTokenList(fallbackTokens);
    }

    initTokenList().catch((e) => {
      console.warn("Token list init warning:", e);
    });
  }, [wallet, userTokens]);

  // Track quote age over time
  useEffect(() => {
    if (!quote || !quote.quoteTime) {
      setQuoteAge(0);
      return;
    }

    const updateQuoteAge = () => {
      const age = Date.now() - quote.quoteTime;
      setQuoteAge(age);

      // Auto-refresh quote if it's getting too old (near expiration)
      if (age > QUOTE_MAX_AGE_MS - 2000 && age < QUOTE_MAX_AGE_MS) {
        console.log(
          "[SwapInterface] Quote approaching expiration, refreshing...",
        );
        getQuote().catch((e) => console.warn("Auto-refresh quote failed:", e));
      }
    };

    // Update immediately
    updateQuoteAge();

    // Update every 500ms while quote is valid
    const interval = setInterval(updateQuoteAge, 500);
    return () => clearInterval(interval);
  }, [quote?.quoteTime]);

  // Auto-fetch quotes when amount, fromMint, or toMint changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (amount && fromMint && toMint && !isLoading) {
        getQuote().catch((e) => console.error("Auto-fetch quote failed:", e));
      } else if (!amount) {
        setQuote(null);
        setStatus("");
      }
    }, 500); // 500ms debounce to avoid too many requests

    return () => clearTimeout(debounceTimer);
  }, [amount, fromMint, toMint, wallet]);

  const humanToRaw = (amountStr, decimals) => {
    const amt = Number(amountStr);
    if (isNaN(amt) || amt <= 0) throw new Error("Invalid amount");
    return BigInt(Math.round(amt * Math.pow(10, decimals)));
  };

  const isQuoteExpired = (): boolean => {
    if (!quote || !quote.quoteTime) return true;
    return quoteAge >= QUOTE_MAX_AGE_MS;
  };

  const isQuoteWarning = (): boolean => {
    if (!quote || !quote.quoteTime) return false;
    return (
      quoteAge >= QUOTE_MAX_AGE_MS - QUOTE_WARNING_THRESHOLD_MS &&
      !isQuoteExpired()
    );
  };

  const getQuoteTimeRemaining = (): number => {
    const remaining = Math.max(0, QUOTE_MAX_AGE_MS - quoteAge);
    return Math.ceil(remaining / 1000);
  };

  const getQuote = async () => {
    try {
      setStatus("Computing Jupiter routes…");
      setIsLoading(true);

      if (!wallet) {
        setStatus("No wallet detected.");
        setIsLoading(false);
        return null;
      }

      if (!fromMint || !toMint) {
        throw new Error("Select tokens");
      }

      const fromToken = tokenList.find((t) => t.address === fromMint);
      const toToken = tokenList.find((t) => t.address === toMint);
      if (!fromToken || !toToken) {
        throw new Error("Token metadata not found");
      }

      const decimalsIn = fromToken.decimals ?? 6;

      // Validate amount is not empty or zero
      const amountNum = Number(amount || "0");
      if (isNaN(amountNum) || amountNum <= 0) {
        setQuote(null);
        setStatus("Enter an amount to get a quote");
        setIsLoading(false);
        return null;
      }

      const amountRaw = humanToRaw(amount, decimalsIn);
      const amountStr = jupiterV6API.formatSwapAmount(
        Number(amountRaw) / Math.pow(10, decimalsIn),
        decimalsIn,
      );

      // Use 1% slippage tolerance (100 basis points) for more forgiving execution
      const quoteResponse = await jupiterV6API.getQuote(
        fromMint,
        toMint,
        amountStr,
        100,
      );

      if (!quoteResponse) {
        setQuote(null);
        setStatus("No route available. Try a different amount or token pair.");
        setIsLoading(false);
        return null;
      }

      // Validate quote response has required fields
      if (!quoteResponse.outAmount) {
        setQuote(null);
        setStatus("Invalid quote response. Please try again.");
        setIsLoading(false);
        console.error(
          "[SwapInterface] Quote missing outAmount:",
          quoteResponse,
        );
        return null;
      }

      try {
        const outAmount = BigInt(quoteResponse.outAmount);
        const outHuman =
          Number(outAmount) / Math.pow(10, toToken.decimals ?? 6);
        const priceImpact = jupiterV6API.getPriceImpact(quoteResponse);

        setQuote({
          quoteResponse,
          outHuman,
          outToken: toToken.symbol,
          hops: quoteResponse.routePlan?.length ?? 0,
          priceImpact,
          quoteTime: Date.now(),
          slippageBps: 100,
        });
        setStatus("");
        setIsLoading(false);
        return { quoteResponse };
      } catch (bigintErr) {
        setQuote(null);
        setStatus("Invalid quote amount format. Please try again.");
        setIsLoading(false);
        console.error(
          "[SwapInterface] BigInt conversion error:",
          bigintErr,
          quoteResponse,
        );
        return null;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      let friendlyMsg = "Failed to get quote. ";

      if (errorMsg.includes("timeout")) {
        friendlyMsg += "Network timeout. Please try again.";
      } else if (errorMsg.includes("STALE_QUOTE")) {
        friendlyMsg += "Quote expired. Please request a new quote.";
      } else if (errorMsg.includes("simulation")) {
        friendlyMsg += "Transaction would fail. Try a different amount.";
      } else if (errorMsg.includes("NO_ROUTE")) {
        friendlyMsg += "No trading route found for this pair.";
      } else {
        friendlyMsg += errorMsg;
      }

      setStatus(friendlyMsg);
      setIsLoading(false);
      console.error("[SwapInterface] Quote error:", err);
    }
  };

  const confirmSwap = async () => {
    try {
      setStatus("Preparing swap��");
      setIsLoading(true);

      if (!wallet) {
        setStatus("No wallet detected.");
        setIsLoading(false);
        return null;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setStatus("Enter a valid amount");
        setIsLoading(false);
        return null;
      }

      if (isQuoteExpired()) {
        setStatus("Quote has expired. Please get a fresh quote.");
        setIsLoading(false);
        toast({
          title: "Quote Expired",
          description:
            "Your quote has expired. Please request a new quote before swapping.",
          variant: "destructive",
        });
        return null;
      }

      const fromToken = tokenList.find((t) => t.address === fromMint);
      const toToken = tokenList.find((t) => t.address === toMint);

      if (!fromToken || !toToken) {
        setStatus("Token metadata not found");
        setIsLoading(false);
        return null;
      }

      const amountInHuman = parseFloat(amount);

      // ✅ Use Jupiter V6 for all token-to-token swaps
      setStatus("Preparing Jupiter swap…");

      if (!quote || !quote.quoteResponse) {
        throw new Error("Please get a quote first by clicking 'Get Quote'");
      }

      // Smart quote refresh: be aggressive about freshness (refresh if >10 seconds old)
      const oldQuote = quote.quoteResponse;
      let freshQuote = oldQuote;
      const slippageBps = quote.slippageBps || 100;

      // Check if quote still has reasonable time left (>10 seconds remaining)
      const timeRemaining = getQuoteTimeRemaining();
      const shouldRefresh = timeRemaining <= 10;

      if (shouldRefresh) {
        setStatus("Refreshing quote…");
        try {
          const refreshed = await jupiterV6API.getQuote(
            oldQuote.inputMint,
            oldQuote.outputMint,
            parseInt(oldQuote.inAmount),
            slippageBps,
          );
          if (refreshed) {
            freshQuote = refreshed;
            console.log("✅ Quote refreshed successfully before swap");
          } else {
            console.warn(
              "Quote refresh returned null, attempting swap with original quote",
            );
          }
        } catch (refreshErr) {
          console.warn(
            "Quote refresh failed, attempting swap with original quote",
          );
          const refreshErrorMsg =
            refreshErr instanceof Error
              ? refreshErr.message
              : String(refreshErr);
          if (refreshErrorMsg.includes("timeout")) {
            throw new Error(`Quote refresh timed out. Please try again.`);
          }
          // Continue with original quote - let Jupiter validation handle it
        }
      } else {
        console.log(
          `Quote fresh (${timeRemaining}s remaining), using current quote`,
        );
      }

      // Verify quote is not stale before sending to Jupiter
      if (quoteAge >= QUOTE_MAX_AGE_MS) {
        throw new Error(
          "Quote expired during execution. Please get a new quote and try again.",
        );
      }

      // Request swap transaction from Jupiter
      setStatus("Creating swap transaction…");
      const swapResponse = await jupiterV6API.createSwap(
        freshQuote,
        wallet.publicKey,
        {
          wrapAndUnwrapSol: true,
          useSharedAccounts: true,
        },
      );

      if (!swapResponse || !swapResponse.swapTransaction) {
        throw new Error("Failed to create swap transaction");
      }

      const txBase64 = swapResponse.swapTransaction;

      try {
        // Sign the transaction with local wallet
        setStatus("Signing transaction…");
        const tx = VersionedTransaction.deserialize(bytesFromBase64(txBase64));

        const keypair = getKeypair(wallet);
        if (!keypair) {
          throw new Error("Invalid wallet secret key");
        }

        // Submit signed transaction
        setStatus("Submitting transaction…");
        const txSignature = await sendSignedTx(
          base64FromBytes(tx.serialize()),
          keypair,
        );

        setShowSuccess(true);
        setStatus("");
        setIsLoading(false);

        setTimeout(() => setShowSuccess(false), 1600);

        setAmount("");
        setQuote(null);
      } catch (swapError) {
        throw new Error(
          `Swap failed: ${swapError instanceof Error ? swapError.message : String(swapError)}`,
        );
      }
    } catch (err) {
      setIsLoading(false);
      setQuote(null);
      setStatus("");

      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);

      if (
        errorMsg.includes("QUOTE_EXPIRED") ||
        errorMsg.includes("STALE_QUOTE") ||
        errorMsg.includes("expired") ||
        errorMsg.includes("Quote expired")
      ) {
        toast({
          title: "Quote Expired",
          description:
            "The quote expired or market conditions changed. Please request a new quote and try again.",
          variant: "default",
        });
        return null;
      }

      if (errorMsg.includes("refresh failed") || errorMsg.includes("timeout")) {
        toast({
          title: "Network Error",
          description:
            "Failed to refresh quote due to network issues. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Swap Failed",
        description: errorMsg || "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const executeSwap = async () => {
    if (!wallet) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive",
      });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Enter a valid amount",
        variant: "destructive",
      });
      return;
    }
    await confirmSwap();
  };

  if (!wallet) {
    return (
      <div className="w-full max-w-md mx-auto px-4">
        <div className="rounded-none border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] overflow-hidden">
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-none bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-lg font-semibold text-white uppercase">
                FIXORIUM TRADE
              </h3>
            </div>
            <p className="text-gray-600 text-center">
              No wallet detected. Please set up or import a wallet to use the
              swap feature.
            </p>
            <Button
              onClick={onBack}
              variant="outline"
              className="w-full border border-gray-700 text-gray-900 hover:bg-gray-50 uppercase rounded-none"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 relative z-0 pt-8">
      <div className="rounded-none border-0 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0]">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 rounded-none">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
          </div>
        )}

        <div className="space-y-6 p-6 relative">
          <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 p-0 rounded-none bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold text-sm text-white uppercase">
              FIXORIUM TRADE
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="from-token"
              className="text-gray-700 uppercase text-xs font-semibold"
            >
              From
            </Label>
            <div className="flex gap-3">
              <Select value={fromMint} onValueChange={setFromMint}>
                <SelectTrigger className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-none focus:outline-none focus:border-[#a7f3d0] focus:ring-0 transition-colors">
                  <SelectValue>
                    {fromToken ? (
                      <span className="text-gray-900 font-medium">
                        {fromToken.symbol}
                      </span>
                    ) : (
                      <span className="text-gray-400">Select token</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border border-gray-700 z-50 rounded-none">
                  {tokenList.length > 0 ? (
                    tokenList.map((t) => {
                      const tokenBalance =
                        userTokens?.find((ut) => ut.mint === t.address)
                          ?.balance || 0;
                      return (
                        <SelectItem key={t.address} value={t.address}>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {t.symbol}
                            </span>
                            <span className="text-gray-400 text-sm">
                              ({(tokenBalance || 0).toFixed(6)})
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    <div className="p-2 text-center text-sm text-gray-400">
                      Loading tokens...
                    </div>
                  )}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-none px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="to-token"
              className="text-gray-700 uppercase text-xs font-semibold"
            >
              To
            </Label>
            <Select value={toMint} onValueChange={setToMint}>
              <SelectTrigger className="w-full bg-transparent border border-gray-700 text-gray-900 rounded-none focus:outline-none focus:border-[#a7f3d0] focus:ring-0 transition-colors">
                <SelectValue>
                  {toToken ? (
                    <span className="text-gray-900 font-medium">
                      {toToken.symbol}
                    </span>
                  ) : (
                    <span className="text-gray-400">Select token</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border border-gray-700 z-50 rounded-none">
                {tokenList.length > 0 ? (
                  tokenList.map((t) => {
                    const tokenBalance =
                      userTokens?.find((ut) => ut.mint === t.address)
                        ?.balance || 0;
                    return (
                      <SelectItem key={t.address} value={t.address}>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {t.symbol}
                          </span>
                          <span className="text-gray-400 text-sm">
                            ({(tokenBalance || 0).toFixed(6)})
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <div className="p-2 text-center text-sm text-gray-400">
                    Loading tokens...
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {quote && (
            <div
              className={`p-4 border rounded-none transition-colors ${
                isQuoteExpired()
                  ? "bg-transparent border-red-200"
                  : isQuoteWarning()
                    ? "bg-transparent border-yellow-200"
                    : "bg-transparent border-[#a7f3d0]/30"
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Estimated receive:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {quote.outHuman.toFixed(6)} {quote.outToken}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-none ${
                        isQuoteExpired()
                          ? "bg-red-200 text-red-700"
                          : isQuoteWarning()
                            ? "bg-yellow-200 text-yellow-700"
                            : "bg-green-200 text-green-700"
                      }`}
                    >
                      {isQuoteExpired()
                        ? "Expired"
                        : `${getQuoteTimeRemaining()}s`}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Route hops:</span>
                  <span className="text-xs text-gray-600">{quote.hops}</span>
                </div>
                {quote.priceImpact !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Price impact:</span>
                    <span
                      className={`text-xs font-medium ${Math.abs(quote.priceImpact) > 5 ? "text-orange-600" : "text-green-600"}`}
                    >
                      {quote.priceImpact.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {status && (
            <div className="text-sm text-gray-700 font-medium bg-[#f0fff4]/60 border-l-0 border border-[#a7f3d0] p-3 rounded-none">
              {status}
            </div>
          )}

          <Button
            onClick={executeSwap}
            disabled={!amount || isLoading || isQuoteExpired()}
            className="w-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#1ea853] hover:to-[#15803d] text-white shadow-lg uppercase font-semibold py-3 rounded-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              isQuoteExpired()
                ? "Quote expired - please get a new quote"
                : isQuoteWarning()
                  ? `Quote expiring in ${getQuoteTimeRemaining()}s`
                  : ""
            }
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isQuoteExpired() ? (
              "Quote Expired - Get New Quote"
            ) : (
              "Swap (Smart Route)"
            )}
          </Button>
        </div>

        <BloomExplosion show={showSuccess} />
      </div>
    </div>
  );
};
