import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Info,
  Plus,
  RotateCw,
} from "lucide-react";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import { jupiterAPI } from "@/lib/services/jupiter";
import { fixercoinPriceService } from "@/lib/services/fixercoin-price";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_WALLET } from "@/lib/p2p";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpressP2PProps {
  onBack?: () => void;
}

interface PendingOrderSnapshot {
  tradeId: string;
  minimized: boolean;
  status?: string;
  params: Record<string, any>;
  ts?: number;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1 text-xs font-medium text-muted-foreground">
    {children}
  </div>
);

const CurrencyBadge = ({ label }: { label: string }) => (
  <span className="inline-flex shrink-0 items-center rounded-md bg-secondary/60 px-2 py-1 text-xs font-semibold text-foreground">
    {label}
  </span>
);

const W_SOL_MINT = "So11111111111111111111111111111111111111112";
const FIXERCOIN_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";

const TOKEN_MINTS = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  SOL: W_SOL_MINT,
  FIXERCOIN: FIXERCOIN_MINT,
} as const;

type PaymentMethodId = "bank" | "easypaisa" | "firstpay";

type PaymentMethodOption = {
  id: PaymentMethodId;
  label: string;
  description?: string;
};

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "bank",
    label: "BANK ACCOUNT",
    description: "Settle using a standard bank account transfer.",
  },
  {
    id: "easypaisa",
    label: "EASYPAISA",
    description: "Use your Easypaisa account-linked bank for instant payments.",
  },
  {
    id: "firstpay",
    label: "FIRSTPAY",
    description: "Accept and send payments via FirstPay business banking.",
  },
];

