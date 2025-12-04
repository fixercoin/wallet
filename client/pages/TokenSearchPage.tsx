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
      className="min-h-screen text-gray-900"
      style={{ backgroundColor: "#f3f4f6" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            className="h-8 w-8 p-0 rounded-md bg-transparent hover:bg-gray-100 text-gray-900 ring-0 focus-visible:ring-0 border border-transparent transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900">Search Tokens</h1>
        </div>
      </div>

      {/* Search Container */}
      <div className="w-full max-w-lg mx-auto px-4 py-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by token name, symbol, or mint address..."
            className="pl-10 h-12 bg-white text-gray-900 placeholder:text-gray-500 border border-[#22c55e]/30 focus-visible:ring-2 focus-visible:ring-[#22c55e] focus-visible:border-transparent rounded-lg"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-[#22c55e]" />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="w-full max-w-lg mx-auto px-4 pb-8">
        {query.trim().length < 2 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              Start typing to search for tokens...
            </p>
          </div>
        )}

        {query.trim().length >= 2 && loading && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#22c55e] mx-auto mb-2" />
            <p className="text-sm text-gray-500">Searching tokens...</p>
          </div>
        )}

        {query.trim().length >= 2 && !loading && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No tokens found</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.slice(0, 50).map((r) => {
              const mint = r.baseToken?.address || r.quoteToken?.address;
              const img = r.info?.imageUrl;
              const name = r.baseToken?.name || r.quoteToken?.name || "Unknown";
              const symbol = r.baseToken?.symbol || r.quoteToken?.symbol || "";
              const price = r.priceUsd
                ? parseFloat(r.priceUsd)
                : null;

              return (
                <button
                  key={`${r.pairAddress}-${mint}`}
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-gray-100 bg-white border border-gray-200 transition-colors text-left"
                  aria-label={`Open ${symbol} ${name}`}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={img} alt={symbol} />
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-xs">
                      {symbol.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {symbol}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {name}
                    </div>
                    {mint && (
                      <div className="text-[11px] text-gray-400 truncate">
                        {shorten(mint)}
                      </div>
                    )}
                  </div>

                  {price !== null && (
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-semibold text-gray-900">
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
