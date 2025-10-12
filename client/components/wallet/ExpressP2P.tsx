import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Copy, Info } from "lucide-react";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import { jupiterAPI } from "@/lib/services/jupiter";
import { fixercoinPriceService } from "@/lib/services/fixercoin-price";
import { shortenAddress, copyToClipboard } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_WALLET } from "@/lib/p2p";

interface ExpressP2PProps {
  onBack?: () => void;
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

type PaymentMethodOption = {
  id: "bank" | "easypaisa" | "firstpay";
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

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();

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

  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const paymentMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodOption>(PAYMENT_METHODS[0]);

  // DexScreener state (optional) — defined to avoid runtime ReferenceErrors
  const [dexToken, setDexToken] = useState<any | null>(null);
  const [loadingDexData, setLoadingDexData] = useState(false);
  const [dexError, setDexError] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

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
  }, []);

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

  // Close token menu on outside click
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
  }, []);

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
  }, [selectedToken]);

  // Buy: PKR -> token units
  const buyReceiveAmount = useMemo(() => {
    const amt = parseFloat(pkrAmount || "0");
    if (!pkrPerUsd || !isFinite(amt) || !tokenPriceUsd) return "0";
    const usd = amt / pkrPerUsd;
    const units = usd / tokenPriceUsd;
    return units > 0 ? units.toFixed(4) : "0";
  }, [pkrAmount, pkrPerUsd, tokenPriceUsd]);

  // Sell: token units -> PKR
  const sellReceivePkr = useMemo(() => {
    const units = parseFloat(tokenAmount || "0");
    if (!pkrPerUsd || !isFinite(units) || !tokenPriceUsd) return "0";
    const usd = units * tokenPriceUsd;
    const pkr = usd * pkrPerUsd;
    return pkr > 0 ? pkr.toFixed(2) : "0";
  }, [tokenAmount, pkrPerUsd, tokenPriceUsd]);

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

  const handlePrimary = () => {
    if (buyActive) {
      const amountPkr = parseFloat(pkrAmount || "0");
      if (!amountPkr || !pkrPerUsd || amountPkr <= 0) return;
      const units = parseFloat(buyReceiveAmount || "0");
      navigate("/express/start-trade", {
        state: {
          side: "buy",
          pkrAmount: amountPkr,
          token: selectedToken,
          tokenUnits: units,
          paymentMethod: selectedPaymentMethod.id,
        },
      });
    } else {
      const units = parseFloat(tokenAmount || "0");
      const pkr = parseFloat(sellReceivePkr || "0");
      if (!units || !pkrPerUsd || units <= 0) return;
      navigate("/express/start-trade", {
        state: {
          side: "sell",
          pkrAmount: pkr,
          token: selectedToken,
          tokenUnits: units,
          paymentMethod: selectedPaymentMethod.id,
        },
      });
    }
  };

  const buyActive = tab === "buy";

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (onBack) onBack();
                else navigate(-1);
              }}
              aria-label="Back to dashboard"
              className="h-9 w-9 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
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
                className="h-9 rounded-md bg-[hsl(330,81%,60%)] px-4 py-2 text-[hsl(210,40%,98%)] hover:bg-[hsl(330,81%,55%)]"
              >
                {connecting ? "CONNECTING…" : "CONNECT WALLET"}
              </Button>
            )}
            {wallet && wallet.publicKey === ADMIN_WALLET ? (
              <Button
                onClick={() => navigate("/express/add-post")}
                className="h-9 rounded-md bg-[hsl(330,81%,60%)] px-4 py-2 text-[hsl(210,40%,98%)] hover:bg-[hsl(330,81%,55%)]"
              >
                ADD POST
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          {connectMsg && (
            <div className="mb-3 rounded-md border border-[hsl(var(--border))] bg-white/60 px-3 py-2 text-xs text-muted-foreground">
              {connectMsg}
            </div>
          )}

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(330,100%,96%)] p-3">
            <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-xl bg-[hsl(330,40%,96%)]">
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
                    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2">
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
                    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2">
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
                    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2">
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
                    <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2">
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
                    <SectionLabel>Payment Methods</SectionLabel>
                    <div className="relative" ref={paymentMenuRef}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2 text-left text-sm"
                        aria-haspopup="listbox"
                        aria-expanded={paymentMenuOpen}
                        onClick={() => setPaymentMenuOpen((open) => !open)}
                      >
                        <span>{selectedPaymentMethod.label}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {paymentMenuOpen && (
                        <div
                          role="listbox"
                          className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-lg border bg-white text-sm shadow-xl"
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <button
                              key={method.id}
                              role="option"
                              className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-gray-50 ${method.id === selectedPaymentMethod.id ? "bg-gray-100 font-semibold" : ""}`}
                              onClick={() => {
                                setSelectedPaymentMethod(method);
                                setPaymentMenuOpen(false);
                              }}
                            >
                              <span>{method.label}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {method.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selectedPaymentMethod.description}
                    </p>
                  </>
                ) : (
                  <>
                    <SectionLabel>Sell Instructions</SectionLabel>
                    <div className="rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2 text-xs text-muted-foreground">
                      After matching with a counterparty, you'll receive payment instructions. No wallet address is required on this page.
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
                className="h-10 w-full rounded-md bg-[hsl(330,81%,60%)] text-[hsl(210,40%,98%)] hover:bg-[hsl(330,81%,55%)]"
              >
                {buyActive ? "Buy With PKR" : "Review Sell"}
              </Button>

              <div className="mt-1 text-center text-xs text-muted-foreground">
                Connect the authorized wallet to post offers.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExpressP2P;
