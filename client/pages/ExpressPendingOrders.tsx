import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OrderSummary = {
  tradeId: string;
  side: "buy" | "sell" | string;
  token: string;
  pkr: number;
  units: number;
  method?: string;
  lastTs: number;
  done: boolean;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}

function CurrencyBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-secondary/60 px-2 py-1 text-xs font-semibold text-foreground">
      {label}
    </span>
  );
}

export default function ExpressPendingOrders() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshTick((x) => x + 1);
    setLastRefreshed(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch(`/api/p2p/trades/recent?since=0&limit=500`);
        if (!resp.ok) throw new Error("failed");
        const data = await resp.json().catch(() => null as any);
        const msgs = Array.isArray(data?.messages) ? data.messages : [];
        const groups = new Map<string, any[]>();
        for (const m of msgs) {
          const tid = String(m?.tradeId || "");
          if (!tid) continue;
          if (!groups.has(tid)) groups.set(tid, []);
          groups.get(tid)!.push(m);
        }
        const next: OrderSummary[] = [];
        groups.forEach((arr, tid) => {
          arr.sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
          const started = arr.find((m) =>
            String(m?.message || "").startsWith("__ORDER_STARTED__|"),
          );
          const approved = arr.find(
            (m) => String(m?.message) === "__BUYER_APPROVED__",
          );
          const sellerApproved = arr.find(
            (m) => String(m?.message) === "__SELLER_APPROVED__",
          );
          const cancelledMsg = arr.find(
            (m) => String(m?.message) === "__ORDER_CANCELLED__",
          );
          if (!started || approved || sellerApproved || cancelledMsg) return; // only pending
          const part = String(started.message).split("|")[1] || "";
          const parts = Object.fromEntries(
            part
              .split(";")
              .map((s) => s.split("=").map((x) => x.trim()))
              .filter((p) => p.length === 2),
          ) as any;
          const side = String(parts.side || "");
          const token = String(parts.token || "");
          const pkr = Number(parts.pkr || 0);
          const units = Number(parts.units || 0);
          const method = String(parts.method || "");
          const lastTs = Math.max(...arr.map((m: any) => Number(m.ts || 0)), 0);
          next.push({
            tradeId: tid,
            side,
            token,
            pkr,
            units,
            method,
            lastTs,
            done: false,
          });
        });
        next.sort((a, b) => b.lastTs - a.lastTs);
        if (!cancelled) setOrders(next);
      } catch (e) {
        if (!cancelled) setError("Failed to load pending orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const cancelAs = useCallback(
    async (tradeId: string, role: "buyer" | "seller") => {
      try {
        const resp = await fetch(
          `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "__ORDER_CANCELLED__",
              from: role,
            }),
          },
        );
        if (!resp.ok) throw new Error("cancel_failed");
        toast({
          title: "Order cancelled",
          description: `Cancelled as ${role}`,
        });
        triggerRefresh();
      } catch (e) {
        toast({
          title: "Cancel failed",
          description: "Unable to cancel order. Try again.",
          variant: "destructive",
        });
      }
    },
    [toast, triggerRefresh],
  );

  const approveAs = useCallback(
    async (tradeId: string, role: "buyer" | "seller") => {
      try {
        const message = role === "buyer" ? "__BUYER_APPROVED__" : "__SELLER_APPROVED__";
        const resp = await fetch(
          `/api/p2p/trade/${encodeURIComponent(tradeId)}/message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, from: role }),
          },
        );
        if (!resp.ok) throw new Error("approve_failed");
        toast({ title: `Approved as ${role}` });
        triggerRefresh();
      } catch (e) {
        toast({ title: "Approve failed", variant: "destructive" });
      }
    },
    [toast, triggerRefresh],
  );

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/express")}
              aria-label="Back"
              className="h-8 w-8 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold uppercase">
              Pending Orders
            </div>
            {lastRefreshed && (
              <div className="ml-3 text-[10px] text-muted-foreground">
                Refreshed {new Date(lastRefreshed).toLocaleTimeString()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={triggerRefresh}
              className="h-8 w-8 rounded-md border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--foreground))] hover:bg-white"
              aria-label="Refresh"
              title="Refresh"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-white/90 p-3">
            <SectionLabel>
              All open orders started but not yet approved or cancelled
            </SectionLabel>
            {error && (
              <div className="mt-2 text-xs text-destructive">{error}</div>
            )}
            <div className="mt-2 space-y-2 max-h-[70vh] overflow-auto custom-scrollbar">
              {orders.length === 0 && !loading ? (
                <div className="text-xs text-muted-foreground">
                  No pending orders.
                </div>
              ) : null}
              {orders.map((o) => (
                <div
                  key={o.tradeId}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {(o.side?.toUpperCase?.() || "ORDER") +
                        " " +
                        (o.token || "")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      PKR{" "}
                      {o.pkr.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      • Units{" "}
                      {o.units.toLocaleString(undefined, {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      })}{" "}
                      • {o.method?.toUpperCase?.() || "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono break-all">
                      {o.tradeId}
                    </div>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() =>
                        navigate("/express/start-trade", {
                          state: {
                            side: o.side as any,
                            token: o.token,
                            pkrAmount: o.pkr,
                            tokenUnits: o.units,
                            paymentMethod: o.method,
                            tradeId: o.tradeId,
                            role: "seller",
                          },
                        })
                      }
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      className="h-8"
                      variant="outline"
                      onClick={() => approveAs(o.tradeId, "buyer")}
                      title="Approve as buyer"
                    >
                      Approve Buyer
                    </Button>
                    <Button
                      size="sm"
                      className="h-8"
                      variant="secondary"
                      onClick={() => approveAs(o.tradeId, "seller")}
                      title="Approve as seller"
                    >
                      Approve Seller
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => cancelAs(o.tradeId, "buyer")}
                      title="Cancel as buyer"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Buyer
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      onClick={() => cancelAs(o.tradeId, "seller")}
                      title="Cancel as seller"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Seller
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
