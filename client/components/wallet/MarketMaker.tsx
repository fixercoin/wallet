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
import { botOrdersStorage, TokenType } from "@/lib/bot-orders-storage";
import { useNavigate } from "react-router-dom";

interface MarketMakerProps {
  onBack: () => void;
}

const TOKEN_CONFIGS: Record<
  TokenType,
  { name: string; mint: string; spread: number; decimals: number }
> = {
  FIXERCOIN: {
    name: "FIXERCOIN",
    mint: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
    spread: 0.000002,
    decimals: 6,
  },
  SOL: {
    name: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    spread: 2,
    decimals: 9,
  },
};

export const MarketMaker: React.FC<MarketMakerProps> = ({ onBack }) => {
  const { tokens } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedToken, setSelectedToken] = useState<TokenType>("FIXERCOIN");
  const [numberOfMakers, setNumberOfMakers] = useState("5");
  const [orderAmount, setOrderAmount] = useState("0.02");
  const [isLoading, setIsLoading] = useState(false);

  const tokenConfig = TOKEN_CONFIGS[selectedToken];

  const solToken = useMemo(
    () => tokens.find((t) => t.symbol === "SOL"),
    [tokens],
  );

  const solBalance = solToken?.balance || 0;

  const validateInputs = useCallback((): string | null => {
    const numMakers = parseInt(numberOfMakers);
    if (isNaN(numMakers) || numMakers < 1 || numMakers > 1000)
      return "Number of makers must be between 1 and 1000";

    const amount = parseFloat(orderAmount);
    if (isNaN(amount) || amount < 0.01)
      return "Order amount must be at least 0.01 SOL";

    return null;
  }, [numberOfMakers, orderAmount]);

  const calculateTotalCost = useCallback((): {
    totalNeeded: number;
    fees: number;
  } => {
    const numMakers = parseInt(numberOfMakers) || 1;
    const amount = parseFloat(orderAmount) || 0;

    const totalBuySol = numMakers * amount;
    const fees = totalBuySol * 0.01;

    return {
      totalNeeded: totalBuySol + fees,
      fees,
    };
  }, [numberOfMakers, orderAmount]);

  const { totalNeeded, fees } = calculateTotalCost();
  const canAfford = solBalance >= totalNeeded;
  const solNeeded = Math.max(0, totalNeeded - solBalance);

  const handleRunBot = async () => {
    const validationError = validateInputs();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    if (!canAfford) {
      toast({
        title: "Insufficient SOL",
        description: `You need ${totalNeeded.toFixed(4)} SOL but only have ${solBalance.toFixed(4)} SOL`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const numMakers = parseInt(numberOfMakers);
      const amount = parseFloat(orderAmount);

      const session = botOrdersStorage.createSession(
        selectedToken,
        tokenConfig.mint,
        numMakers,
        amount,
        tokenConfig.spread,
      );

      botOrdersStorage.saveSession(session);

      toast({
        title: "Bot Started",
        description: `Market maker bot started with ${numMakers} makers`,
      });

      navigate(`/market-maker/running/${session.id}`);
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
  };

  return (
    <div className="w-full md:max-w-lg mx-auto px-4 relative z-0 pt-8">
      <div className="rounded-none border-0 bg-transparent">
        <div className="space-y-6 p-6 relative">
          <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
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
                min="0.01"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
                placeholder="Minimum 0.01 SOL"
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
                {selectedToken === "FIXERCOIN" ? "+0.00000200" : "+2"}{" "}
                {selectedToken}
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="text-xs text-blue-300">
              <p className="font-semibold mb-1">Fee Structure:</p>
              <p>• 0.0007 SOL per buy trade execution</p>
              <p>• 0.0007 SOL per sell trade execution</p>
              <p>• Fees deducted when trade is executed</p>
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
