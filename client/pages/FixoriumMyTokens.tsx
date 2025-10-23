import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals?: number;
  logoURI?: string;
}

export default function FixoriumMyTokens() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function fetchTokens() {
      setLoading(true);
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
        if (!cancelled) setLoading(false);
      }
    }
    void fetchTokens();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white px-4 py-6 relative overflow-hidden">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Fixorium — My Tokens</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>

        <Card className="mb-4 bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl">
          <CardHeader>
            <CardTitle className="text-sm">Tokens created by Fixorium</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-300">Loading...</div>
            ) : tokens.length === 0 ? (
              <div className="text-sm text-gray-300">No tokens found</div>
            ) : (
              <div className="space-y-3">
                {tokens.map((token) => (
                  <div
                    key={token.mint}
                    className="flex items-center justify-between p-3 rounded-md bg-[#0f1520]/40 border border-white/5 cursor-pointer"
                    onClick={() => navigate(`/token/${token.mint}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {token.logoURI ? (
                          <AvatarImage src={token.logoURI} alt={token.symbol} />
                        ) : (
                          <AvatarFallback className="bg-[#FF7A5C] text-white">{(token.symbol||"?").slice(0,2)}</AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <div className="font-semibold">{token.name}</div>
                        <div className="text-xs text-gray-400">{token.symbol}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 break-words text-right max-w-[45%]">{token.mint}</div>
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
