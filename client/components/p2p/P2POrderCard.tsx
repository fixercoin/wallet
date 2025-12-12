import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { P2POrder } from "@/lib/p2p-api";

interface P2POrderCardProps {
  order: P2POrder;
  counterparty: string;
  status: "negotiating" | "confirmed" | "completed";
  onClick?: () => void;
}

export function P2POrderCard({
  order,
  counterparty,
  status,
  onClick,
}: P2POrderCardProps) {
  const displayAmount = order.amountTokens || parseFloat(order.token_amount || "0");
  const displayPrice =
    order.amountPKR || order.pkr_amount || 0;

  const statusConfig = {
    negotiating: {
      label: "Negotiating",
      color: "bg-yellow-500/20 text-yellow-200 border-yellow-500/30",
      dot: "bg-yellow-500",
    },
    confirmed: {
      label: "Confirmed",
      color: "bg-blue-500/20 text-blue-200 border-blue-500/30",
      dot: "bg-blue-500",
    },
    completed: {
      label: "Completed",
      color: "bg-green-500/20 text-green-200 border-green-500/30",
      dot: "bg-green-500",
    },
  };

  const config = statusConfig[status];

  return (
    <Card
      onClick={onClick}
      className={cn(
        "border-gray-700/30 bg-gray-900/50 hover:bg-gray-900/70 transition-all cursor-pointer",
        onClick && "hover:shadow-lg hover:shadow-purple-500/20",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left Side - Order Details */}
          <div className="flex-1 space-y-2">
            {/* Order Type and Amount */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "px-3 py-1 rounded font-semibold text-sm",
                  order.type === "BUY"
                    ? "bg-green-500/20 text-green-300"
                    : "bg-purple-500/20 text-purple-300",
                )}
              >
                {order.type === "BUY" ? "BUY" : "SELL"}
              </div>
              <span className="text-sm font-semibold">
                {displayAmount} {order.token}
              </span>
            </div>

            {/* Price Info */}
            <div className="text-xs text-gray-400 space-y-1">
              <p>PKR {displayPrice?.toFixed(2)}</p>
              {order.minAmountPKR && order.maxAmountPKR && (
                <p>
                  Range: {order.minAmountPKR?.toFixed(2)} -{" "}
                  {order.maxAmountPKR?.toFixed(2)} PKR
                </p>
              )}
            </div>

            {/* Counterparty Info */}
            <div className="text-xs text-gray-500 truncate">
              With: {counterparty.slice(0, 8)}...{counterparty.slice(-4)}
            </div>

            {/* Payment Method */}
            {order.payment_method && (
              <div className="text-xs text-gray-400">
                Payment: {order.payment_method.replace(/_/g, " ")}
              </div>
            )}
          </div>

          {/* Right Side - Status */}
          <div className="flex flex-col items-end gap-3">
            <Badge
              className={cn(
                "border",
                config.color,
              )}
              variant="outline"
            >
              <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1.5", config.dot)}></span>
              {config.label}
            </Badge>

            {onClick && (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
