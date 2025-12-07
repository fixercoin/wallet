import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fixercoinPriceService } from "@/lib/services/fixercoin-price";
import { solPriceService } from "@/lib/services/sol-price";
import { MarketMakerHistoryCard } from "./MarketMakerHistoryCard";
import { PriceLoader } from "@/components/ui/price-loader";
import {
  botOrdersStorage,
  BotSession,
  BotOrder,
} from "@/lib/bot-orders-storage";
import {
  executeLimitOrder,
  checkAndExecutePendingOrders,
} from "@/lib/market-maker-executor";

interface MarketMakerProps {
  onBack: () => void;
}

const TOKEN_CONFIGS: Record<
  string,
  { name: string; mint: string; decimals: number }
> = {
  FIXERCOIN: {
    name: "FIXERCOIN",
    mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    decimals: 6,
  },
  USDC: {
    name: "USDC",
    mint: "EPjFWaLb3odccVLd7wfL9K3JWuWKq6PPczQkfCW2eKi",
    decimals: 6,
  },
  SOL: {
    name: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
};

interface LimitOrder {
  price: string;
  amount: string;
  total: string;
}

export const MarketMaker: React.FC<MarketMakerProps> = ({ onBack }) => {
  const { tokens, wallet } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedToken, setSelectedToken] = useState("FIXERCOIN");
  const [orderMode, setOrderMode] = useState<"BUY" | "SELL">("BUY");
  const [buyOrder, setBuyOrder] = useState<LimitOrder>({
    price: "",
    amount: "",
    total: "0.01",
  });
  const [sellOrder, setSellOrder] = useState<LimitOrder>({
    price: "",
    amount: "",
    total: "0.02",
  });
  const [sellOutputToken, setSellOutputToken] = useState<"SOL" | "USDC">("SOL");
  const [isLoading, setIsLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [session, setSession] = useState<BotSession | null>(null);
  const [executingOrders, setExecutingOrders] = useState<Set<string>>(
    new Set(),
  );

  const tokenConfig = TOKEN_CONFIGS[selectedToken];

  // Initialize or load session on component mount
  useEffect(() => {
    let currentSession = botOrdersStorage.getCurrentSession();
    if (!currentSession) {
      // Create a new session if one doesn't exist
      currentSession = botOrdersStorage.createSession(
        "FIXERCOIN",
        tokenConfig.mint,
        1,
        0.01,
        0.00002,
      );
      botOrdersStorage.saveSession(currentSession);
    }
    setSession(currentSession);
  }, []);

  // Fetch live price on component mount or token change, and set up polling
  useEffect(() => {
    const fetchPrices = async () => {
      setIsFetchingPrice(true);
      try {
        let tokenPrice: number | null = null;
        let solPriceUsd: number | null = null;

        if (selectedToken === "FIXERCOIN") {
          const priceData = await fixercoinPriceService.getFixercoinPrice();
          if (priceData && priceData.price > 0) {
            tokenPrice = priceData.price;
          }
        }

        // Always fetch SOL price for calculation
        try {
          const solPriceData = await solPriceService.getSolPrice();
          if (solPriceData && solPriceData.price > 0) {
            solPriceUsd = solPriceData.price;
          }
        } catch (error) {
          console.error("[MarketMaker] Error fetching SOL price:", error);
        }

        if (tokenPrice && tokenPrice > 0) {
          setLivePrice(tokenPrice);
          console.log(
            `[MarketMaker] Fetched live price for ${selectedToken}: ${tokenPrice}`,
          );
        }

        if (solPriceUsd && solPriceUsd > 0) {
          setSolPrice(solPriceUsd);
          console.log(`[MarketMaker] Fetched SOL price: ${solPriceUsd}`);
        }
      } catch (error) {
        console.error("[MarketMaker] Error fetching prices:", error);
      } finally {
        setIsFetchingPrice(false);
      }
    };

    fetchPrices();

    // Set up polling to refresh prices every 20 seconds for live price updates
    const priceRefreshInterval = setInterval(() => {
      fetchPrices();
    }, 20000);

    return () => {
      clearInterval(priceRefreshInterval);
    };
  }, [selectedToken]);

  // Auto-execution effect: check and execute pending orders when price matches
  useEffect(() => {
    if (!session || !livePrice || !wallet) {
      if (!wallet) {
        console.warn("[MarketMaker] Wallet not available for auto-execution");
      }
      return;
    }

    if (!wallet.secretKey) {
      console.warn(
        "[MarketMaker] Wallet does not have private key available. Auto-execution will not proceed. Please use a wallet with private key access.",
      );
      return;
    }

    console.log("[MarketMaker] Auto-execution enabled. Wallet:", {
      publicKey: wallet.publicKey,
      hasSecretKey: !!wallet.secretKey,
    });

    const checkAndExecute = async () => {
      try {
        const currentSession = botOrdersStorage.getCurrentSession();
        if (!currentSession) return;

        const pendingBuyOrders = currentSession.buyOrders.filter(
          (o) => o.status === "pending",
        );
        const pendingSellOrders = currentSession.sellOrders.filter(
          (o) => o.status === "pending",
        );

        if (pendingBuyOrders.length === 0 && pendingSellOrders.length === 0) {
          return;
        }

        console.log(
          `[MarketMaker] Checking ${pendingBuyOrders.length + pendingSellOrders.length} pending orders at price ${livePrice}`,
        );

        // Check buy orders
        for (const order of pendingBuyOrders) {
          console.log(
            `[MarketMaker] Checking BUY order: livePrice=${livePrice}, buyPrice=${order.buyPrice}, match=${livePrice <= order.buyPrice}`,
          );

          if (livePrice <= order.buyPrice && !executingOrders.has(order.id)) {
            console.log(
              `[MarketMaker] Price match for BUY order: ${livePrice} <= ${order.buyPrice}. Executing...`,
            );
            setExecutingOrders((prev) => new Set([...prev, order.id]));

            const result = await executeLimitOrder(
              currentSession,
              order,
              livePrice,
              wallet,
            );

            setExecutingOrders((prev) => {
              const next = new Set(prev);
              next.delete(order.id);
              return next;
            });

            if (result.success) {
              toast({
                title: "Buy Order Executed",
                description: `Successfully bought ${result.order?.tokenAmount?.toFixed(6) || "tokens"}`,
              });
              // Reload session
              const updatedSession = botOrdersStorage.getCurrentSession();
              if (updatedSession) {
                setSession(updatedSession);
              }
            } else {
              console.error(
                "[MarketMaker] Buy order execution failed:",
                result.error,
              );
              // Show error toast for wallet-related errors
              if (
                result.error &&
                (result.error.includes("secretKey") ||
                  result.error.includes("private key"))
              ) {
                toast({
                  title: "Execution Failed",
                  description: result.error,
                  variant: "destructive",
                });
              }
            }
          }
        }

        // Check sell orders
        for (const order of pendingSellOrders) {
          console.log(
            `[MarketMaker] Checking SELL order: livePrice=${livePrice}, targetSellPrice=${order.targetSellPrice}, match=${livePrice >= order.targetSellPrice}`,
          );

          if (
            livePrice >= order.targetSellPrice &&
            !executingOrders.has(order.id)
          ) {
            console.log(
              `[MarketMaker] Price match for SELL order: ${livePrice} >= ${order.targetSellPrice}. Executing...`,
            );
            setExecutingOrders((prev) => new Set([...prev, order.id]));

            const result = await executeLimitOrder(
              currentSession,
              order,
              livePrice,
              wallet,
            );

            setExecutingOrders((prev) => {
              const next = new Set(prev);
              next.delete(order.id);
              return next;
            });

            if (result.success) {
              const outputToken = result.order?.outputToken || "SOL";
              const outputAmount =
                result.order?.outputToken === "USDC"
                  ? result.order?.outputAmount?.toFixed(6)
                  : result.order?.outputAmount?.toFixed(9);
              toast({
                title: "Sell Order Executed",
                description: `Successfully sold ${result.order?.tokenAmount?.toFixed(6) || "tokens"} for ${outputAmount || "0"} ${outputToken}`,
              });
              // Reload session
              const updatedSession = botOrdersStorage.getCurrentSession();
              if (updatedSession) {
                setSession(updatedSession);
              }
            } else {
              console.error(
                "[MarketMaker] Sell order execution failed:",
                result.error,
              );
              // Show error toast for wallet-related errors
              if (
                result.error &&
                (result.error.includes("secretKey") ||
                  result.error.includes("private key"))
              ) {
                toast({
                  title: "Execution Failed",
                  description: result.error,
                  variant: "destructive",
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("[MarketMaker] Error in auto-execution check:", error);
      }
    };

    // Check for order execution every 10 seconds
    const executionInterval = setInterval(checkAndExecute, 10000);

    // Also check immediately on price change
    checkAndExecute();

    return () => {
      clearInterval(executionInterval);
    };
  }, [session, livePrice, wallet, toast]);

  const solToken = useMemo(
    () => tokens.find((t) => t.symbol === "SOL"),
    [tokens],
  );

  const usdcToken = useMemo(
    () => tokens.find((t) => t.symbol === "USDC"),
    [tokens],
  );

  const selectedTokenBalance = useMemo(
    () => tokens.find((t) => t.symbol === selectedToken),
    [tokens, selectedToken],
  );

  const solBalance = solToken?.balance || 0;
  const usdcBalance = usdcToken?.balance || 0;
  const tokenBalance = selectedTokenBalance?.balance || 0;

  const calculateAmountFromTotal = useCallback(
    (totalSol: string, price: string) => {
      const total = parseFloat(totalSol) || 0;
      const p = parseFloat(price) || 0;
      if (p <= 0) return "0";
      return (total / p).toFixed(8);
    },
    [],
  );

  const calculateTotalFromAmountPrice = useCallback(
    (price: string, amount: string) => {
      const p = parseFloat(price) || 0;
      const a = parseFloat(amount) || 0;
      return (p * a).toFixed(8);
    },
    [],
  );

  const handleBuyTargetPriceChange = (value: string) => {
    setBuyOrder({
      ...buyOrder,
      price: value,
    });
  };

  const handleBuyUsdcAmountChange = (value: string) => {
    let estimatedAmount = "0";

    if (livePrice && livePrice > 0 && solPrice && solPrice > 0) {
      // Calculate: SOL Amount * SOL Price in USD / Token Price in USD
      const solAmount = parseFloat(value) || 0;
      const solValueUsd = solAmount * solPrice;
      const tokenAmount = solValueUsd / livePrice;
      estimatedAmount = tokenAmount.toFixed(8);
    }

    setBuyOrder({
      ...buyOrder,
      total: value,
      amount: estimatedAmount,
    });
  };

  const handleSellPriceChange = (value: string) => {
    setSellOrder({
      ...sellOrder,
      price: value,
    });
  };

  const handleSellAmountChange = (value: string) => {
    let estimatedTotal = "0";

    if (livePrice && livePrice > 0 && solPrice && solPrice > 0) {
      // Calculate: Token Amount * Token Price in USD / SOL Price in USD
      const tokenAmount = parseFloat(value) || 0;
      const tokenValueUsd = tokenAmount * livePrice;
      const solAmount = tokenValueUsd / solPrice;
      estimatedTotal = solAmount.toFixed(8);
    }

    setSellOrder({
      ...sellOrder,
      amount: value,
      total: estimatedTotal,
    });
  };

  // Recalculate estimated amounts when prices update
  useEffect(() => {
    if (orderMode === "BUY" && buyOrder.total && livePrice && solPrice) {
      const solAmount = parseFloat(buyOrder.total) || 0;
      const solValueUsd = solAmount * solPrice;
      const tokenAmount = solValueUsd / livePrice;
      setBuyOrder((prev) => ({
        ...prev,
        amount: tokenAmount.toFixed(8),
      }));
    } else if (
      orderMode === "SELL" &&
      sellOrder.amount &&
      livePrice &&
      solPrice
    ) {
      const tokenAmount = parseFloat(sellOrder.amount) || 0;
      const tokenValueUsd = tokenAmount * livePrice;
      const solAmount = tokenValueUsd / solPrice;
      setSellOrder((prev) => ({
        ...prev,
        total: solAmount.toFixed(8),
      }));
    }
  }, [livePrice, solPrice, orderMode]);

  const validateBuyOrder = (): string | null => {
    const price = parseFloat(buyOrder.price);
    const amount = parseFloat(buyOrder.amount);
    const total = parseFloat(buyOrder.total);

    if (isNaN(price) || price <= 0) return "Buy price must be greater than 0";
    if (isNaN(amount) || amount <= 0)
      return "Buy amount must be greater than 0";
    if (isNaN(total) || total <= 0) return "Buy total is invalid";
    if (solBalance < total)
      return `Insufficient SOL. Need ${total.toFixed(8)}, have ${solBalance.toFixed(8)}`;

    return null;
  };

  const validateSellOrder = (): string | null => {
    const price = parseFloat(sellOrder.price);
    const amount = parseFloat(sellOrder.amount);

    if (isNaN(price) || price <= 0) return "Sell price must be greater than 0";
    if (isNaN(amount) || amount <= 0)
      return "Sell amount must be greater than 0";
    if (tokenBalance < amount)
      return `Insufficient ${selectedToken}. Need ${amount}, have ${tokenBalance.toFixed(8)}`;

    return null;
  };

  const handlePlaceOrder = async () => {
    if (!session) {
      toast({
        title: "Error",
        description: "No active session. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (orderMode === "BUY") {
      const validationError = validateBuyOrder();
      if (validationError) {
        toast({
          title: "Validation Error",
          description: validationError,
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);

      try {
        const buyPrice = parseFloat(buyOrder.price);
        const solAmount = parseFloat(buyOrder.total);

        const newOrder = botOrdersStorage.addBuyOrder(
          session.id,
          buyPrice,
          solAmount,
        );

        if (!newOrder) {
          throw new Error("Failed to create buy order");
        }

        // Update session
        const updatedSession = botOrdersStorage.getCurrentSession();
        if (updatedSession) {
          setSession(updatedSession);
        }

        console.log("[MarketMaker] Buy order created:", newOrder);

        toast({
          title: "Buy Order Created",
          description: `Waiting for price to drop to ${buyPrice.toFixed(8)}. Current: ${livePrice?.toFixed(8)}`,
        });

        setBuyOrder({
          price: "",
          amount: "",
          total: "0.01",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      const validationError = validateSellOrder();
      if (validationError) {
        toast({
          title: "Validation Error",
          description: validationError,
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);

      try {
        const sellPrice = parseFloat(sellOrder.price);
        const tokenAmount = parseFloat(sellOrder.amount);

        const newOrder = botOrdersStorage.addSellOrder(
          session.id,
          "", // buyOrderId - we'll use empty since this is a direct limit sell
          sellPrice,
          tokenAmount,
          undefined,
          sellOutputToken,
        );

        if (!newOrder) {
          throw new Error("Failed to create sell order");
        }

        // Update session
        const updatedSession = botOrdersStorage.getCurrentSession();
        if (updatedSession) {
          setSession(updatedSession);
        }

        console.log("[MarketMaker] Sell order created:", newOrder);

        toast({
          title: "Sell Order Created",
          description: `Waiting for price to rise to ${sellPrice.toFixed(8)}. Current: ${livePrice?.toFixed(8)}`,
        });

        setSellOrder({
          price: "",
          amount: "",
          total: "0.02",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        toast({
          title: "Error",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const currentOrder = orderMode === "BUY" ? buyOrder : sellOrder;
  const canAffordCurrent =
    orderMode === "BUY"
      ? parseFloat(currentOrder.total) <= usdcBalance
      : parseFloat(currentOrder.amount) <= tokenBalance;

  return (
    <div className="w-full md:max-w-lg mx-auto px-0 md:px-4 relative z-0 pt-8">
      {wallet && !wallet.secretKey && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-900 font-medium">
            ⚠️ Auto-execution requires a wallet with private key access. Your
            current wallet appears to be view-only. Please connect a wallet with
            private keys to enable auto-execution.
          </p>
        </div>
      )}
      <div className="rounded-none border-0 bg-transparent w-full">
        <div className="space-y-6 p-4 md:p-6 relative w-full">
          <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2 justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-[2px] bg-transparent hover:bg-green-100 text-green-600 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-sm text-white uppercase">
                ADVANCE TRADE
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              TOKEN
            </Label>
            <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-semibold">
              FIXERCOIN
            </div>
          </div>

          <div className="bg-transparent border border-gray-700 rounded-lg p-3 md:p-4 w-full">
            <div className="flex gap-2 mb-6 w-full">
              <Button
                onClick={() => setOrderMode("BUY")}
                className={`flex-1 font-bold uppercase py-2 rounded-lg transition-colors ${
                  orderMode === "BUY"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-transparent border border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                BUY
              </Button>
              <Button
                onClick={() => setOrderMode("SELL")}
                className={`flex-1 font-bold uppercase py-2 rounded-lg transition-colors ${
                  orderMode === "SELL"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-transparent border border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                SELL
              </Button>
            </div>

            <div className="space-y-3">
              {orderMode === "BUY" ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-600 text-xs font-semibold">
                        TARGET LIMIT (FIXERCOIN)
                      </Label>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        {livePrice ? (
                          <>
                            LIVE:{" "}
                            <span className="text-green-400 font-semibold">
                              {livePrice.toFixed(8)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <Input
                      type="number"
                      step="0.00000001"
                      value={buyOrder.price}
                      onChange={(e) =>
                        handleBuyTargetPriceChange(e.target.value)
                      }
                      className={`bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none transition-colors placeholder:text-gray-400 caret-gray-900 focus:border-green-400`}
                      placeholder="ENTER TARGET PRICE"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-semibold">
                      SOL AMOUNT
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={buyOrder.total}
                      onChange={(e) =>
                        handleBuyUsdcAmountChange(e.target.value)
                      }
                      className={`bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none transition-colors placeholder:text-gray-400 caret-gray-900 focus:border-green-400`}
                      placeholder="ENTER SOL AMOUNT"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-600 text-xs font-semibold">
                        ESTIMATED FIXERCOIN
                      </Label>
                    </div>
                    <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-medium">
                      {buyOrder.amount || "0"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-semibold">
                      AVAILABLE SOL
                    </Label>
                    <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-medium">
                      <span
                        className={
                          canAffordCurrent ? "text-green-400" : "text-red-400"
                        }
                      >
                        {solBalance.toFixed(8)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-600 text-xs font-semibold">
                        TARGET LIMIT (FIXERCOIN)
                      </Label>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        {isFetchingPrice ? (
                          <>
                            <Loader className="w-3 h-3 animate-spin" />
                            FETCHING...
                          </>
                        ) : livePrice ? (
                          <>
                            LIVE:{" "}
                            <span className="text-green-400 font-semibold">
                              {livePrice.toFixed(8)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <Input
                      type="number"
                      step="0.00000001"
                      value={sellOrder.price}
                      onChange={(e) => handleSellPriceChange(e.target.value)}
                      className={`bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none transition-colors placeholder:text-gray-400 caret-gray-900 focus:border-green-400`}
                      placeholder="ENTER TARGET PRICE"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-semibold">
                      FIXERCOIN AMOUNT
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={sellOrder.amount}
                      onChange={(e) => handleSellAmountChange(e.target.value)}
                      className={`bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none transition-colors placeholder:text-gray-400 caret-gray-900 focus:border-green-400`}
                      placeholder="ENTER FIXERCOIN AMOUNT"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-600 text-xs font-semibold">
                        ESTIMATED SOL
                      </Label>
                    </div>
                    <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-medium">
                      {sellOrder.total || "0"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-semibold">
                      AVAILABLE FIXERCOIN
                    </Label>
                    <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-medium">
                      <span
                        className={
                          canAffordCurrent ? "text-green-400" : "text-red-400"
                        }
                      >
                        {tokenBalance.toFixed(8)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-semibold">
                      RECEIVE IN
                    </Label>
                    <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-semibold">
                      SOL
                    </div>
                  </div>
                </>
              )}

              <Button
                onClick={handlePlaceOrder}
                disabled={
                  isLoading ||
                  !canAffordCurrent ||
                  !currentOrder.price ||
                  !currentOrder.amount
                }
                className={`w-full font-bold uppercase py-3 rounded-lg transition-colors text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400`}
              >
                {isLoading
                  ? "PLACING..."
                  : `PLACE ${orderMode === "BUY" ? "BUY" : "SELL"} ORDER`}
              </Button>
            </div>
          </div>

          <div className="mt-8">
            <MarketMakerHistoryCard selectedToken={selectedToken} />
          </div>
        </div>
      </div>
    </div>
  );
};
