import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";

interface FixoriumToken {
  mint: string;
  symbol: string;
  name: string;
  decimals?: number;
  logoURI?: string;
}

interface TokenWithPrice extends FixoriumToken {
  price?: number;
}

export default function TokenListing() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<TokenWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchTokens() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/fixorium-tokens");
        if (!res.ok) throw new Error("Failed to fetch tokens");
        const j = await res.json();
        const t = j?.tokens || j?.data || [];
        const tokenList = Array.isArray(t) ? t : [];
        
        // Fetch prices for each token
        const tokensWithPrices = await Promise.all(
          tokenList.map(async (token: FixoriumToken) => {
            try {
              const priceRes = await fetch(
                `/api/dexscreener?mint=${token.mint}`
              );
              if (priceRes.ok) {
                const priceData = await priceRes.json();
                return {
                  ...token,
                  price: priceData?.priceUsd ? parseFloat(priceData.priceUsd) : undefined,
                };
              }
            } catch (e) {
              console.error(`Failed to fetch price for ${token.mint}:`, e);
            }
            return token;
          })
        );

        if (!cancelled) setTokens(tokensWithPrices);
      } catch (e) {
        console.error("Failed to load Fixorium tokens:", e);
        if (!cancelled) setTokens([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void fetchTokens();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-[#FF7A5C]/10 text-white focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center font-medium text-sm">
            FIXORIUM TOKENS
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-sm text-gray-300">Loading tokens...</div>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-sm text-gray-300">No tokens found</div>
          </div>
        ) : (
          <div className="grid gap-4">
            {tokens.map((token) => (
              <Card
                key={token.mint}
                className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl cursor-pointer hover:border-[#FF7A5C]/50 transition-colors overflow-hidden"
                onClick={() => navigate(`/token/${token.mint}`)}
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Token Logo and Info - Left */}
                    <div className="flex flex-col items-center gap-2">
                      <Avatar className="h-16 w-16">
                        {token.logoURI ? (
                          <AvatarImage src={token.logoURI} alt={token.symbol} />
                        ) : (
                          <AvatarFallback className="bg-[#FF7A5C] text-white text-lg font-semibold">
                            {(token.symbol || "?").slice(0, 2)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="text-center">
                        <div className="text-sm font-semibold">{token.name}</div>
                        <div className="text-xs text-gray-400">{token.symbol}</div>
                      </div>
                    </div>

                    {/* Price - Center */}
                    <div className="flex-1 flex flex-col justify-center items-center">
                      <div className="text-xs text-gray-400 mb-1">Price</div>
                      <div className="text-lg font-semibold text-[#FF7A5C]">
                        {token.price !== undefined
                          ? token.price > 0.01
                            ? `$${token.price.toFixed(4)}`
                            : `$${token.price.toExponential(2)}`
                          : "—"}
                      </div>
                    </div>

                    {/* Amount/Balance - Right */}
                    <div className="flex flex-col justify-center items-end">
                      <div className="text-xs text-gray-400 mb-1">Balance</div>
                      <div className="text-lg font-semibold">0.00</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
