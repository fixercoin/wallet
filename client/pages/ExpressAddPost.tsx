// This file was created by Builder.io and handles creating a new P2P offer (buy/sell).
// Cleaned and merged manually after conflict with main branch.

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useExpressP2P } from "@/contexts/ExpressP2PContext";

export default function ExpressAddPost() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();
  const { exchangeRate, setExchangeRate } = useExpressP2P();
  const [newRate, setNewRate] = useState<string>("");
  useEffect(() => setNewRate(String(exchangeRate || "")), [exchangeRate]);

  // Order basic info
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

  // Seller details (optional)
  const [sellerAccountName, setSellerAccountName] = useState<string>("");
  const [sellerAccountNumber, setSellerAccountNumber] = useState<string>("");

  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  // Payment methods
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

  // Online/offline availability
  const [availability, setAvailability] = useState<"online" | "offline">(
    "online",
  );

  // Close menus when clicking outside
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

  // Fetch USD→PKR rate
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
    const id = setInterval(fetchRate, 60_000);
    return () => {
      abort = true;
      clearInterval(id);
    };
  }, []);

  // Fetch token USD price when token changes
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
            const resp = await fetch("/api/token/price?symbol=SOL");
            const json = await resp.json();
            if (json?.price && !abort) setTokenPriceUsd(json.price);
            return;
          } catch {}
          if (!abort) setTokenPriceUsd(100);
          return;
        }
        if (token === "FIXERCOIN") {
          try {
            const resp = await fetch("/api/token/price?symbol=FIXERCOIN");
            const json = await resp.json();
            if (json?.price && !abort) setTokenPriceUsd(json.price);
            else if (!abort) setTokenPriceUsd(0.000023);
          } catch {
            if (!abort) setTokenPriceUsd(0.000023);
          }
          return;
        }
      } finally {
        if (!abort) setLoadingTokenPrice(false);
      }
    };
    loadPrice();
    return () => {
      abort = true;
    };
  }, [token]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!wallet?.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet before posting an offer.",
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
          pricePkr,
          minToken,
          maxToken,
          paymentMethod: selectedPaymentMethod?.id ?? "bank",
          walletAddress: type === "buy" ? walletAddress : undefined,
          availability,
          paymentDetails:
            sellerAccountName || sellerAccountNumber
              ? {
                  accountName: sellerAccountName,
                  accountNumber: sellerAccountNumber,
                }
              : undefined,
        }),
      });

      if (!resp.ok) throw new Error("Failed to post offer");
      toast({
        title: "Offer Posted",
        description: "Your offer has been successfully created.",
      });
      navigate("/express");
    } catch (err: any) {
      toast({
        title: "Error posting offer",
        description: err?.message || String(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/express")}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center font-medium">Create P2P Offer</div>
        </div>
      </div>

      <div className="w-full px-4 py-6 space-y-4">
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Offer Type
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-wallet-purple-100">
            <button
              className={`py-2 text-center text-sm font-semibold ${
                type === "buy"
                  ? "bg-background text-foreground"
                  : "bg-transparent text-muted-foreground"
              }`}
              onClick={() => setType("buy")}
              type="button"
            >
              Buy
            </button>
            <button
              className={`py-2 text-center text-sm font-semibold ${
                type === "sell"
                  ? "bg-background text-foreground"
                  : "bg-transparent text-muted-foreground"
              }`}
              onClick={() => setType("sell")}
              type="button"
            >
              Sell
            </button>
          </div>
        </div>

        {/* Token selection */}
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Token
          </div>
          <div
            ref={tokenMenuRef}
            className="relative rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 cursor-pointer"
            onClick={() => setTokenMenuOpen((o) => !o)}
          >
            <div className="text-sm">{token}</div>
            {tokenMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-full rounded-xl bg-white shadow border z-10">
                {["USDC", "SOL", "FIXERCOIN"].map((opt) => (
                  <div
                    key={opt}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setToken(opt as any);
                      setTokenMenuOpen(false);
                    }}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Adjust global rate */}
        <div className="p-3 rounded-xl border border-[hsl(var(--input))] bg-white">
          <div className="text-xs text-muted-foreground mb-2 font-medium">
            Adjusted Exchange Rate
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">1 USDC =</span>
            <input
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              className="flex-1 border border-[hsl(var(--border))] rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            />
            <span className="text-xs text-muted-foreground">PKR</span>
            <Button
              variant="default"
              className="h-8"
              onClick={() => {
                const val = Number(newRate);
                if (!isFinite(val) || val <= 0) return;
                setExchangeRate(val);
                toast({
                  title: "Rate saved",
                  description: `1 USDC = ${val} PKR`,
                });
              }}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Price */}
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Price (PKR per token)
          </div>
          <input
            value={pricePkr}
            onChange={(e) => setPricePkr(e.target.value)}
            inputMode="decimal"
            placeholder="Enter price in PKR"
            className="w-full rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 text-sm outline-none"
          />
        </div>

        {/* Limits */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Min Tokens
            </div>
            <input
              value={minToken}
              onChange={(e) => setMinToken(e.target.value)}
              inputMode="decimal"
              placeholder="Minimum"
              className="w-full rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Max Tokens
            </div>
            <input
              value={maxToken}
              onChange={(e) => setMaxToken(e.target.value)}
              inputMode="decimal"
              placeholder="Maximum"
              className="w-full rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        {/* Payment method */}
        <div ref={paymentMenuRef}>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Payment Method
          </div>
          <div
            className="rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 cursor-pointer"
            onClick={() => setPaymentMenuOpen((o) => !o)}
          >
            <div className="text-sm">{selectedPaymentMethod.label}</div>
          </div>
          {paymentMenuOpen && (
            <div className="mt-1 bg-white border rounded-xl shadow w-full">
              {PAYMENT_METHODS.map((m) => (
                <div
                  key={m.id}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedPaymentMethod(m);
                    setPaymentMenuOpen(false);
                  }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Availability */}
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

        {/* Wallet address for BUY */}
        {type === "buy" && (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Wallet Address (to receive assets)
            </div>
            <input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Destination Solana address"
              className="w-full rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 text-sm outline-none"
            />
          </div>
        )}

        {/* Seller account details */}
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Seller Payment Details (optional)
          </div>
          <input
            value={sellerAccountName}
            onChange={(e) => setSellerAccountName(e.target.value)}
            placeholder="Account holder name"
            className="w-full rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 text-sm outline-none mb-2"
          />
          <input
            value={sellerAccountNumber}
            onChange={(e) => setSellerAccountNumber(e.target.value)}
            placeholder="Account number / IBAN / mobile wallet"
            className="w-full rounded-xl border border-[hsl(var(--input))] bg-wallet-purple-50 px-3 py-2 text-sm outline-none"
          />
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
  );
}
