import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import { jupiterAPI } from "@/lib/services/jupiter";
import { fixercoinPriceService } from "@/lib/services/fixercoin-price";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_WALLET } from "@/lib/p2p";

const W_SOL_MINT = "So11111111111111111111111111111111111111112";

const CurrencyBadge = ({ label }: { label: string }) => (
  <span className="inline-flex shrink-0 items-center rounded-md bg-secondary/60 px-2 py-1 text-xs font-semibold text-foreground">
    {label}
  </span>
);

export default function ExpressAddPost() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();

  const [type, setType] = useState<"buy" | "sell">("buy");
  const [token, setToken] = useState<"USDC" | "SOL" | "FIXERCOIN">("USDC");
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const tokenMenuRef = useRef<HTMLDivElement | null>(null);

  const [pricePkr, setPricePkr] = useState<string>(""); // PKR per token
  const [pkrPerUsd, setPkrPerUsd] = useState<number | null>(null);
  const [tokenPriceUsd, setTokenPriceUsd] = useState<number>(1);
  const [loadingRate, setLoadingRate] = useState(false);
  const [loadingTokenPrice, setLoadingTokenPrice] = useState(false);
  const lastAutoPriceRef = useRef<number | null>(null);
  const [minToken, setMinToken] = useState<string>("");
  const [maxToken, setMaxToken] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  // Optional seller payment details for listing
  const [sellerAccountName, setSellerAccountName] = useState<string>("");
  const [sellerAccountNumber, setSellerAccountNumber] = useState<string>("");
  // Optional Fixercoin specific pricing
  const [pricePerUSDC, setPricePerUSDC] = useState<string>("");
  const [pricePerSOL, setPricePerSOL] = useState<string>("");

  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  // Payment methods for ExpressAddPost
  type PaymentMethodOption = {
    id: "bank" | "easypaisa" | "firstpay";
    label: string;
    description?: string;
  };

  const PAYMENT_METHODS: PaymentMethodOption[] = [
    {
      id: "bank",
      label: "Bank Account",
      description: "Settle using a standard bank account transfer.",
    },
    {
      id: "easypaisa",
      label: "Easypaisa",
      description: "Use Easypaisa for instant transfers.",
    },
    {
      id: "firstpay",
      label: "FirstPay",
      description: "Accept payments via FirstPay business banking.",
    },
  ];

  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const paymentMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodOption>(PAYMENT_METHODS[0]);

  // Availability (Online/Offline)
  const [availability, setAvailability] = useState<"online" | "offline">(
    "online",
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        tokenMenuRef.current &&
        !tokenMenuRef.current.contains(e.target as Node)
      ) {
        setTokenMenuOpen(false);
      }
      if (
        paymentMenuRef.current &&
        !paymentMenuRef.current.contains(e.target as Node)
      ) {
        setPaymentMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Fetch USD -> PKR rate periodically
  useEffect(() => {
    let abort = false;
    const fetchRate = async () => {
      try {
        setLoadingRate(true);
        const resp = await fetch("/api/forex/rate?base=USD&symbols=PKR");
        if (!resp.ok) throw new Error("rate request failed");
        const json = await resp.json();
        const val = json?.rates?.PKR;
        if (val && isFinite(val) && val > 0 && !abort) setPkrPerUsd(val);
      } catch (e) {
        // ignore
      } finally {
        if (!abort) setLoadingRate(false);
      }
    };
    fetchRate();
    const id = setInterval(fetchRate, 60_000); // refresh every minute
    return () => {
      abort = true;
      clearInterval(id);
    };
  }, []);

  // Fetch token USD price when selected token changes
  useEffect(() => {
    let abort = false;
    const loadPrice = async () => {
      try {
        setLoadingTokenPrice(true);
        if (token === "USDC") {
          if (!abort) setTokenPriceUsd(1);
          return;
        }
        if (token === "SOL") {
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
        if (token === "FIXERCOIN") {
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
      } catch {
      } finally {
        if (!abort) setLoadingTokenPrice(false);
      }
    };
    loadPrice();
    return () => {
      abort = true;
    };
  }, [token]);

  // Auto-fill PKR price based on fetched rates unless user manually edited
  useEffect(() => {
    if (!pkrPerUsd || !tokenPriceUsd) return;
    const derived = tokenPriceUsd * pkrPerUsd;
    if (!isFinite(derived) || derived <= 0) return;
    const formatted = derived.toFixed(2);
    const currentVal = parseFloat(pricePkr || "");
    if (
      !pricePkr ||
      (lastAutoPriceRef.current !== null &&
        Number(currentVal) === lastAutoPriceRef.current)
    ) {
      setPricePkr(formatted);
      lastAutoPriceRef.current = Number(formatted);
    }
  }, [pkrPerUsd, tokenPriceUsd]);

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

  const handleSubmit = async () => {
    // Basic validation
    const price = parseFloat(pricePkr || "0");
    const min = parseFloat(minToken || "0");
    const max = parseFloat(maxToken || "0");
    if (!(price > 0)) {
      toast({ title: "Enter a valid price (PKR)", variant: "destructive" });
      return;
    }
    if (!(min > 0) || !(max > 0) || min > max) {
      toast({ title: "Check min/max amounts", variant: "destructive" });
      return;
    }
    if (!wallet || wallet.publicKey !== ADMIN_WALLET) {
      toast({
        title: "Only admin wallet can post offers",
        variant: "destructive",
      });
      return;
    }
    if (type === "buy" && (!walletAddress || walletAddress.length < 20)) {
      toast({
        title: "Enter a valid wallet address to receive assets",
        variant: "destructive",
      });
      return;
    }

    try {
      const resp = await fetch(`/api/p2p/post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": wallet.publicKey,
        },
        body: JSON.stringify({
          type,
          token,
          pricePkr: price,
          // include Fixercoin optional pricing if provided
          pricePerUSDC: token === "FIXERCOIN" && pricePerUSDC !== "" ? Number(pricePerUSDC) : undefined,
          pricePerSOL: token === "FIXERCOIN" && pricePerSOL !== "" ? Number(pricePerSOL) : undefined,
          minToken: min,
          maxToken: max,
          paymentMethod: selectedPaymentMethod?.id ?? "bank",
          walletAddress: type === "buy" ? walletAddress : undefined,
          availability,
          paymentDetails:
            sellerAccountName || sellerAccountNumber
              ? { accountName: sellerAccountName, accountNumber: sellerAccountNumber }
              : undefined,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({
          title: `Failed to post: ${err.error || resp.statusText}`,
          variant: "destructive",
        });
        return;
      }
      const json = await resp.json();
      const createdPost = json.post;
      toast({
        title: "Offer posted",
        description: `${type.toUpperCase()} ${token} @ PKR ${price}`,
      });
      navigate("/express/post", { state: { post: createdPost } });
    } catch (e) {
      toast({ title: "Failed to post offer", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => navigate("/express/post-order-detail")}
            >
              History
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="h-9 rounded-md bg-wallet-purple-500 px-4 py-2 text-white hover:bg-wallet-purple-600"
            >
              {wallet ? "CONNECTED" : "CONNECT WALLET"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          <div className="mb-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/express")}
              aria-label="Back"
              className="h-8 w-8 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold uppercase">Add Post</div>
          </div>
          {connectMsg && (
            <div className="mb-3 rounded-md border border-[hsl(var(--border))] bg-white/60 px-3 py-2 text-xs text-muted-foreground">
              {connectMsg}
            </div>
          )}

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-wallet-purple-50 p-3">
            <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-xl bg-wallet-purple-100">
              <button
                className={`py-2 text-center text-sm font-semibold ${
                  type === "buy"
                    ? "bg-background text-foreground"
                    : "bg-transparent text-muted-foreground"
                }`}
                onClick={() => setType("buy")}
              >
                Buy Offer
              </button>
              <button
                className={`py-2 text-center text-sm font-semibold ${
                  type === "sell"
                    ? "bg-background text-foreground"
                    : "bg-transparent text-muted-foreground"
                }`}
                onClick={() => setType("sell")}
              >
                Sell Offer
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Token
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                  <CurrencyBadge label={token} />
                  <div className="relative ml-auto" ref={tokenMenuRef}>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-white"
                      aria-haspopup="listbox"
                      aria-expanded={tokenMenuOpen}
                      onClick={() => setTokenMenuOpen((o) => !o)}
                    >
                      {token}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    {tokenMenuOpen && (
                      <div
                        role="listbox"
                        className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md border bg-white text-sm shadow-md"
                      >
                        {(["USDC", "SOL", "FIXERCOIN"] as const).map((tok) => (
                          <button
                            key={tok}
                            role="option"
                            className={`block w-full px-3 py-2 text-left hover:bg-gray-50 ${
                              tok === token ? "font-semibold" : ""
                            }`}
                            onClick={() => {
                              setToken(tok);
                              setTokenMenuOpen(false);
                            }}
                          >
                            {tok}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Price (PKR per {token})
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                  <CurrencyBadge label="PKR" />
                  <input
                    value={pricePkr}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^\d*\.?\d*$/.test(v)) setPricePkr(v);
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Min Amount ({token})
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                    <input
                      value={minToken}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^\d*\.?\d*$/.test(v)) setMinToken(v);
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Max Amount ({token})
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                    <input
                      value={maxToken}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^\d*\.?\d*$/.test(v)) setMaxToken(v);
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Payment Method
                </div>
                <div className="relative" ref={paymentMenuRef}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 text-left text-sm"
                    aria-haspopup="listbox"
                    aria-expanded={paymentMenuOpen}
                    onClick={() => setPaymentMenuOpen((o) => !o)}
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
                          {method.description && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {method.description}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Availability
                </div>
                <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-wallet-purple-100">
                  <button
                    className={`py-2 text-center text-sm font-semibold ${
                      availability === "online"
                        ? "bg-background text-foreground"
                        : "bg-transparent text-muted-foreground"
                    }`}
                    onClick={() => setAvailability("online")}
                    type="button"
                  >
                    Online
                  </button>
                  <button
                    className={`py-2 text-center text-sm font-semibold ${
                      availability === "offline"
                        ? "bg-background text-foreground"
                        : "bg-transparent text-muted-foreground"
                    }`}
                    onClick={() => setAvailability("offline")}
                    type="button"
                  >
                    Offline
                  </button>
                </div>
              </div>

              {token === "FIXERCOIN" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Price per USDC (Fixercoin)</div>
                    <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                      <input
                        value={pricePerUSDC}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^\d*\.?\d*$/.test(v)) setPricePerUSDC(v);
                        }}
                        inputMode="decimal"
                        placeholder="optional"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Price per SOL (Fixercoin)</div>
                    <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                      <input
                        value={pricePerSOL}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^\d*\.?\d*$/.test(v)) setPricePerSOL(v);
                        }}
                        inputMode="decimal"
                        placeholder="optional"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>
              )}

              {type === "buy" && (
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Wallet Address (to receive assets)
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                    <input
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="Destination Solana address"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Required for BUY offers so sellers can send tokens to you.
                  </p>
                </div>
              )}

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Seller Payment Details (optional)</div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                    <input
                      value={sellerAccountName}
                      onChange={(e) => setSellerAccountName(e.target.value)}
                      placeholder="Account holder name"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2">
                    <input
                      value={sellerAccountNumber}
                      onChange={(e) => setSellerAccountNumber(e.target.value)}
                      placeholder="Account number / IBAN / mobile wallet"
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Buyers will see these details after a match to send fiat payment.</p>
              </div>

              <Button
                onClick={handleSubmit}
                className="h-10 w-full rounded-md bg-wallet-purple-500 text-white hover:bg-wallet-purple-600"
              >
                Post Offer
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
      </main>
    </div>
  );
}
