import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Search as SearchIcon } from "lucide-react";
import { dexscreenerAPI, DexscreenerToken } from "@/lib/services/dexscreener";
import { KNOWN_TOKENS } from "@/lib/services/solana-rpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function TokenSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DexscreenerToken[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const looksLikeMint = debouncedQuery.trim().length >= 32;

    (async () => {
      try {
        const q = debouncedQuery.trim();
        let list: DexscreenerToken[] = [];

        if (looksLikeMint) {
          const t = await dexscreenerAPI.getTokenByMint(q).catch(() => null);
          if (t) list = [t];
        }

        if (list.length === 0) {
          const found = await dexscreenerAPI.searchTokens(q);
          list = found;
        }

        const filtered = list.filter(
          (t) => (t.chainId || "").toLowerCase() === "solana",
        );

        if (filtered.length === 0) {
          const knownMatches = Object.values(KNOWN_TOKENS).filter(
            (token) =>
              token.symbol.toLowerCase().includes(q.toLowerCase()) ||
              token.name.toLowerCase().includes(q.toLowerCase()) ||
              token.mint.toLowerCase().includes(q.toLowerCase()),
          );

          const convertedKnown = knownMatches.map(
            (token) =>
              ({
                chainId: "solana",
                pairAddress: token.mint,
                baseToken: {
                  address: token.mint,
                  symbol: token.symbol,
                  name: token.name,
                },
                quoteToken: { address: "", symbol: "", name: "" },
                priceUsd: "0",
                info: {
                  imageUrl: token.logoURI,
                },
              }) as any,
          );

          filtered.push(...convertedKnown);
        }

        if (!cancelled) {
          setResults(filtered);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [debouncedQuery]);

  const onSelect = (token: DexscreenerToken) => {
    const mint = token.baseToken?.address || token.quoteToken?.address;
    if (!mint) return;
    navigate(`/token/${mint}`);
  };

  return (
    <div
      className="min-h-screen text-gray-100 relative overflow-y-auto"
      style={{ backgroundColor: "#1f1f1f" }}
    >
      {/* Decorative bottom green wave (SVG) */}
      <svg
        className="bottom-wave z-0 fixed bottom-0"
        viewBox="0 0 1440 220"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="g-search" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.2)" />
            <stop offset="60%" stopColor="rgba(22, 163, 74, 0.15)" />
            <stop offset="100%" stopColor="rgba(34, 197, 94, 0.3)" />
          </linearGradient>
        </defs>
        <path
          d="M0,80 C240,180 480,20 720,80 C960,140 1200,40 1440,110 L1440,220 L0,220 Z"
          fill="url(#g-search)"
          opacity="0.95"
        />
      </svg>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-transparent border-b border-[#22c55e]/30 shadow-sm backdrop-blur-sm">
        <div className="w-full max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            className="h-8 w-8 p-0 rounded-md bg-transparent hover:bg-white/5 text-white ring-0 focus-visible:ring-0 border border-transparent transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-white">Search Tokens</h1>
        </div>
      </div>

      {/* Search Container */}
      <div className="w-full max-w-lg mx-auto px-4 py-4 relative z-20">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by token name, symbol, or mint address..."
            className="pl-10 h-12 bg-gray-800/50 text-gray-100 placeholder:text-gray-500 border border-[#22c55e]/30 focus-visible:ring-2 focus-visible:ring-[#22c55e] focus-visible:border-transparent rounded-lg shadow-sm"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-[#22c55e]" />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="w-full max-w-lg mx-auto px-4 pb-8 relative z-20">
        {query.trim().length < 2 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">
              Start typing to search for tokens...
            </p>
          </div>
        )}

        {query.trim().length >= 2 && loading && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#22c55e] mx-auto mb-2" />
            <p className="text-sm text-gray-400">Searching tokens...</p>
          </div>
        )}

        {query.trim().length >= 2 && !loading && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">No tokens found</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.slice(0, 50).map((r) => {
              const mint = r.baseToken?.address || r.quoteToken?.address;
              const img = r.info?.imageUrl;
              const name = r.baseToken?.name || r.quoteToken?.name || "Unknown";
              const symbol = r.baseToken?.symbol || r.quoteToken?.symbol || "";
              const price = r.priceUsd ? parseFloat(r.priceUsd) : null;

              return (
                <button
                  key={`${r.pairAddress}-${mint}`}
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-md hover:bg-gray-700/60 bg-gray-800/40 border border-[#22c55e]/30 transition-colors text-left shadow-sm"
                  aria-label={`Open ${symbol} ${name}`}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={img} alt={symbol} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-xs">
                      {symbol.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {symbol}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{name}</div>
                    {mint && (
                      <div className="text-[11px] text-gray-500 truncate">
                        {shorten(mint)}
                      </div>
                    )}
                  </div>

                  {price !== null && (
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-semibold text-white">
                        ${price.toFixed(6)}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function shorten(addr: string, chars = 4) {
  if (!addr) return "";
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}
