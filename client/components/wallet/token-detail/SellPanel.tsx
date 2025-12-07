import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign } from "lucide-react";
import { TokenInfo } from "@/lib/wallet";
import { PriceLoader } from "@/components/ui/price-loader";
import { useState } from "react";

interface SellPanelProps {
  token: TokenInfo;
  onSell: () => void;
  quote: null;
  isLoading: boolean;
  withinCard?: boolean;
}

export const SellPanel: React.FC<SellPanelProps> = ({
  token,
  onSell,
  isLoading,
  withinCard = false,
}) => {
  const [sellAmount, setSellAmount] = useState("");
  const maxBalance = token.balance || 0;

  const content = (
    <>
      <div className="pb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-red-400" />
          Sell {token.symbol}
        </h3>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-gray-400">Amount to sell</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSellAmount(maxBalance.toString())}
              className="text-xs h-auto p-0 rounded-[2px]"
            >
              Max: {maxBalance.toLocaleString()} {token.symbol}
            </Button>
          </div>
          <Input
            type="number"
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value)}
            placeholder="0"
            max={maxBalance}
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-2">Estimated to receive</div>
          <div className="text-lg font-semibold text-white">
            ~
            {(
              ((parseFloat(sellAmount) || 0) * (token.price || 0)) /
              100
            ).toFixed(6)}{" "}
            SOL
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Price per {token.symbol}</span>
            <span>${token.price?.toFixed(6) || "0.000000"}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Network Fee</span>
            <span>~0.000005 SOL</span>
          </div>
        </div>

        <Button
          onClick={onSell}
          disabled={
            isLoading ||
            !sellAmount ||
            parseFloat(sellAmount) <= 0 ||
            parseFloat(sellAmount) > maxBalance
          }
          className="w-full disabled:opacity-50 rounded-[2px]"
        >
          {isLoading ? "Processing..." : `Sell ${token.symbol}`}
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