function detectPaymentMethod(accountNumber: string): PaymentMethodId {
  const v = String(accountNumber || "").trim();
  const phoneLike =
    /^(?:\+?92|0)3\d{2}\d{7}$/.test(v) ||
    /^92\d{10}$/.test(v) ||
    /^03\d{9}$/.test(v);
  if (phoneLike) return "easypaisa";
  if (/^FP/i.test(v) || /firstpay/i.test(v)) return "firstpay";
  if (/^PK/i.test(v) || /\d{10,}/.test(v)) return "bank";
  return "bank";
}

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();

  // Manual refresh system
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const triggerRefresh = () => {
    setRefreshTick((x) => x + 1);
    setLastRefreshed(Date.now());
    toast({ title: "Refreshed" });
  };

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [pkrAmount, setPkrAmount] = useState<string>(""); // buy: PKR -> token
  const [tokenAmount, setTokenAmount] = useState<string>(""); // sell: token -> PKR
  const [pkrPerUsd, setPkrPerUsd] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const [selectedToken, setSelectedToken] = useState<
    "USDC" | "SOL" | "FIXERCOIN"
  >("USDC");
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const tokenMenuRef = useRef<HTMLDivElement | null>(null);
  const [tokenPriceUsd, setTokenPriceUsd] = useState<number>(1); // default: 1 USDC = $1
  const [loadingTokenPrice, setLoadingTokenPrice] = useState(false);
  const [tokenPriceError, setTokenPriceError] = useState<string | null>(null);

  // Binance price (USD) and derived PKR value
  const [binancePriceUsd, setBinancePriceUsd] = useState<number | null>(null);
  const [loadingBinance, setLoadingBinance] = useState(false);
  const [binanceError, setBinanceError] = useState<string | null>(null);

  // Removed manual selection UI; keep state for potential future use
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const paymentMenuRef = useRef<HTMLDivElement | null>(null);

  // DexScreener state (optional) — defined to avoid runtime ReferenceErrors
  const [dexToken, setDexToken] = useState<any | null>(null);
  const [loadingDexData, setLoadingDexData] = useState(false);
  const [dexError, setDexError] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  // Pending order (resume if interrupted)
  const [pendingOrder, setPendingOrder] = useState<PendingOrderSnapshot | null>(
    null,
  );

  const persistPendingOrder = useCallback(
    (snapshot: PendingOrderSnapshot | null) => {
      if (!snapshot) {
        try {
          localStorage.removeItem("expressPendingOrder");
        } catch {}
        setPendingOrder(null);
        return;
      }
      try {
        localStorage.setItem("expressPendingOrder", JSON.stringify(snapshot));
      } catch {}
      setPendingOrder(snapshot);
    },
    [],
  );

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("expressPendingOrder");
        if (!raw) {
          setPendingOrder(null);
          return;
        }
        const parsed = JSON.parse(raw) as PendingOrderSnapshot;
        if (parsed && typeof parsed === "object" && parsed.tradeId) {
          setPendingOrder(parsed);
        } else {
          setPendingOrder(null);
        }
      } catch {
        setPendingOrder(null);
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "expressPendingOrder") read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Handle pending order actions
  const clearPendingOrder = useCallback(() => {
    persistPendingOrder(null);
  }, [persistPendingOrder]);

  const resumePendingOrder = useCallback(() => {
    if (!pendingOrder) return;
    const params = pendingOrder.params || {};
    navigate("/express/start-trade", {
      state: {
        ...(params as Record<string, any>),
        tradeId: pendingOrder.tradeId,
      },
    });
  }, [navigate, pendingOrder]);

  const minimizePendingOrder = useCallback(() => {
    if (!pendingOrder) return;
    persistPendingOrder({
      ...pendingOrder,
      minimized: true,
      ts: Date.now(),
    });
  }, [pendingOrder, persistPendingOrder]);

  const expandPendingOrder = useCallback(() => {
    if (!pendingOrder) return;
    persistPendingOrder({
      ...pendingOrder,
      minimized: false,
      ts: Date.now(),
    });
  }, [pendingOrder, persistPendingOrder]);

  // Auto-resume pending order on mount (from main branch)
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!pendingOrder) {
      notifiedRef.current = false;
      return;
    }

    if (pendingOrder.status === "pending") {
      return;
    }

    if (notifiedRef.current) return;
    notifiedRef.current = true;
    try {
      const obj = {
        ...(pendingOrder as any),
        minimized: false,
        ts: Date.now(),
      };
      localStorage.setItem("expressPendingOrder", JSON.stringify(obj));
    } catch {}
    const st = (pendingOrder as any)?.params || {};
    navigate("/express/start-trade", {
      state: { ...(st || {}), tradeId: (pendingOrder as any)?.tradeId },
    });
  }, [pendingOrder, navigate]);

  // P2P market posts (polled for demo realtime)
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const resp = await fetch("/api/p2p/list");
        if (!resp.ok) return;
        const j = await resp.json();
        if (mounted) setPosts(j.posts || []);
      } catch (e) {
        // ignore
      }
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [refreshTick]);

  const handleCopyAddress = async () => {
    if (!wallet) return;
    const success = await copyToClipboard(wallet.publicKey);
    toast({
      title: success ? "Address Copied" : "Copy Failed",
      description: success
        ? "Wallet address copied to clipboard."
        : "Unable to copy wallet address.",
      variant: success ? undefined : "destructive",
    });
  };

  // Close token/payment menus on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (tokenMenuRef.current && !tokenMenuRef.current.contains(target)) {
        setTokenMenuOpen(false);
      }
      if (paymentMenuRef.current && !paymentMenuRef.current.contains(target)) {
        setPaymentMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Fetch PKR rate (1 USD -> PKR). USDC assumed pegged to USD
  useEffect(() => {
    let abort = false;
    const fetchRate = async () => {
      try {
        setLoadingRate(true);
        setRateError(null);
        const resp = await fetch("/api/forex/rate?base=USD&symbols=PKR");
        if (!resp.ok) throw new Error("rate request failed");
        const json = (await resp.json()) as { rates?: { PKR?: number } };
        const val = json?.rates?.PKR;
        if (!val || !isFinite(val) || val <= 0) throw new Error("invalid rate");
        if (!abort) setPkrPerUsd(val);
      } catch (e) {
        if (!abort) setRateError("Failed to load rate");
      } finally {
        if (!abort) setLoadingRate(false);
      }
    };
    fetchRate();
    return () => {
      abort = true;
    };
  }, [refreshTick]);

  // Fetch token USD price depending on selected token
  useEffect(() => {
    let abort = false;
    const load = async () => {
      try {
        setLoadingTokenPrice(true);
        setTokenPriceError(null);
        if (selectedToken === "USDC") {
          if (!abort) setTokenPriceUsd(1);
          return;
        }
        if (selectedToken === "SOL") {
          try {
            const prices = await jupiterAPI.getTokenPrices([W_SOL_MINT]);
            const p = prices?.[W_SOL_MINT];
            if (p && p > 0) {
              if (!abort) setTokenPriceUsd(p);
              return;
            }
          } catch {}
          if (!abort) setTokenPriceUsd(100);
          return;
        }
        if (selectedToken === "FIXERCOIN") {
          try {
            const fixer = await fixercoinPriceService
              .getFixercoinPrice()
              .catch(() => null as any);
            if (fixer && typeof fixer.price === "number" && fixer.price > 0) {
              if (!abort) setTokenPriceUsd(fixer.price);
              return;
            }
          } catch {}
          try {
            const price = await fixercoinPriceService.getPrice();
            if (price && price > 0) {
              if (!abort) setTokenPriceUsd(price);
              return;
            }
          } catch {}
          if (!abort) setTokenPriceUsd(0.000023);
          return;
        }
      } catch (e) {
        if (!abort) setTokenPriceError("Price unavailable");
      } finally {
        if (!abort) setLoadingTokenPrice(false);
      }
    };
    load();
    return () => {
      abort = true;
    };
  }, [selectedToken, refreshTick]);

  // Fetch Binance P2P price (server proxied) for selected token when needed to avoid CORS
  useEffect(() => {
    let abort = false;
    const loadBinanceP2P = async () => {
      try {
        setLoadingBinance(true);
        setBinanceError(null);
        setBinancePriceUsd(null);

        // Only fetch for tokens that Binance P2P supports; USDC/USDT are commonly supported.
        const asset =
          selectedToken === "USDC"
            ? "USDC"
            : selectedToken === "SOL"
              ? "SOL"
              : selectedToken;

        // Use Binance P2P search endpoint via server proxy to avoid CORS issues
        const body = JSON.stringify({
          page: 1,
          rows: 20,
          payTypes: [],
          countries: [],
          asset: asset,
          tradeType: "SELL",
          fiat: "PKR",
          publisherType: null,
          merchantCheck: false,
        });

        const resp = await fetch(
          `/api/binance-p2p/bapi/c2c/v2/public/c2c/adv/search`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body,
          },
        );

        if (!resp.ok) {
          // fallback to standard Binance REST API proxied via /api/binance
          throw new Error("p2p proxy failed");
        }

        const json = await resp.json().catch(() => null as any);
        const data = json?.data;
        if (Array.isArray(data) && data.length > 0) {
          // each item has adv.price and adv.tradeMethods etc. Compute median price
          const prices = data
            .map((d: any) => Number(d?.adv?.price))
            .filter((p: number) => isFinite(p) && p > 0)
            .slice(0, 10);
          if (prices.length > 0) {
            // average
            const sum = prices.reduce((a: number, b: number) => a + b, 0);
            const avg = sum / prices.length;
            if (!abort) setBinancePriceUsd(avg);
            return;
          }
        }

        // fallback: use Binance spot ticker proxied
        const mapSymbol = (tok: string) => {
          if (tok === "USDC") return "USDCUSDT";
          if (tok === "SOL") return "SOLUSDT";
          if (tok === "FIXERCOIN") return "FIXERCOINUSDT";
          return `${tok}USDT`;
        };
        const symbol = mapSymbol(selectedToken);
        const fallbackResp = await fetch(
          `/api/binance/api/v3/ticker/price?symbol=${symbol}`,
        );
        if (!fallbackResp.ok) throw new Error("binance fallback failed");
        const fj = await fallbackResp.json();
        const price = Number(fj?.price);
        if (!abort && price && isFinite(price) && price > 0) {
          setBinancePriceUsd(price);
          return;
        }

        if (!abort) setBinanceError("Binance price unavailable");
      } catch (e) {
        if (!abort) setBinanceError("Binance price unavailable");
      } finally {
        if (!abort) setLoadingBinance(false);
      }
    };
    loadBinanceP2P();
    return () => {
      abort = true;
    };
  }, [selectedToken, refreshTick]);

  const binanceRatePkr = useMemo(() => {
    if (!binancePriceUsd || !pkrPerUsd) return null;
    const val = binancePriceUsd * pkrPerUsd;
    return isFinite(val) && val > 0 ? val : null;
  }, [binancePriceUsd, pkrPerUsd]);

  // Hidden fees
  const FLAT_FEE_PKR = 2.5; // flat fee for buy/sell in PKR
  const FIXERCOIN_FEE_PCT = 0.05; // 5% for Fixercoin

  // Buy: PKR -> token units (apply hidden fees: flat PKR and optional Fixercoin %)
  const buyReceiveAmount = useMemo(() => {
    const amt = parseFloat(pkrAmount || "0");
    if (!pkrPerUsd || !isFinite(amt) || !tokenPriceUsd) return "0";
    // Apply flat fee
    let effectivePkr = Math.max(0, amt - FLAT_FEE_PKR);
    // If buying Fixercoin, charge 5% of the PKR amount
    if (selectedToken === "FIXERCOIN") {
      effectivePkr = Math.max(0, effectivePkr - amt * FIXERCOIN_FEE_PCT);
    }
    const usd = effectivePkr / pkrPerUsd;
    const units = usd / tokenPriceUsd;
    return units > 0 ? units.toFixed(4) : "0";
  }, [pkrAmount, pkrPerUsd, tokenPriceUsd, selectedToken]);

  // Sell: token units -> PKR (apply hidden fees)
  const sellReceivePkr = useMemo(() => {
    const units = parseFloat(tokenAmount || "0");
    if (!pkrPerUsd || !isFinite(units) || !tokenPriceUsd) return "0";
    const usd = units * tokenPriceUsd;
    let pkr = usd * pkrPerUsd;
    // Apply flat fee
    pkr = Math.max(0, pkr - FLAT_FEE_PKR);
    // If selling Fixercoin, charge 5% of the PKR amount
    if (selectedToken === "FIXERCOIN") {
      pkr = Math.max(0, pkr - pkr * FIXERCOIN_FEE_PCT);
    }
    return pkr > 0 ? pkr.toFixed(2) : "0";
  }, [tokenAmount, pkrPerUsd, tokenPriceUsd, selectedToken]);

  const handleConnect = async () => {
    setConnectMsg("Detecting wallet … connecting to wallet");
    setConnecting(true);
    try {
      const provider = ensureFixoriumProvider();
      if (!provider) throw new Error("Provider not available in this context");
      await provider.connect();
      setConnectMsg("Wallet connected");
      setTimeout(() => setConnectMsg(null), 1500);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Unable to connect to Fixorium wallet";
      setConnectMsg(msg);
    } finally {
      setConnecting(false);
    }
  };

  // User payment details (added via + button)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [walletAddressInput, setWalletAddressInput] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("expressp2pPaymentDetails");
      if (raw) {
        const parsed = JSON.parse(raw);
        setAccountName(String(parsed?.accountName || ""));
        setAccountNumber(String(parsed?.accountNumber || ""));
        setWalletAddressInput(String(parsed?.walletAddress || ""));
      }
    } catch {}
  }, []);

  const saveDetails = () => {
    const payload = {
      accountName,
      accountNumber,
      walletAddress: walletAddressInput,
    };
    localStorage.setItem("expressp2pPaymentDetails", JSON.stringify(payload));
    setDetailsOpen(false);
  };

  const detectedMethod: PaymentMethodId = detectPaymentMethod(accountNumber);

  const handlePrimary = () => {
    const paymentMethodId: PaymentMethodId = detectedMethod || "bank";
    const makeSnapshot = (params: Record<string, any>) => {
      const snapshot: PendingOrderSnapshot = {
        tradeId: `express-${Date.now()}`,
        minimized: false,
        status: "pending",
        params,
        ts: Date.now(),
      };
      persistPendingOrder(snapshot);
      toast({
        title: "Pending order created",
        description:
          params.side === "sell"
            ? "Share the summary with the buyer before proceeding."
            : "Review the pending order before continuing to trade.",
      });
    };

    if (buyActive) {
      const amountPkr = parseFloat(pkrAmount || "0");
      if (!amountPkr || !pkrPerUsd || amountPkr <= 0) return;
      const units = parseFloat(buyReceiveAmount || "0");
      makeSnapshot({
        side: "buy",
        pkrAmount: amountPkr,
        token: selectedToken,
        tokenUnits: units,
        paymentMethod: paymentMethodId,
        accountName: accountName || undefined,
        accountNumber: accountNumber || undefined,
        walletAddress: walletAddressInput || undefined,
      });
    } else {
      const units = parseFloat(tokenAmount || "0");
      const pkr = parseFloat(sellReceivePkr || "0");
      if (!units || !pkrPerUsd || units <= 0) return;
      makeSnapshot({
        side: "sell",
        pkrAmount: pkr,
        token: selectedToken,
        tokenUnits: units,
        paymentMethod: paymentMethodId,
        accountName: accountName || undefined,
        accountNumber: accountNumber || undefined,
        walletAddress: walletAddressInput || undefined,
      });
    }
  };

  const buyActive = tab === "buy";

  // Admin-only: notify on new orders
  const isAdmin = !!(wallet && wallet.publicKey === ADMIN_WALLET);
  const recentSinceRef = useRef<number>(Date.now());
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const poll = async () => {
      try {
        const since = recentSinceRef.current || 0;
        const resp = await fetch(
          `/api/p2p/trades/recent?since=${encodeURIComponent(String(since))}&limit=100`,
        );
        if (!resp.ok) return;
        const data = await resp.json();
        const arr = Array.isArray(data?.messages) ? data.messages : [];
        let maxTs = since;
        for (const m of arr) {
          if (!active) break;
          if (m && typeof m.id === "string") {
            if (seenMsgIdsRef.current.has(m.id)) {
              maxTs = Math.max(maxTs, Number(m.ts || 0));
              continue;
            }
            seenMsgIdsRef.current.add(m.id);
          }
          const txt = String(m?.message || "");
          if (txt.startsWith("__ORDER_STARTED__")) {
            const details = txt.split("|")[1] || "";
            const parts = Object.fromEntries(
              details
                .split(";")
                .map((kv) => kv.split("=").map((s) => s.trim()))
                .filter((p) => p.length === 2),
            ) as any;
            const side = String(parts.side || "").toLowerCase();
            const token = String(parts.token || "");
            const pkr = Number(parts.pkr || 0);
            const units = Number(parts.units || 0);
            const method = String(parts.method || "");
            const nextSide = side === "buy" ? "sell" : "buy";
            navigate("/express/start-trade", {
              state: {
                side: nextSide,
                token,
                pkrAmount: pkr,
                tokenUnits: units,
                paymentMethod: method,
              },
            });
          }
          maxTs = Math.max(maxTs, Number(m.ts || 0));
        }
        if (maxTs > since) recentSinceRef.current = maxTs;
      } catch {}
    };
    const id = setInterval(poll, 2000);
    poll();
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isAdmin, toast]);

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2"></div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={triggerRefresh}
              className="h-9 w-9 rounded-md border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--foreground))] hover:bg-white"
              aria-label="Refresh"
              title="Refresh"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            {/* Add details (+) button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setDetailsOpen(true)}
              className="h-9 w-9 rounded-md border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--foreground))] hover:bg-white"
              aria-label="Add payment details"
              title="Add payment details"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {wallet ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyAddress}
                  className="h-9 gap-2 rounded-md border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--foreground))] hover:bg-white"
                >
                  <span className="font-mono text-xs">
                    {shortenAddress(wallet.publicKey, 6)}
                  </span>
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="h-9 rounded-md bg-wallet-purple-500 px-4 py-2 text-white hover:bg-wallet-purple-600"
              >
                {connecting ? "CONNECTING…" : "CONNECT WALLET"}
              </Button>
            )}
            {wallet && wallet.publicKey === ADMIN_WALLET ? (
              <Button
                onClick={() => navigate("/express/add-post")}
                className="h-9 rounded-md bg-wallet-purple-500 px-4 py-2 text-white hover:bg-wallet-purple-600"
              >
                ADD POST
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          {pendingOrder?.minimized && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs">
              <div className="font-medium">Pending Order</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={resumePendingOrder}
                >
                  Continue
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={expandPendingOrder}
                >
                  Show details
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={clearPendingOrder}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {connectMsg && (
            <div className="mb-3 rounded-md border border-[hsl(var(--border))] bg-white/60 px-3 py-2 text-xs text-muted-foreground">
              {connectMsg}
            </div>
          )}

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-wallet-purple-50 p-3">
            {!pendingOrder?.minimized && pendingOrder && (
              <div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-white/90 p-4 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold uppercase">
                      Pending{" "}
                      {pendingOrder.params?.side === "sell" ? "Sell" : "Buy"}{" "}
                      Order
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pendingOrder.params?.side === "sell"
                        ? "Share payment instructions with the buyer before you continue."
                        : "Review the summary and continue when both sides are ready."}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono break-all">
                    {pendingOrder.tradeId}
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Token</span>
                    <span>{pendingOrder.params?.token ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PKR Value</span>
                    <span>
                      {typeof pendingOrder.params?.pkrAmount === "number"
                        ? pendingOrder.params.pkrAmount.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Token Units</span>
                    <span>
                      {typeof pendingOrder.params?.tokenUnits === "number"
                        ? pendingOrder.params.tokenUnits.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4,
                            },
                          )
                        : "—"}
                    </span>
                  </div>
                  {pendingOrder.params?.paymentMethod && (
                    <div className="flex justify-between">
                      <span>Payment Method</span>
                      <span className="uppercase">
                        {String(pendingOrder.params.paymentMethod)}
                      </span>
                    </div>
                  )}
                  {(pendingOrder.params?.accountName ||
                    pendingOrder.params?.accountNumber) && (
                    <div className="rounded-md bg-wallet-purple-50 px-3 py-2 text-xs text-muted-foreground">
                      {pendingOrder.params?.accountName && (
                        <div>
                          <span className="font-medium">Account:</span>{" "}
                          {pendingOrder.params.accountName}
                        </div>
                      )}
                      {pendingOrder.params?.accountNumber && (
                        <div>
                          <span className="font-medium">Number:</span>{" "}
                          {pendingOrder.params.accountNumber}
                        </div>
                      )}
                      {pendingOrder.params?.walletAddress && (
                        <div className="font-mono">
                          <span className="font-medium">Wallet:</span>{" "}
                          {pendingOrder.params.walletAddress}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={resumePendingOrder}
                    className="h-9 rounded-md bg-wallet-purple-500 px-4 py-2 text-white hover:bg-wallet-purple-600"
                  >
                    Continue to Review
                  </Button>
                  <Button
                    variant="outline"
                    onClick={minimizePendingOrder}
                    className="h-9"
                  >
                    Hide for later
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={clearPendingOrder}
                    className="h-9"
                  >
                    Cancel order
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (onBack) onBack();
                    else navigate("/");
                  }}
                  aria-label="Back"
                  className="h-8 w-8 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold uppercase">
                  EXPRESS P2P SERVICE
                </div>
                {lastRefreshed && (
                  <div className="ml-3 text-[10px] text-muted-foreground">
                    Refreshed {new Date(lastRefreshed).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-xl bg-wallet-purple-100">
              <button
                className={`py-2 text-center text-sm font-semibold ${
                  buyActive
                    ? "bg-background text-foreground"
                    : "bg-transparent text-muted-foreground"
                }`}
                onClick={() => setTab("buy")}
              >
                Buy
              </button>
              <button
                className={`py-2 text-center text-sm font-semibold ${
                  !buyActive
                    ? "bg-background text-foreground"
                    : "bg-transparent text-muted-foreground"
                }`}
                onClick={() => setTab("sell")}
              >
                Sell
              </button>
            </div>

            <div className="space-y-3">
              {buyActive ? (
                <>
                  <div>
                    <SectionLabel>Spend</SectionLabel>
                    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                      <CurrencyBadge label="PKR" />
                      <input
                        value={pkrAmount}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^\d*\.?\d*$/.test(v)) setPkrAmount(v);
                        }}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Receive</SectionLabel>
                    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                      <CurrencyBadge label={selectedToken} />
                      <input
                        value={buyReceiveAmount}
                        readOnly
                        className="w-full bg-transparent text-sm outline-none"
                      />
                      <div className="relative" ref={tokenMenuRef}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-white"
                          aria-haspopup="listbox"
                          aria-expanded={tokenMenuOpen}
                          onClick={() => setTokenMenuOpen((o) => !o)}
                        >
                          {selectedToken}
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {tokenMenuOpen && (
                          <div
                            role="listbox"
                            className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md border bg-white text-sm shadow-md"
                          >
                            {(["USDC", "SOL", "FIXERCOIN"] as const).map(
                              (tok) => (
                                <button
                                  key={tok}
                                  role="option"
                                  className={`block w-full px-3 py-2 text-left hover:bg-gray-50 ${
                                    tok === selectedToken ? "font-semibold" : ""
                                  }`}
                                  onClick={() => {
                                    setSelectedToken(tok);
                                    setTokenMenuOpen(false);
                                  }}
                                >
                                  {tok}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {tokenPriceError && (
                      <div className="mt-1 text-[10px] text-destructive">
                        {tokenPriceError}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <SectionLabel>Spend</SectionLabel>
                    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                      <CurrencyBadge label={selectedToken} />
                      <input
                        value={tokenAmount}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^\d*\.?\d*$/.test(v)) setTokenAmount(v);
                        }}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                      <div className="relative" ref={tokenMenuRef}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-white"
                          aria-haspopup="listbox"
                          aria-expanded={tokenMenuOpen}
                          onClick={() => setTokenMenuOpen((o) => !o)}
                        >
                          {selectedToken}
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {tokenMenuOpen && (
                          <div
                            role="listbox"
                            className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md border bg-white text-sm shadow-md"
                          >
                            {(["USDC", "SOL", "FIXERCOIN"] as const).map(
                              (tok) => (
                                <button
                                  key={tok}
                                  role="option"
                                  className={`block w-full px-3 py-2 text-left hover:bg-gray-50 ${
                                    tok === selectedToken ? "font-semibold" : ""
                                  }`}
                                  onClick={() => {
                                    setSelectedToken(tok);
                                    setTokenMenuOpen(false);
                                  }}
                                >
                                  {tok}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Receive</SectionLabel>
                    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                      <CurrencyBadge label="PKR" />
                      <input
                        value={sellReceivePkr}
                        readOnly
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                <span>
                  1 {selectedToken} ≈{" "}
                  {loadingRate || loadingTokenPrice
                    ? "—"
                    : pkrPerUsd && tokenPriceUsd
                      ? (pkrPerUsd * tokenPriceUsd).toFixed(2)
                      : "—"}{" "}
                  PKR
                </span>
                {rateError && <span className="ml-1">({rateError})</span>}
              </div>

              <div>
                {buyActive ? (
                  <>
                    <SectionLabel>Payment Details</SectionLabel>
                    {accountName || accountNumber || walletAddressInput ? (
                      <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {accountName || "Unnamed"}
                          </div>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs">
                            {detectedMethod.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Account: {accountNumber || "—"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground break-all">
                          Wallet: {walletAddressInput || "—"}
                        </div>
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setDetailsOpen(true)}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 p-3 text-xs text-muted-foreground">
                        No payment details added. Use the + button at the top to
                        add your name and account number.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <SectionLabel>Sell Instructions</SectionLabel>
                    <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 text-xs text-muted-foreground">
                      After matching with a counterparty, you'll receive payment
                      instructions. No wallet address is required on this page.
                    </div>
                  </>
                )}
              </div>

              <Button
                onClick={handlePrimary}
                disabled={
                  buyActive
                    ? !pkrAmount || !pkrPerUsd || parseFloat(pkrAmount) <= 0
                    : !tokenAmount || !pkrPerUsd || parseFloat(tokenAmount) <= 0
                }
                className="h-10 w-full rounded-md bg-wallet-purple-500 text-white hover:bg-wallet-purple-600"
              >
                {buyActive ? "Buy With PKR" : "Review Sell"}
              </Button>

              <div className="mt-1 text-center text-xs text-muted-foreground">
                SEND{" "}
                <a
                  href="mailto:info@fixorium.com.pk"
                  className="text-[hsl(var(--primary))] underline"
                >
                  APPEAL
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Payment Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Payment details</DialogTitle>
              <DialogDescription>
                Add your name and account number. Method will be auto-detected.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs">Account name</div>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <div className="mb-1 text-xs">Account number</div>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="03XXXXXXXXX or IBAN"
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <div className="mb-1 text-xs">Wallet address (optional)</div>
                <input
                  value={walletAddressInput}
                  onChange={(e) => setWalletAddressInput(e.target.value)}
                  placeholder="Your Solana wallet address"
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm outline-none font-mono"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Detected method:{" "}
                <span className="font-medium">
                  {detectedMethod.toUpperCase()}
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveDetails}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default ExpressP2P;
