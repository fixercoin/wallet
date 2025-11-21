import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Check, ExternalLink } from "lucide-react";
import { dexscreenerAPI, DexscreenerToken } from "@/lib/services/dexscreener";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { TokenInfo } from "@/lib/wallet";
import { getTokenMetadata, KNOWN_TOKENS } from "@/lib/services/solana-rpc";

export default function TokenSearchDetail() {
  const { mint = "" } = useParams();
  const navigate = useNavigate();
  const { tokens, addCustomToken, refreshTokens } = useWallet();
  const { toast } = useToast();
  const [dexToken, setDexToken] = useState<DexscreenerToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const alreadyAdded = useMemo(
    () => tokens.some((t) => t.mint === mint),
    [tokens, mint],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await dexscreenerAPI.getTokenByMint(mint);
        if (mounted) setDexToken(t);
      } catch {
        if (mounted) setDexToken(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mint]);

  const onAdd = async () => {
    if (!dexToken) return;
    setAdding(true);
    try {
      const baseMint = dexToken.baseToken?.address || mint;
      const meta = await getTokenMetadata(baseMint).catch(() => null);
      const decimals = meta?.decimals ?? 9;
      const symbol = dexToken.baseToken?.symbol || meta?.symbol || "TOKEN";
      const name = dexToken.baseToken?.name || meta?.name || symbol;
      const priceUsd = dexToken.priceUsd
        ? parseFloat(dexToken.priceUsd)
        : undefined;

      // Get logo from DexScreener API, fallback to KNOWN_TOKENS
      let logoURI = dexToken.info?.imageUrl;
      if (!logoURI && KNOWN_TOKENS[baseMint]) {
        logoURI = KNOWN_TOKENS[baseMint].logoURI;
      }

      const token: TokenInfo = {
        mint: baseMint,
        symbol,
        name,
        decimals,
        logoURI,
        price: priceUsd,
      };

      addCustomToken(token);

      // Trigger immediate refresh to get balance and price data
      await refreshTokens();

      toast({ title: "Token added" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Add failed", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="text-sm text-gray-600">Loading token...</div>
      </div>
    );
  }

  // If token not found in DexScreener, check KNOWN_TOKENS
  const knownToken = KNOWN_TOKENS[mint];
  if (!dexToken && !knownToken) {
    return (
      <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="mb-3 text-gray-800">Token not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );
  }

  const img = dexToken?.info?.imageUrl || knownToken?.logoURI;
  const symbol = dexToken?.baseToken?.symbol || knownToken?.symbol || "";
  const name = dexToken?.baseToken?.name || knownToken?.name || symbol;
  const priceUsd = dexToken?.priceUsd ? parseFloat(dexToken.priceUsd) : 0;

  return (
    <div className="express-p2p-page dark-theme min-h-screen bg-gray-900 text-white">
      <div className="w-full md:max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 p-0 rounded-[2px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="text-base font-semibold text-white">Token detail</div>
        </div>

        <Card className="border border-gray-700/40 bg-gradient-to-br from-gray-800 via-gray-800 to-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={symbol}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold text-white">
                  {symbol || name}
                </div>
                <div className="text-xs text-gray-400 truncate">{name}</div>
              </div>
              {priceUsd > 0 ? (
                <div className="ml-auto text-right">
                  <div className="text-sm font-semibold text-white">
                    ${priceUsd.toFixed(6)}
                  </div>
                  <div className="text-xs text-gray-400">USD</div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 text-xs text-gray-400">
              <div>Mint Address</div>
              <div className="font-mono text-[11px] break-all text-gray-300">
                {mint}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {alreadyAdded ? (
                <Button disabled className="flex-1 rounded-[2px]">
                  <Check className="h-4 w-4 mr-2" /> Added
                </Button>
              ) : (
                <Button
                  onClick={onAdd}
                  disabled={adding}
                  className="flex-1 rounded-[2px]"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Token
                </Button>
              )}
              <a
                href={dexToken.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-[2px] border border-gray-600 px-3 text-sm text-gray-400 hover:bg-gray-700"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
