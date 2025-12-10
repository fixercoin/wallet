import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dexscreenerAPI, DexscreenerToken } from "@/lib/services/dexscreener";
import { KNOWN_TOKENS } from "@/lib/services/solana-rpc";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, Loader2 } from "lucide-react";

interface TokenSearchProps {
  className?: string;
  inputClassName?: string;
}

export const TokenSearch: React.FC<TokenSearchProps> = ({
  className,
  inputClassName,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DexscreenerToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // If the query looks like a mint address, try to prioritize exact token by mint
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

        // Only solana
        const filtered = list.filter(
          (t) => (t.chainId || "").toLowerCase() === "solana",
        );

        // If no results from DexScreener, check KNOWN_TOKENS
        if (filtered.length === 0) {
          const knownMatches = Object.values(KNOWN_TOKENS).filter(
            (token) =>
              token.symbol.toLowerCase().includes(q.toLowerCase()) ||
              token.name.toLowerCase().includes(q.toLowerCase()) ||
              token.mint.toLowerCase().includes(q.toLowerCase()),
          );

          // Convert KNOWN_TOKENS to DexscreenerToken format for display
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
          setOpen(filtered.length > 0);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setOpen(false);
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

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const onSelect = (token: DexscreenerToken) => {
    const mint = token.baseToken?.address || token.quoteToken?.address;
    if (!mint) return;
    setOpen(false);
    setQuery("");
    navigate(`/token/${mint}`);
  };

  return (
    <div ref={containerRef} className={className}>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens..."
          className={
            inputClassName
              ? `pl-9 ${inputClassName}`
              : "pl-9 bg-white/80 text-gray-900 placeholder:text-gray-500 border border-[#22c55e]/30 focus-visible:ring-0"
          }
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-[#22c55e]/30 bg-gray-800 backdrop-blur-sm shadow-lg">
          {results.slice(0, 20).map((r) => {
            const mint = r.baseToken?.address || r.quoteToken?.address;
            const img = r.info?.imageUrl;
            const name = r.baseToken?.name || r.quoteToken?.name || "Unknown";
            const symbol = r.baseToken?.symbol || r.quoteToken?.symbol || "";
            return (
              <button
                key={`${r.pairAddress}-${mint}`}
                onClick={() => onSelect(r)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 text-left"
                aria-label={`Open ${symbol} ${name}`}
              >
                <div className="h-7 w-7 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={symbol}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                      {symbol.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {symbol ? `${symbol}` : name}
                    {symbol && name && symbol !== name ? (
                      <span className="text-gray-400 font-normal">
                        {" "}
                        · {name}
                      </span>
                    ) : null}
                  </div>
                  {mint && (
                    <div className="text-[11px] text-gray-400 truncate">
                      {shorten(mint)}
                    </div>
                  )}
                </div>
                <div className="ml-auto">
                  {r.priceUsd ? (
                    <div className="text-xs text-gray-300">
                      ${Number(r.priceUsd).toFixed(6)}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
