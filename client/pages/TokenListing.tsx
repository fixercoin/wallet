import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default function TokenListing() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<FixoriumToken[]>([]);
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
        if (!cancelled) setTokens(Array.isArray(t) ? t : []);
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
        <Card className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="text-sm text-gray-300">Loading tokens...</div>
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-sm text-gray-300">No tokens found</div>
              </div>
            ) : (
              <div className="space-y-3">
                {tokens.map((token) => (
                  <div
                    key={token.mint}
                    className="flex items-center justify-between p-3 rounded-md bg-[#0f1520]/40 border border-white/5 cursor-pointer hover:bg-[#0f1520]/60 transition-colors"
                    onClick={() => navigate(`/token/${token.mint}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {token.logoURI ? (
                          <AvatarImage src={token.logoURI} alt={token.symbol} />
                        ) : (
                          <AvatarFallback className="bg-[#FF7A5C] text-white">
                            {(token.symbol || "?").slice(0, 2)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <div className="font-semibold text-sm">{token.name}</div>
                        <div className="text-xs text-gray-400">
                          {token.symbol}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 break-words text-right max-w-[45%]">
                      {token.mint}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
