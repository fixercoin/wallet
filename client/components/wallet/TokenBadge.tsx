import React from "react";
import { Badge } from "@/components/ui/badge";
import { TokenInfo } from "@/lib/wallet";

interface TokenBadgeProps {
  token: TokenInfo;
}

export const TokenBadge: React.FC<TokenBadgeProps> = ({ token }) => {
  // Simple badge showing token symbol
  return (
    <Badge variant="secondary" className="bg-gray-700 text-gray-300">
      {token.symbol}
    </Badge>
  );
};
