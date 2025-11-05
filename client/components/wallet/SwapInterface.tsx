import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { PublicKey, Connection } from "@solana/web3.js";

const FIXER_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TV";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC = "https://api.mainnet-beta.solana.com";

export const SwapInterface: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { wallet } = useWallet();
  const { toast } = useToast();

  const [jupiter, setJupiter] = useState(null);
  const [tokenList, setTokenList] = useState([]);
  const [fromMint, setFromMint] = useState(SOL_MINT);
  const [toMint, setToMint] = useState(FIXER_MINT);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const initJupiter = async () => {
    if (initialized && jupiter) return jupiter;

    if (!wallet) {
      setStatus("No wallet detected.");
      return null;
    }

    setStatus("Initializing route solver...");

    try {
      const { Jupiter } = await import(
        "https://esm.sh/@jup-ag/core@4.3.0"
      );

      const connection = new Connection(RPC, "confirmed");
      const walletPublicKey = new PublicKey(wallet.publicKey);

      const localWalletAdapter = {
        publicKey: walletPublicKey,
        signTransaction: async (tx) => {
          const { Keypair } = await import("@solana/web3.js");
          let secretKey = wallet.secretKey;
          if (secretKey instanceof Uint8Array) {
            secretKey = secretKey;
          } else if (Array.isArray(secretKey)) {
            secretKey = Uint8Array.from(secretKey);
          }
          const keypair = Keypair.fromSecretKey(secretKey);
          tx.sign([keypair]);
          return tx;
        },
        signAllTransactions: async (txs) => {
          const { Keypair } = await import("@solana/web3.js");
          let secretKey = wallet.secretKey;
          if (secretKey instanceof Uint8Array) {
            secretKey = secretKey;
          } else if (Array.isArray(secretKey)) {
            secretKey = Uint8Array.from(secretKey);
          }
          const keypair = Keypair.fromSecretKey(secretKey);
          return txs.map(tx => {
            tx.sign([keypair]);
            return tx;
          });
        },
        connect: async () => walletPublicKey,
        disconnect: async () => {},
      };

      const jup = await Jupiter.load({
        connection,
        cluster: "mainnet-beta",
        user: localWalletAdapter,
      });

      const tokens = Object.values(jup.tokens);
      tokens.sort((a, b) => {
        if (a.address === SOL_MINT) return -1;
        if (b.address === SOL_MINT) return 1;
        if (a.address === FIXER_MINT) return -1;
        if (b.address === FIXER_MINT) return 1;
        return a.symbol.localeCompare(b.symbol);
      });

      setJupiter(jup);
      setTokenList(tokens);
      setInitialized(true);
      setStatus("");
      return jup;
    } catch (err) {
      setStatus("Error initializing Jupiter");
      console.error(err);
      throw err;
    }
  };

  useEffect(() => {
    setInitialized(false);
    initJupiter().catch((e) => {
      console.warn("Jupiter init warning:", e);
    });
  }, [wallet]);

  const humanToRaw = (amountStr, decimals) => {
    const amt = Number(amountStr);
    if (isNaN(amt) || amt <= 0) throw new Error("Invalid amount");
    return BigInt(Math.round(amt * Math.pow(10, decimals)));
  };

  const getQuote = async () => {
    try {
      setStatus("Computing routes…");
      setIsLoading(true);

      if (!wallet) {
        setStatus("No wallet detected.");
        return null;
      }

      let jup = jupiter;
      if (!jup) {
        jup = await initJupiter();
        if (!jup) {
          setStatus("Failed to initialize Jupiter.");
          return null;
        }
      }

      if (!fromMint || !toMint) {
        throw new Error("Select tokens");
      }

      const fromMeta = jup.tokens[fromMint];
      const toMeta = jup.tokens[toMint];
      if (!fromMeta || !toMeta) {
        throw new Error("Token metadata not found");
      }

      const decimalsIn = fromMeta.decimals ?? 6;
      const amountRaw = humanToRaw(amount || "0", decimalsIn);

      const routes = await jup.computeRoutes({
        inputMint: fromMint,
        outputMint: toMint,
        amount: amountRaw.toString(),
        slippage: 50,
      });

      if (!routes || !routes.routesInfos || routes.routesInfos.length === 0) {
        setQuote(null);
        setStatus("No route found for this pair/amount.");
        return null;
      }

      const best = routes.routesInfos[0];
      const outAmount = BigInt(best.outAmount) ?? BigInt(0);
      const outHuman =
        Number(outAmount) / Math.pow(10, toMeta.decimals ?? 6);

      setQuote({
        routes,
        best,
        outHuman,
        outToken: toMeta.symbol,
        hops: best.marketInfos.length,
      });
      setStatus("");
      setIsLoading(false);
      return { routes, best };
    } catch (err) {
      setStatus("Error: " + (err.message || err));
      setIsLoading(false);
      console.error(err);
    }
  };

  const executeSwap = async () => {
    try {
      setStatus("Preparing swap…");
      setIsLoading(true);

      if (!wallet) {
        setStatus("No wallet detected.");
        setIsLoading(false);
        return null;
      }

      let jup = jupiter;
      if (!jup) {
        jup = await initJupiter();
        if (!jup) {
          setStatus("Failed to initialize Jupiter.");
          setIsLoading(false);
          return null;
        }
      }

      if (!quote) {
        setStatus("Get a quote first");
        setIsLoading(false);
        return null;
      }

      const fromMeta = jup.tokens[fromMint];
      const toMeta = jup.tokens[toMint];

      const decimalsIn = fromMeta.decimals ?? 6;
      const amountRaw = humanToRaw(amount || "0", decimalsIn);

      const routes = await jup.computeRoutes({
        inputMint: fromMint,
        outputMint: toMint,
        amount: amountRaw.toString(),
        slippage: 50,
      });

      if (!routes || !routes.routesInfos || routes.routesInfos.length === 0) {
        throw new Error("No route found");
      }

      const routeInfo = routes.routesInfos[0];
      const { execute } = await jup.exchange({ routeInfo });

      setStatus("Signing and sending transaction…");

      const swapResult = await execute();

      setStatus(
        `Swap submitted. Signature: ${swapResult.txSig || swapResult.signature || "see console"}`
      );
      console.log("Swap result:", swapResult);

      toast({
        title: "Swap Completed!",
        description: `Successfully swapped ${amount} ${fromMeta.symbol} for ${quote.outHuman.toFixed(6)} ${toMeta.symbol}`,
      });

      setAmount("");
      setQuote(null);
      setStatus("");
      setIsLoading(false);

      return swapResult;
    } catch (err) {
      setStatus("Swap error: " + (err.message || err));
      setIsLoading(false);
      console.error(err);

      toast({
        title: "Swap Failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (!wallet) {
    return (
      <Card className="w-full bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Fixorium — Convert (Direct)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-gray-400">
          <p>No wallet detected. Please set up or import a wallet to use the swap feature.</p>
          <Button onClick={onBack} variant="outline" className="w-full">
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">Fixorium — Convert (Direct)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-gray-500 break-all">
          Wallet: {wallet.publicKey}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">From</label>
          <div className="flex gap-2">
            <select
              value={fromMint}
              onChange={(e) => setFromMint(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
            >
              {tokenList.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol} ({t.address.slice(0, 6)})
                </option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-gray-800 border-gray-600"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">To</label>
          <select
            value={toMint}
            onChange={(e) => setToMint(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          >
            {tokenList.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol} ({t.address.slice(0, 6)})
              </option>
            ))}
          </select>
        </div>

        {quote && (
          <div className="p-3 bg-gray-800 rounded text-sm text-gray-300">
            <strong>Estimated receive:</strong> {quote.outHuman.toFixed(6)}{" "}
            {quote.outToken} (route hops: {quote.hops})
          </div>
        )}

        {status && (
          <div className="text-sm text-gray-400">{status}</div>
        )}

        <Button
          onClick={getQuote}
          disabled={!amount || isLoading}
          variant="outline"
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Computing...
            </>
          ) : (
            "Get Quote"
          )}
        </Button>

        <Button
          onClick={executeSwap}
          disabled={!amount || !quote || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Swapping...
            </>
          ) : (
            "Convert (Swap)"
          )}
        </Button>

        <Button onClick={onBack} variant="outline" className="w-full">
          Back
        </Button>
      </CardContent>
    </Card>
  );
};
