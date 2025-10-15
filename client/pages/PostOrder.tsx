import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { ArrowLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { createOrder } from "@/lib/p2p";

export default function PostOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [usdToPkr, setUsdToPkr] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRate() {
      try {
        const cached = localStorage.getItem("usd_to_pkr");
        if (cached) {
          try {
            const { rate, ts } = JSON.parse(cached);
            if (typeof rate === "number" && Date.now() - ts < 60 * 60 * 1000) {
              if (!cancelled) setUsdToPkr(rate);
            }
          } catch {}
        }

        const res = await fetch("/api/forex/rate?base=USD&symbols=PKR");
        if (!res.ok) return;
        const data = await res.json();
        const rate = data?.rates?.PKR;
        if (typeof rate === "number" && isFinite(rate) && !cancelled) {
          setUsdToPkr(rate);
          try {
            localStorage.setItem(
              "usd_to_pkr",
              JSON.stringify({ rate, ts: Date.now() }),
            );
          } catch {}
        }
      } catch {}
    }

    loadRate();
    return () => {
      cancelled = true;
    };
  }, []);

  const getPkRFromUsd = (usd: number): number | null => {
    const rate = usdToPkr;
    if (!rate || !isFinite(rate) || !isFinite(usd)) return null;
    return Math.round(usd * rate * 100) / 100;
  };

  const fetchDexPriceUsd = async (symbol: string): Promise<number | null> => {
    try {
      const pairs = await dexscreenerAPI.searchTokens(symbol);
      const solPairs = pairs.filter((p) => p.chainId === "solana");
      const candidates = solPairs.filter(
        (p) => p.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase(),
      );
      const list = candidates.length > 0 ? candidates : solPairs;
      const ranked = list
        .filter((p) => p.priceUsd && isFinite(parseFloat(p.priceUsd)))
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
      const top = ranked[0];
      if (!top) return null;
      return parseFloat(top.priceUsd!);
    } catch {
      return null;
    }
  };

  // Auto-fill token price (PKR) via DexScreener for Buy and Sell sections
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!usdToPkr) return;
      try {
        const sym = buyToken;
        const usd = await fetchDexPriceUsd(sym);
        if (usd == null) return;
        const pkr = getPkRFromUsd(usd);
        if (pkr == null) return;
        if (!cancelled) setBuyPrice(pkr);
      } catch {}
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [buyToken, usdToPkr]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!usdToPkr) return;
      try {
        const sym = sellToken;
        const usd = await fetchDexPriceUsd(sym);
        if (usd == null) return;
        const pkr = getPkRFromUsd(usd);
        if (pkr == null) return;
        if (!cancelled) setSellTokenPricePKR(pkr);
      } catch {}
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [sellToken, usdToPkr]);

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [adminToken, setAdminToken] = useState("");

  // Buy form
  const [buyMinPKR, setBuyMinPKR] = useState<number | "">("");
  const [buyMaxPKR, setBuyMaxPKR] = useState<number | "">("");
  const [buyToken, setBuyToken] = useState("USDC");
  const [buyPrice, setBuyPrice] = useState<number | "">("");
  const [buyAccountName, setBuyAccountName] = useState("");
  const [buyAccountNumber, setBuyAccountNumber] = useState("");
  const [buyPaymentChannel, setBuyPaymentChannel] = useState("easypaisa");

  // Sell form
  const [sellToken, setSellToken] = useState("USDC");
  const [sellMinTokenAmount, setSellMinTokenAmount] = useState<number | "">("");
  const [sellMaxTokenAmount, setSellMaxTokenAmount] = useState<number | "">("");
  const [sellTokenPricePKR, setSellTokenPricePKR] = useState<number | "">("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sellWalletAddress, setSellWalletAddress] = useState("");
  const [sellNetwork, setSellNetwork] = useState("");

  const handleSave = async () => {
    try {
      if (!adminToken) {
        toast({ title: "Admin token required", variant: "destructive" });
        return;
      }
      if (mode === "buy") {
        if (!buyAmountPKR || !buyPrice) return;
        await createOrder(
          {
            side: "buy",
            amountPKR: Number(buyAmountPKR),
            quoteAsset: buyToken,
            pricePKRPerQuote: Number(buyPrice),
            paymentMethod: "easypaisa",
            roomId: "global",
          },
          adminToken,
        );
      } else {
        if (!sellMinTokenAmount || !sellMaxTokenAmount || !sellTokenPricePKR)
          return;
        const maxPkr = Number(sellMaxTokenAmount) * Number(sellTokenPricePKR);
        await createOrder(
          {
            side: "sell",
            amountPKR: Number(maxPkr),
            quoteAsset: sellToken,
            pricePKRPerQuote: Number(sellTokenPricePKR),
            paymentMethod: "easypaisa",
            roomId: "global",
          } as any,
          adminToken,
        );
      }
      toast({ title: "Order saved" });
      navigate("/express/orderbook");
    } catch (e: any) {
      toast({
        title: "Failed to save",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/", { state: { goP2P: true } })}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))]"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center font-medium">Post Order</div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/express/orderbook")}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))]"
            aria-label="Orderbook"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="wallet-card rounded-2xl p-6 space-y-5">
          <div className="flex gap-2 bg-white rounded-xl p-1 border w-full">
            <button
              className={`flex-1 py-2 rounded-lg ${mode === "buy" ? "bg-pink-100 font-medium" : ""}`}
              onClick={() => setMode("buy")}
            >
              Buy
            </button>
            <button
              className={`flex-1 py-2 rounded-lg ${mode === "sell" ? "bg-pink-100 font-medium" : ""}`}
              onClick={() => setMode("sell")}
            >
              Sell
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Admin token
            </label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 bg-white"
              placeholder="Required to save orders"
            />
          </div>

          {mode === "buy" ? (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Amount (PKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={buyAmountPKR}
                  onChange={(e) =>
                    setBuyAmountPKR(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Token
                </label>
                <select
                  value={buyToken}
                  onChange={(e) => setBuyToken(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                  <option value="FIXERCOIN">FIXERCOIN</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Token price (PKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={buyPrice}
                  onChange={(e) =>
                    setBuyPrice(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Payment method
                </label>
                <input
                  disabled
                  className="w-full border rounded-xl px-3 py-2 bg-gray-50"
                  value="easypaisa"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Minimum token amount
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={sellMinTokenAmount}
                    onChange={(e) =>
                      setSellMinTokenAmount(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Maximum token amount
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={sellMaxTokenAmount}
                    onChange={(e) =>
                      setSellMaxTokenAmount(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Token
                </label>
                <select
                  value={sellToken}
                  onChange={(e) => setSellToken(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                  <option value="FIXERCOIN">FIXERCOIN</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Token price (PKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={sellTokenPricePKR}
                  onChange={(e) =>
                    setSellTokenPricePKR(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Account name
                  </label>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Account number
                  </label>
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                    placeholder="0000000000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Payment method
                </label>
                <input
                  disabled
                  className="w-full border rounded-xl px-3 py-2 bg-gray-50"
                  value="easypaisa"
                />
              </div>
            </>
          )}

          <Button className="w-full wallet-button-primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
