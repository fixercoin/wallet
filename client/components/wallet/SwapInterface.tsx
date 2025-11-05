import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Loader2 } from "lucide-react";
import {
  jupiterAPI,
  JupiterQuoteResponse,
  JupiterSwapResponse,
} from "@/lib/services/jupiter";
import {
  TokenInfo,
  recoverWallet,
} from "@/lib/wallet";
import { resolveApiUrl } from "@/lib/api-client";
import { VersionedTransaction, Keypair, Connection } from "@solana/web3.js";
import { bytesFromBase64, base64FromBytes } from "@/lib/bytes";
import { TOKEN_MINTS, PUMP_TOKENS } from "@/lib/constants";

const SOLANA_RPC_URL = "https://solana.publicnode.com";

export const SwapInterface: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { wallet, balance, tokens, refreshBalance } = useWallet() as any;
  const { toast } = useToast();

  const [fromToken, setFromToken] = useState<TokenInfo | null>(null);
  const [toToken, setToToken] = useState<TokenInfo | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<JupiterQuoteResponse | null>(null);
  const [allTokens, setAllTokens] = useState<TokenInfo[]>(tokens || []);

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
        setAllTokens(combined);
      } catch (err) {
        console.error("Error loading tokens:", err);
        setAllTokens(tokens || []);
      }
    };

    loadTokens();
    const sol = (tokens || []).find((t: TokenInfo) => t.symbol === "SOL");
    if (sol && !fromToken) setFromToken(sol);
  }, [tokens, fromToken]);

  useEffect(() => {
    const getQuote = async () => {
      if (!fromAmount || !fromToken || !toToken || parseFloat(fromAmount) <= 0) {
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
    [setFromToken, setFromAmount, setToToken, setToAmount].forEach((setter, i) => {
      if (i === 0) setFromToken(toToken);
      if (i === 1) setFromAmount(toAmount);
      if (i === 2) setToToken(fromToken);
      if (i === 3) setToAmount(fromAmount);
    });
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

  const executeSwap = async () => {
    if (!wallet || !wallet.publicKey || !quote) {
      toast({
        title: "Invalid Swap",
        description: "Wallet or quote missing",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const swapRequest = {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey,
        wrapAndUnwrapSol: true,
      };

      let swapResponse: JupiterSwapResponse | null = null;
      try {
        swapResponse = await jupiterAPI.getSwapTransaction(swapRequest);
      } catch (err: any) {
        const errMsg = String(err?.message || err);
        if (
          errMsg.includes("STALE_QUOTE") ||
          errMsg.includes("1016") ||
          errMsg.includes("simulation")
        ) {
          toast({
            title: "Quote Expired",
            description:
              "The quote expired. Refreshing and retrying...",
            variant: "default",
          });

          try {
            const amount = jupiterAPI.formatSwapAmount(
              parseFloat(fromAmount),
              fromToken?.decimals || 9,
            );
            const freshQuote = await jupiterAPI.getQuote(
              fromToken?.mint || "",
              toToken?.mint || "",
              parseInt(amount),
              parseInt(slippage) * 100,
            );
            if (freshQuote) {
              setQuote(freshQuote);
              await new Promise((resolve) => setTimeout(resolve, 500));
              return executeSwap();
            }
          } catch (refreshErr) {
            console.error("Quote refresh failed:", refreshErr);
          }
        }
        throw err;
      }

      if (!swapResponse || !swapResponse.swapTransaction) {
        throw new Error("Failed to get swap transaction");
      }

      const kp = getKeypair();
      if (!kp) throw new Error("Missing wallet key to sign transaction");

      const swapTransactionBuf = bytesFromBase64(swapResponse.swapTransaction);
      const tx = VersionedTransaction.deserialize(swapTransactionBuf);
      tx.sign([kp]);
      const serialized = tx.serialize();

      const signedBase64 = (() => {
        let bin = "";
        for (let i = 0; i < serialized.length; i++)
          bin += String.fromCharCode(serialized[i]);
        try {
          return btoa(bin);
        } catch (e) {
          return base64FromBytes(serialized);
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

      const result = await sendResp.json();
      if (result.error) {
        throw new Error(result.error?.message || "RPC send error");
      }

      toast({
        title: "Swap Completed!",
        description: `Successfully swapped ${fromAmount} ${fromToken?.symbol} for ${toAmount} ${toToken?.symbol}`,
      });

      setTimeout(() => refreshBalance?.(), 2000);
      setFromAmount("");
      setToAmount("");
      setQuote(null);
    } catch (err: any) {
      console.error("Swap execution error:", err);
      let message = err instanceof Error ? err.message : String(err);

      if (
        message.includes("No executable bridged route found") ||
        message.includes("Attempted bridges") ||
        message.toLowerCase().includes("no route")
      ) {
        message =
          "No route available. Try swapping via USDC or reduce the amount.";
      }

      toast({
        title: "Swap Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">Swap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">From</label>
          <div className="flex gap-2">
            <Select
              value={fromToken?.mint || ""}
              onValueChange={(v) => {
                const t = allTokens.find((x) => x.mint === v);
                if (t) setFromToken(t);
              }}
            >
              <SelectTrigger className="flex-1 bg-gray-800 border-gray-600">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {allTokens.map((t) => (
                  <SelectItem key={t.mint} value={t.mint}>
                    {t.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Amount"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-1 bg-gray-800 border-gray-600"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSwapTokens}
            className="bg-gray-800 border-gray-600"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">To</label>
          <div className="flex gap-2">
            <Select
              value={toToken?.mint || ""}
              onValueChange={(v) => {
                const t = allTokens.find((x) => x.mint === v);
                if (t) setToToken(t);
              }}
            >
              <SelectTrigger className="flex-1 bg-gray-800 border-gray-600">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {allTokens.map((t) => (
                  <SelectItem key={t.mint} value={t.mint}>
                    {t.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Amount"
              value={toAmount}
              onChange={(e) => setToAmount(e.target.value)}
              disabled
              className="flex-1 bg-gray-800 border-gray-600"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">Slippage</label>
          <Input
            type="number"
            placeholder="0.5"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className="bg-gray-800 border-gray-600"
          />
        </div>

        <Button
          onClick={executeSwap}
          disabled={!fromToken || !toToken || !fromAmount || isLoading || !quote}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            "Swap"
          )}
        </Button>

        <Button onClick={onBack} variant="outline" className="w-full">
          Back
        </Button>
      </CardContent>
    </Card>
  );
};
