import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";

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
  const [minToken, setMinToken] = useState<string>("");
  const [maxToken, setMaxToken] = useState<string>("");

  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!tokenMenuRef.current) return;
      if (!tokenMenuRef.current.contains(e.target as Node)) {
        setTokenMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

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

  const handleSubmit = () => {
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
    if (!wallet) {
      toast({ title: "Connect the authorized wallet to post offers." });
      return;
    }

    toast({
      title: "Offer posted (local)",
      description: `${type.toUpperCase()} ${token} @ PKR ${price} (min ${min}, max ${max})`,
    });
    navigate(-1);
  };

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="h-9 w-9 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="h-9 rounded-md bg-[hsl(330,81%,60%)] px-4 py-2 text-[hsl(210,40%,98%)] hover:bg-[hsl(330,81%,55%)]"
            >
              {wallet ? "CONNECTED" : "CONNECT WALLET"}
            </Button>
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
                <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2">
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
                <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2">
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
                  <div className="rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2">
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
                  <div className="rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2">
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
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-[hsl(var(--input))] bg-card px-3 py-2 text-left text-sm"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                >
                  <span>Bank Account</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <Button
                onClick={handleSubmit}
                className="h-10 w-full rounded-md bg-[hsl(330,81%,60%)] text-[hsl(210,40%,98%)] hover:bg-[hsl(330,81%,55%)]"
              >
                Post Offer
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
}
