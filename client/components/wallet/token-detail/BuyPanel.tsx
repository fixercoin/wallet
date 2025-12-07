import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";
import { PriceLoader } from "@/components/ui/price-loader";
import { useState } from "react";

interface BuyPanelProps {
  token: TokenInfo;
  onBuy: () => void;
  quote: null;
  isLoading: boolean;
  withinCard?: boolean;
}

export const BuyPanel: React.FC<BuyPanelProps> = ({
  token,
  onBuy,
  isLoading,
  withinCard = false,
}) => {
  const [buyAmount, setBuyAmount] = useState("0.1");

  const content = (
    <>
      <div className="pb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-green-400" />
          Buy {token.symbol}
        </h3>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Amount to spend (SOL)
          </label>
          <Input
            type="number"
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            placeholder="0.1"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-2">Estimated to receive</div>
          <div className="text-lg font-semibold text-white">
            ~
            {(
              (parseFloat(buyAmount) * 100) /
              (token.price || 1)
            ).toLocaleString()}{" "}
            {token.symbol}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Price per {token.symbol}</span>
            {token.price ? (
              <span>${token.price.toFixed(6)}</span>
            ) : (
              <PriceLoader />
            )}
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Network Fee</span>
            <span>~0.000005 SOL</span>
          </div>
        </div>

        <Button
          onClick={onBuy}
          disabled={isLoading || !buyAmount || parseFloat(buyAmount) <= 0}
          className="w-full disabled:opacity-50 rounded-[2px]"
        >
          {isLoading ? "Processing..." : `Buy ${token.symbol}`}
        </Button>

        <p className="text-xs text-gray-400 text-center">
          Trading functionality requires external swap integration
        </p>
      </div>
    </>
  );

  if (withinCard) {
    return <div>{content}</div>;
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-0"></CardHeader>
      <CardContent className="pt-0">{content}</CardContent>
    </Card>
  );
};
