import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Info } from "lucide-react";
import { ensureFixoriumProvider } from "@/lib/fixorium-provider";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";

interface ExpressP2PProps {
  onBack?: () => void;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1 text-xs font-medium text-muted-foreground">{children}</div>
);

const CurrencyBadge = ({ label }: { label: string }) => (
  <span className="inline-flex shrink-0 items-center rounded-md bg-secondary/60 px-2 py-1 text-xs font-semibold text-foreground">
    {label}
  </span>
);

export const ExpressP2P: React.FC<ExpressP2PProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { wallet } = useWallet();

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [pkrAmount, setPkrAmount] = useState<string>("");
  const [pkrPerUsd, setPkrPerUsd] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  const handleBack = () => {
    if (onBack) onBack();
  };

  // Fetch PKR rate (1 USDC ~= 1 USD)
  useEffect(() => {
    let abort = false;
    const fetchRate = async () => {
      try {
        setLoadingRate(true);
        setRateError(null);
        // Use exchangerate.host (no key needed). Get PKR per 1 USD
        const resp = await fetch(
          "https://api.exchangerate.host/latest?base=USD&symbols=PKR",
        );
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

  const usdcAmount = useMemo(() => {
    const amt = parseFloat(pkrAmount || "0");
    if (!pkrPerUsd || !isFinite(amt)) return "0";
    const usdc = amt / pkrPerUsd;
    return usdc > 0 ? usdc.toFixed(2) : "0";
  }, [pkrAmount, pkrPerUsd]);

  const handleConnect = async () => {
    setConnectMsg("Detecting wallet … connecting to wallet");
    setConnecting(true);
    try {
      const provider = ensureFixoriumProvider();
      if (!provider) throw new Error("Provider not available in this context");
      // Will throw if there is no created/imported wallet in this app
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
    // This is where a real P2P flow would be initiated (e.g., creating an offer / intent)
    // For now, navigate to token listing as a placeholder next step relevant to this app.
    navigate("/fixorium/token-listing");
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
              onClick={handleBack}
              aria-label="Back to dashboard"
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
            <Button
              onClick={() => navigate("/fixorium/token-listing")}
              className="h-9 rounded-md bg-[hsl(330,81%,60%)] px-4 py-2 text-[hsl(210,40%,98%)] hover:bg-[hsl(330,81%,55%)]"
            >
              ADD POST
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
                  <CurrencyBadge label="USDC" />
                  <input
                    value={usdcAmount}
                    readOnly
                    className="w-full bg-transparent text-sm outline-none"
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-white"
                    aria-haspopup="listbox"
                    aria-expanded="false"
                  >
                    USDC
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                <span>
                  1 USDC ≈ {loadingRate ? "—" : pkrPerUsd ? pkrPerUsd.toFixed(2) : "—"} PKR
                </span>
                {rateError && <span className="ml-1">({rateError})</span>}
              </div>

              <div>
                <SectionLabel>Payment Methods</SectionLabel>
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
                onClick={handlePrimary}
                disabled={!pkrAmount || !pkrPerUsd || parseFloat(pkrAmount) <= 0}
                className="h-10 w-full rounded-md bg-[hsl(330,81%,60%)] text-[hsl(210,40%,98%)] hover:bg-[hsl(330,81%,55%)]"
              >
                {buyActive ? "Buy With PKR" : "Sell For PKR"}
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
