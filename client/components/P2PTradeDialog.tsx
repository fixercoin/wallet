import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export interface TradeDetails {
  token: string;
  amountTokens: number;
  amountPKR: number;
  price: number;
}

interface P2PTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (details: TradeDetails) => Promise<void>;
  orderType: "BUY" | "SELL";
  defaultToken?: string;
  defaultPrice?: number;
  minAmount?: number;
  maxAmount?: number;
}

export const P2PTradeDialog: React.FC<P2PTradeDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  orderType,
  defaultToken = "USDC",
  defaultPrice = 280,
  minAmount = 0,
  maxAmount = Infinity,
}) => {
  const [inputType, setInputType] = useState<"tokens" | "pkr">("tokens");
  const [amountTokens, setAmountTokens] = useState("");
  const [amountPKR, setAmountPKR] = useState("");
  const [loading, setLoading] = useState(false);

  const price = defaultPrice;

  // Calculate opposite amount when one changes
  const handleTokensChange = (value: string) => {
    setAmountTokens(value);
    setInputType("tokens");

    if (value) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setAmountPKR((num * price).toFixed(2));
      }
    } else {
      setAmountPKR("");
    }
  };

  const handlePKRChange = (value: string) => {
    setAmountPKR(value);
    setInputType("pkr");

    if (value) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setAmountTokens((num / price).toFixed(6));
      }
    } else {
      setAmountTokens("");
    }
  };

  const isValid = useMemo(() => {
    const tokens = parseFloat(amountTokens) || 0;
    const pkr = parseFloat(amountPKR) || 0;
    return tokens > 0 && pkr > 0 && tokens >= minAmount && tokens <= maxAmount;
  }, [amountTokens, amountPKR, minAmount, maxAmount]);

  const handleSubmit = async () => {
    if (!isValid) return;

    try {
      setLoading(true);
      await onConfirm({
        token: defaultToken,
        amountTokens: parseFloat(amountTokens),
        amountPKR: parseFloat(amountPKR),
        price,
      });
      // Reset form
      setAmountTokens("");
      setAmountPKR("");
      setInputType("tokens");
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting trade:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a2847] border border-gray-300/30 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white uppercase">
            {orderType === "BUY" ? "Buy Crypto" : "Sell Crypto"}
          </DialogTitle>
          <DialogDescription className="text-white/70 uppercase">
            Enter the amount you want to {orderType === "BUY" ? "buy" : "sell"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Token Display */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Token
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              {defaultToken}
            </div>
          </div>

          {/* Price Display */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Price
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              1 {defaultToken} = {price.toFixed(2)} PKR
            </div>
          </div>

          {/* Amount in PKR - Primary Input */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Amount (PKR)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amountPKR}
              onChange={(e) => handlePKRChange(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A5C]/50"
            />
            {minAmount > 0 && maxAmount < Infinity && (
              <div className="text-xs text-white/60 mt-1">
                Min: {(minAmount * price).toFixed(6)} | Max:{" "}
                {(maxAmount * price).toFixed(6)}
              </div>
            )}
          </div>

          {/* Estimated Amount in Token */}
          <div>
            <label className="block text-xs font-semibold text-white/80 uppercase mb-2">
              Estimated {defaultToken}
            </label>
            <div className="px-4 py-3 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-white/90 font-semibold">
              {amountTokens ? parseFloat(amountTokens).toFixed(6) : "0.000000"}{" "}
              {defaultToken}
            </div>
          </div>

          {/* Calculation Preview */}
          {amountTokens && amountPKR && (
            <div className="p-3 rounded-lg bg-[#1a2540]/30 border border-[#FF7A5C]/20">
              <div className="text-xs text-white/70 uppercase mb-2">
                Summary
              </div>
              <div className="text-sm text-white/90">
                {amountTokens} {defaultToken} ={" "}
                {parseFloat(amountPKR).toFixed(2)} PKR
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1 border border-gray-300/30 text-gray-300 hover:bg-gray-300/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="flex-1 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                `${orderType === "BUY" ? "Buy" : "Sell"} Now`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
