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
  const [isBuyLoading, setIsBuyLoading] = useState(false);
  const [isSellLoading, setIsSellLoading] = useState(false);

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
                Fixorium Market Maker
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/market-maker/history")}
              className="text-xs h-7 px-2 border-gray-700 text-gray-300 hover:text-white rounded-md"
            >
              History
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Token Address
            </Label>
            <Select
              value={selectedToken}
              onValueChange={(value) => setSelectedToken(value as TokenType)}
            >
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

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Number of Makers
            </Label>
            <Input
              type="number"
              min="1"
              max="1000"
              value={numberOfMakers}
              onChange={(e) => setNumberOfMakers(e.target.value)}
              className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Order Amount (SOL)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.001"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
                placeholder="Enter order amount"
              />
              <span className="text-sm text-gray-600">◎</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Price Spread
            </Label>
            <div className="bg-transparent border border-green-500/50 rounded-lg px-4 py-3 flex items-center justify-center">
              <span className="text-sm font-semibold text-green-400">
                {selectedToken === "FIXERCOIN"
                  ? `+${tokenConfig.spread.toFixed(8)}`
                  : `+${tokenConfig.spread}`}{" "}
                {selectedToken}
              </span>
            </div>
          </div>

          <div className="p-4 bg-transparent border border-gray-700 rounded-lg">
            <div
              className="text-gray-300"
              style={{
                fontSize: "10px",
                fontWeight: "600",
                letterSpacing: "0.5px",
              }}
            >
              AVAILABLE SOL :{" "}
              <span className={canAfford ? "text-green-400" : "text-red-400"}>
                {solBalance.toFixed(4)}
              </span>{" "}
              | REQUIRED :{" "}
              <span className="text-white">{totalNeeded.toFixed(4)}</span> |
              NEED :{" "}
              <span className="text-red-400">{solNeeded.toFixed(4)}</span>
            </div>
          </div>

          <Button
            onClick={handleRunBot}
            disabled={isLoading || !canAfford}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold uppercase py-3 rounded-lg"
          >
            {isLoading ? "Starting..." : "Run Bot"}
          </Button>
        </div>
      </div>
    </div>
  );
};
