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
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { solPriceService } from "@/lib/services/sol-price";
import { MarketMakerHistoryCard } from "./MarketMakerHistoryCard";

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
  const { tokens } = useWallet();
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
  const [isLoading, setIsLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  const tokenConfig = TOKEN_CONFIGS[selectedToken];

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
        } else if (selectedToken === "SOL") {
          const solToken = await dexscreenerAPI.getTokenByMint(
            "So11111111111111111111111111111111111111112",
          );
          if (solToken && solToken.priceUsd) {
            tokenPrice = parseFloat(solToken.priceUsd);
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

    // Set up polling to refresh prices every 30 seconds
    const priceRefreshInterval = setInterval(() => {
      fetchPrices();
    }, 30000);

    return () => {
      clearInterval(priceRefreshInterval);
    };
  }, [selectedToken]);

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

  const handleBuySolAmountChange = (value: string) => {
    let estimatedAmount = "0";

    if (livePrice && livePrice > 0 && solPrice && solPrice > 0) {
      // Calculate: (SOL Amount * SOL Price in USD) / Token Price in USD
      const solAmount = parseFloat(value) || 0;
      const tokenAmount = (solAmount * solPrice) / livePrice;
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
      // Calculate: (Token Amount * Token Price in USD) / SOL Price in USD
      const tokenAmount = parseFloat(value) || 0;
      const solAmount = (tokenAmount * livePrice) / solPrice;
      estimatedTotal = solAmount.toFixed(8);
    }

    setSellOrder({
      ...sellOrder,
      amount: value,
      total: estimatedTotal,
    });
  };

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
        const orderData = {
          type: "BUY",
          token: selectedToken,
          tokenMint: tokenConfig.mint,
          price: parseFloat(buyOrder.price),
          amount: parseFloat(buyOrder.amount),
          totalSol: parseFloat(buyOrder.total),
        };

        console.log("[MarketMaker] Placing buy limit order:", orderData);

        toast({
          title: "Buy Order Placed",
          description: `Limit buy order placed: ${buyOrder.amount} ${selectedToken} at ${buyOrder.price}`,
        });

        setBuyOrder({
          price: "0.00001",
          amount: "1000",
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
        const orderData = {
          type: "SELL",
          token: selectedToken,
          tokenMint: tokenConfig.mint,
          price: parseFloat(sellOrder.price),
          amount: parseFloat(sellOrder.amount),
          totalSol: parseFloat(sellOrder.total),
        };

        console.log("[MarketMaker] Placing sell limit order:", orderData);

        toast({
          title: "Sell Order Placed",
          description: `Limit sell order placed: ${sellOrder.amount} ${selectedToken} at ${sellOrder.price}`,
        });

        setSellOrder({
          price: "0.00002",
          amount: "1000",
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
      ? parseFloat(currentOrder.total) <= solBalance
      : parseFloat(currentOrder.amount) <= tokenBalance;

  return (
    <div className="w-full md:max-w-lg mx-auto px-4 relative z-0 pt-8">
      <div className="rounded-none border-0 bg-transparent">
        <div className="space-y-6 p-6 relative">
          <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2 justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-8 w-8 p-0 rounded-[2px] bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
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
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TOKEN_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-transparent border border-gray-700 rounded-lg p-4">
            <div className="flex gap-2 mb-6">
              <Button
                onClick={() => setOrderMode("BUY")}
                className={`flex-1 font-bold uppercase py-2 rounded-lg transition-colors ${
                  orderMode === "BUY"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-transparent border border-gray-700 text-gray-400 hover:text-white"
                }`}
              >
                BUY
              </Button>
              <Button
                onClick={() => setOrderMode("SELL")}
                className={`flex-1 font-bold uppercase py-2 rounded-lg transition-colors ${
                  orderMode === "SELL"
                    ? "bg-red-600 hover:bg-red-700 text-white"
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
                        TARGET LIMIT ({selectedToken})
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
                            <span className="text-blue-400 font-semibold">
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
                      className={`bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none transition-colors placeholder:text-gray-400 caret-gray-900 focus:border-blue-400`}
                      placeholder="ENTER TARGET PRICE"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-semibold">
                      SOL AMOUNT
                    </Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={buyOrder.total}
                      onChange={(e) => handleBuySolAmountChange(e.target.value)}
                      className={`bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none transition-colors placeholder:text-gray-400 caret-gray-900 focus:border-blue-400`}
                      placeholder="ENTER SOL AMOUNT"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-600 text-xs font-semibold">
                        ESTIMATED {selectedToken}
                      </Label>
                    </div>
                    <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-medium">
                      {buyOrder.amount || "0"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-semibold">
                      AVAILABLE {selectedToken === "SOL" ? "USDC" : "SOL"}
                    </Label>
                    <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-medium">
                      <span
                        className={
                          canAffordCurrent ? "text-green-400" : "text-red-400"
                        }
                      >
                        {(selectedToken === "SOL"
                          ? usdcBalance
                          : solBalance
                        ).toFixed(8)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-600 text-xs font-semibold">
                        TARGET LIMIT ({selectedToken})
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
                            <span className="text-red-400 font-semibold">
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
                      className={`bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none transition-colors placeholder:text-gray-400 caret-gray-900 focus:border-red-400`}
                      placeholder="ENTER TARGET PRICE"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600 text-xs font-semibold">
                      {selectedToken} AMOUNT
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={sellOrder.amount}
                      onChange={(e) => handleSellAmountChange(e.target.value)}
                      className={`bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none transition-colors placeholder:text-gray-400 caret-gray-900 focus:border-red-400`}
                      placeholder="ENTER AMOUNT TO SELL"
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
                      AVAILABLE{" "}
                      {selectedToken === "SOL" ? "USDC" : selectedToken}
                    </Label>
                    <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-white font-medium">
                      <span
                        className={
                          canAffordCurrent ? "text-green-400" : "text-red-400"
                        }
                      >
                        {(selectedToken === "SOL"
                          ? usdcBalance
                          : tokenBalance
                        ).toFixed(8)}
                      </span>
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
                className={`w-full font-bold uppercase py-3 rounded-lg transition-colors text-white ${
                  orderMode === "BUY"
                    ? "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
                    : "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                }`}
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
