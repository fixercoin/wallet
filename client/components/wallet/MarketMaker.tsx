import React, { useState, useCallback, useMemo } from "react";
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
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
    price: "0.00001",
    amount: "1000",
    total: "0.01",
  });
  const [sellOrder, setSellOrder] = useState<LimitOrder>({
    price: "0.00002",
    amount: "1000",
    total: "0.02",
  });
  const [isLoading, setIsLoading] = useState(false);

  const tokenConfig = TOKEN_CONFIGS[selectedToken];

  const solToken = useMemo(
    () => tokens.find((t) => t.symbol === "SOL"),
    [tokens],
  );

  const selectedTokenBalance = useMemo(
    () => tokens.find((t) => t.symbol === selectedToken),
    [tokens, selectedToken],
  );

  const solBalance = solToken?.balance || 0;
  const tokenBalance = selectedTokenBalance?.balance || 0;

  const calculateBuyTotal = useCallback((price: string, amount: string) => {
    const p = parseFloat(price) || 0;
    const a = parseFloat(amount) || 0;
    return (p * a).toFixed(8);
  }, []);

  const calculateSellTotal = useCallback((price: string, amount: string) => {
    const p = parseFloat(price) || 0;
    const a = parseFloat(amount) || 0;
    return (p * a).toFixed(8);
  }, []);

  const handleBuyPriceChange = (value: string) => {
    setBuyOrder({
      ...buyOrder,
      price: value,
      total: calculateBuyTotal(value, buyOrder.amount),
    });
  };

  const handleBuyAmountChange = (value: string) => {
    setBuyOrder({
      ...buyOrder,
      amount: value,
      total: calculateBuyTotal(buyOrder.price, value),
    });
  };

  const handleSellPriceChange = (value: string) => {
    setSellOrder({
      ...sellOrder,
      price: value,
      total: calculateSellTotal(value, sellOrder.amount),
    });
  };

  const handleSellAmountChange = (value: string) => {
    setSellOrder({
      ...sellOrder,
      amount: value,
      total: calculateSellTotal(sellOrder.price, value),
    });
  };

  const validateBuyOrder = (): string | null => {
    const price = parseFloat(buyOrder.price);
    const amount = parseFloat(buyOrder.amount);
    const total = parseFloat(buyOrder.total);

    if (isNaN(price) || price <= 0) return "Buy price must be greater than 0";
    if (isNaN(amount) || amount <= 0) return "Buy amount must be greater than 0";
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

  const handlePlaceBuyOrder = async () => {
    const validationError = validateBuyOrder();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsBuyLoading(true);

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
      setIsBuyLoading(false);
    }
  };

  const handlePlaceSellOrder = async () => {
    const validationError = validateSellOrder();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSellLoading(true);

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
      setIsSellLoading(false);
    }
  };

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
                Fixorium Limit Orders
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Token
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

          <div className="space-y-4">
            <div className="bg-transparent border border-blue-500/50 rounded-lg p-4">
              <h3 className="text-blue-400 font-semibold text-sm uppercase mb-4">
                Buy Limit Order
              </h3>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-gray-600 text-xs font-semibold">
                    Price ({selectedToken} per SOL)
                  </Label>
                  <Input
                    type="number"
                    step="0.00000001"
                    value={buyOrder.price}
                    onChange={(e) => handleBuyPriceChange(e.target.value)}
                    className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400 caret-gray-900"
                    placeholder="Enter price"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-600 text-xs font-semibold">
                    Amount ({selectedToken})
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={buyOrder.amount}
                    onChange={(e) => handleBuyAmountChange(e.target.value)}
                    className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400 caret-gray-900"
                    placeholder="Enter amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-600 text-xs font-semibold">
                    Total (SOL)
                  </Label>
                  <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-gray-900 font-medium">
                    {buyOrder.total}
                  </div>
                </div>

                <div className="p-3 bg-transparent border border-gray-700 rounded-lg">
                  <div className="text-gray-300 text-xs font-semibold">
                    Available SOL:{" "}
                    <span
                      className={
                        parseFloat(buyOrder.total) <= solBalance
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {solBalance.toFixed(8)}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handlePlaceBuyOrder}
                  disabled={isBuyLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase py-3 rounded-lg"
                >
                  {isBuyLoading ? "Placing..." : "Place Buy Order"}
                </Button>
              </div>
            </div>

            <div className="bg-transparent border border-red-500/50 rounded-lg p-4">
              <h3 className="text-red-400 font-semibold text-sm uppercase mb-4">
                Sell Limit Order
              </h3>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-gray-600 text-xs font-semibold">
                    Price ({selectedToken} per SOL)
                  </Label>
                  <Input
                    type="number"
                    step="0.00000001"
                    value={sellOrder.price}
                    onChange={(e) => handleSellPriceChange(e.target.value)}
                    className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-red-400 transition-colors placeholder:text-gray-400 caret-gray-900"
                    placeholder="Enter price"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-600 text-xs font-semibold">
                    Amount ({selectedToken})
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={sellOrder.amount}
                    onChange={(e) => handleSellAmountChange(e.target.value)}
                    className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-red-400 transition-colors placeholder:text-gray-400 caret-gray-900"
                    placeholder="Enter amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-600 text-xs font-semibold">
                    Total (SOL)
                  </Label>
                  <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-gray-900 font-medium">
                    {sellOrder.total}
                  </div>
                </div>

                <div className="p-3 bg-transparent border border-gray-700 rounded-lg">
                  <div className="text-gray-300 text-xs font-semibold">
                    Available {selectedToken}:{" "}
                    <span
                      className={
                        parseFloat(sellOrder.amount) <= tokenBalance
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {tokenBalance.toFixed(8)}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handlePlaceSellOrder}
                  disabled={isSellLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold uppercase py-3 rounded-lg"
                >
                  {isSellLoading ? "Placing..." : "Place Sell Order"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
