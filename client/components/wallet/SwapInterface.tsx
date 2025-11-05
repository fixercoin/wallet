import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import { jupiterAPI } from "@/lib/services/jupiter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FIXER_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TV";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export const SwapInterface: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { wallet, tokens: userTokens } = useWallet();
  const { toast } = useToast();

  const [tokenList, setTokenList] = useState([]);
  const [fromMint, setFromMint] = useState(SOL_MINT);
  const [toMint, setToMint] = useState(FIXER_MINT);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const fromToken = tokenList.find((t) => t.address === fromMint);
  const toToken = tokenList.find((t) => t.address === toMint);
  const fromTokenBalance =
    userTokens?.find((t) => t.mint === fromMint)?.balance || 0;
  const toTokenBalance =
    userTokens?.find((t) => t.mint === toMint)?.balance || 0;

  const initTokenList = async () => {
    if (initialized) return;

    setStatus("Loading tokens...");

    try {
      const jupiterTokens = await jupiterAPI.getStrictTokenList();

      const setupTokenMints = Object.values(TOKEN_MINTS);
      const setupTokens = jupiterTokens.filter((t) =>
        setupTokenMints.includes(t.address),
      );

      const userTokenMints = (userTokens || []).map((t) => t.mint);
      const userSetupTokens = jupiterTokens.filter((t) =>
        userTokenMints.includes(t.address),
      );

      const combinedTokens = Array.from(
        new Map([
          ...setupTokens.map((t) => [t.address, t]),
          ...userSetupTokens.map((t) => [t.address, t]),
          ...jupiterTokens.map((t) => [t.address, t]),
        ]).values(),
      );

      if (combinedTokens.length === 0) {
        console.warn(
          "[SwapInterface] No tokens found from Jupiter, using user tokens as fallback",
        );
        const fallbackTokens = (userTokens || []).map((ut) => ({
          address: ut.mint,
          symbol: ut.symbol,
          decimals: ut.decimals,
          name: ut.name,
        }));
        setTokenList(fallbackTokens);
      } else {
        combinedTokens.sort((a, b) => {
          if (a.address === SOL_MINT) return -1;
          if (b.address === SOL_MINT) return 1;
          if (a.address === FIXER_MINT) return -1;
          if (b.address === FIXER_MINT) return 1;
          return a.symbol.localeCompare(b.symbol);
        });
        setTokenList(combinedTokens);
      }

      setInitialized(true);
      setStatus("");
    } catch (err) {
      console.error("[SwapInterface] Error loading tokens:", err);
      setStatus("Using available tokens...");

      const fallbackTokens = (userTokens || []).map((ut) => ({
        address: ut.mint,
        symbol: ut.symbol,
        decimals: ut.decimals,
        name: ut.name,
      }));

      if (fallbackTokens.length === 0) {
        const defaultTokens = [
          { address: SOL_MINT, symbol: "SOL", decimals: 9, name: "Solana" },
          {
            address: FIXER_MINT,
            symbol: "FIXERCOIN",
            decimals: 6,
            name: "FIXERCOIN",
          },
        ];
        setTokenList(defaultTokens);
      } else {
        setTokenList(fallbackTokens);
      }

      setInitialized(true);
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
      const outHuman = Number(outAmount) / Math.pow(10, toMeta.decimals ?? 6);

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

  const confirmSwap = async () => {
    try {
      setStatus("Preparing swap…");
      setIsLoading(true);
      setShowConfirmation(false);

      if (!wallet) {
        setStatus("No wallet detected.");
        setIsLoading(false);
        return null;
      }

      if (!wallet.secretKey) {
        setStatus("No private key found in wallet.");
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

      if (!fromMeta || !toMeta) {
        setStatus("Token metadata not found");
        setIsLoading(false);
        return null;
      }

      const decimalsIn = fromMeta.decimals ?? 6;
      const amountRaw = humanToRaw(amount || "0", decimalsIn);

      setStatus("Computing swap routes…");
      const routes = await jup.computeRoutes({
        inputMint: fromMint,
        outputMint: toMint,
        amount: amountRaw.toString(),
        slippage: 50,
      });

      if (!routes || !routes.routesInfos || routes.routesInfos.length === 0) {
        throw new Error("No swap route found for this pair and amount");
      }

      const routeInfo = routes.routesInfos[0];
      setStatus("Preparing transaction…");
      const { execute } = await jup.exchange({ routeInfo });

      setStatus("Signing and sending transaction…");
      console.log("[SwapInterface] Executing swap with route:", routeInfo);

      const swapResult = await execute();

      if (!swapResult) {
        throw new Error("Swap execution returned no result");
      }

      setStatus(
        `Swap submitted. Signature: ${swapResult.txSig || swapResult.signature || "pending"}`,
      );
      console.log("[SwapInterface] Swap result:", swapResult);

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
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[SwapInterface] Swap error:", err);
      setStatus("Swap error: " + errorMsg);
      setIsLoading(false);

      toast({
        title: "Swap Failed",
        description: errorMsg || "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const executeSwap = () => {
    setShowConfirmation(true);
  };

  if (!wallet) {
    return (
      <div className="w-full max-w-md mx-auto px-4">
        <div className="rounded-2xl border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] overflow-hidden">
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-lg font-semibold text-gray-900 uppercase">
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
              className="w-full border border-gray-700 text-gray-900 hover:bg-gray-50 uppercase"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 relative z-0 pt-8">
      <div className="rounded-2xl border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0]">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 rounded-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
          </div>
        )}

        <div className="space-y-6 p-6 relative">
          <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold text-sm text-gray-900 uppercase">
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
                <SelectTrigger className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-lg focus:outline-none focus:border-[#a7f3d0] focus:ring-0 transition-colors">
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
                <SelectContent className="bg-gray-800 border border-gray-700 z-50">
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
                className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
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
              <SelectTrigger className="w-full bg-transparent border border-gray-700 text-gray-900 rounded-lg focus:outline-none focus:border-[#a7f3d0] focus:ring-0 transition-colors">
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
              <SelectContent className="bg-gray-800 border border-gray-700 z-50">
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
            <div className="p-4 bg-[#f0fff4]/60 border border-[#a7f3d0]/30 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Estimated receive:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {quote.outHuman.toFixed(6)} {quote.outToken}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Route hops:</span>
                  <span className="text-xs text-gray-600">{quote.hops}</span>
                </div>
              </div>
            </div>
          )}

          {status && (
            <div className="text-sm text-gray-700 font-medium bg-[#f0fff4]/60 border-l-4 border-[#a7f3d0] p-3 rounded">
              {status}
            </div>
          )}

          <Button
            onClick={getQuote}
            disabled={!amount || isLoading}
            className="w-full bg-gradient-to-r from-[#5a9f6f] to-[#3d7a52] hover:from-[#4a8f5f] hover:to-[#2d6a42] text-white shadow-lg uppercase font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Get Quote"
            )}
          </Button>

          <Button
            onClick={executeSwap}
            disabled={!amount || !quote || isLoading}
            className="w-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#1ea853] hover:to-[#15803d] text-white shadow-lg uppercase font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Convert (Swap)"
            )}
          </Button>
        </div>

        <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <AlertDialogContent className="bg-gray-900 border border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                Confirm Swap
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-300">
                You are about to swap {amount} {fromToken?.symbol} for
                approximately {quote?.outHuman.toFixed(6)} {quote?.outToken}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmSwap}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Confirm Swap
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
