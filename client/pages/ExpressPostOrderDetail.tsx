import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Pencil,
  Save,
  ToggleLeft,
  ToggleRight,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { ADMIN_WALLET } from "@/lib/p2p";

type P2PPost = {
  id: string;
  type: "buy" | "sell";
  token: "USDC" | "SOL" | "FIXERCOIN" | string;
  pricePkr: number;
  pricePerUSDC?: number | null;
  pricePerSOL?: number | null;
  minToken: number;
  maxToken: number;
  paymentMethod: "bank" | "easypaisa" | "firstpay" | string;
  walletAddress?: string;
  availability: "online" | "offline";
  paymentDetails?: { accountName: string; accountNumber: string };
  createdAt: number;
  updatedAt: number;
};

export default function ExpressPostOrderDetail() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [posts, setPosts] = useState<P2PPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<P2PPost>>({});

  const isAdmin = useMemo(
    () => Boolean(wallet && wallet.publicKey === ADMIN_WALLET),
    [wallet],
  );

  const load = async () => {
    try {
      setLoading(true);
      const resp = await fetch("/api/p2p/list");
      if (!resp.ok) throw new Error("Failed to load posts");
      const data = await resp.json();
      setPosts(data.posts || []);
    } catch (e: any) {
      toast({ title: e?.message || "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const beginEdit = (p: P2PPost) => {
    setEditingId(p.id);
    setDraft({
      id: p.id,
      type: p.type,
      token: p.token,
      pricePkr: p.pricePkr,
      pricePerUSDC: p.pricePerUSDC ?? undefined,
      pricePerSOL: p.pricePerSOL ?? undefined,
      minToken: p.minToken,
      maxToken: p.maxToken,
      paymentMethod: p.paymentMethod,
      walletAddress: p.walletAddress,
      availability: p.availability,
      paymentDetails: p.paymentDetails ? { ...p.paymentDetails } : undefined,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!isAdmin) {
      toast({ title: "Only admin can save", variant: "destructive" });
      return;
    }
    try {
      const resp = await fetch(`/api/p2p/post`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": wallet?.publicKey || "",
        },
        body: JSON.stringify(draft),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({
          title: `Save failed: ${err.error || resp.statusText}`,
          variant: "destructive",
        });
        return;
      }
      const data = await resp.json();
      setPosts((prev) =>
        prev.map((p) => (p.id === data.post.id ? data.post : p)),
      );
      setEditingId(null);
      setDraft({});
      toast({ title: "Saved" });
    } catch (e) {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const setAvailability = async (
    p: P2PPost,
    availability: "online" | "offline",
  ) => {
    if (!isAdmin) {
      toast({ title: "Only admin can change status", variant: "destructive" });
      return;
    }
    try {
      const resp = await fetch(`/api/p2p/post`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": wallet?.publicKey || "",
        },
        body: JSON.stringify({ id: p.id, availability }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({
          title: `Update failed: ${err.error || resp.statusText}`,
          variant: "destructive",
        });
        return;
      }
      const data = await resp.json();
      setPosts((prev) => prev.map((x) => (x.id === p.id ? data.post : x)));
      toast({ title: `Marked ${availability}` });
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const renderRow = (p: P2PPost) => {
    const isEditing = editingId === p.id;
    return (
      <div key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            {p.type.toUpperCase()} {p.token} • PKR {p.pricePkr}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium ${p.availability === "online" ? "text-green-600" : "text-gray-500"}`}
            >
              {p.availability.toUpperCase()}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setAvailability(
                  p,
                  p.availability === "online" ? "offline" : "online",
                )
              }
              className="h-8"
            >
              {p.availability === "online" ? (
                <span className="inline-flex items-center gap-1">
                  <ToggleLeft className="h-4 w-4" /> Offline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <ToggleRight className="h-4 w-4" /> Online
                </span>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/express/post", { state: { post: p } })}
              className="h-8"
            >
              <Pencil className="mr-1 h-4 w-4" /> Edit
            </Button>
            {isEditing ? (
              <Button
                size="sm"
                onClick={saveEdit}
                className="h-8 bg-wallet-purple-500 hover:bg-wallet-purple-600 text-white"
              >
                <Save className="mr-1 h-4 w-4" /> Save
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => beginEdit(p)}
                className="h-8"
              >
                Inline Edit
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-[11px] text-muted-foreground">Min</div>
            {isEditing ? (
              <input
                className="w-full rounded-md border px-2 py-1"
                value={(draft.minToken as any) ?? p.minToken}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    minToken: Number(e.target.value || 0),
                  }))
                }
              />
            ) : (
              <div className="font-medium">{p.minToken}</div>
            )}
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Max</div>
            {isEditing ? (
              <input
                className="w-full rounded-md border px-2 py-1"
                value={(draft.maxToken as any) ?? p.maxToken}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    maxToken: Number(e.target.value || 0),
                  }))
                }
              />
            ) : (
              <div className="font-medium">{p.maxToken}</div>
            )}
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Payment</div>
            {isEditing ? (
              <select
                className="w-full rounded-md border px-2 py-1"
                value={(draft.paymentMethod as any) ?? p.paymentMethod}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, paymentMethod: e.target.value }))
                }
              >
                <option value="bank">Bank Account</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="firstpay">FirstPay</option>
              </select>
            ) : (
              <div className="font-medium">{p.paymentMethod}</div>
            )}
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Price (PKR)</div>
            {isEditing ? (
              <input
                className="w-full rounded-md border px-2 py-1"
                value={(draft.pricePkr as any) ?? p.pricePkr}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    pricePkr: Number(e.target.value || 0),
                  }))
                }
              />
            ) : (
              <div className="font-medium">{p.pricePkr}</div>
            )}
          </div>
          {p.token === "FIXERCOIN" && (
            <>
              <div>
                <div className="text-[11px] text-muted-foreground">
                  Price/USDC
                </div>
                {isEditing ? (
                  <input
                    className="w-full rounded-md border px-2 py-1"
                    value={(draft.pricePerUSDC as any) ?? p.pricePerUSDC ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        pricePerUSDC:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                ) : (
                  <div className="font-medium">{p.pricePerUSDC ?? "—"}</div>
                )}
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">
                  Price/SOL
                </div>
                {isEditing ? (
                  <input
                    className="w-full rounded-md border px-2 py-1"
                    value={(draft.pricePerSOL as any) ?? p.pricePerSOL ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        pricePerSOL:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                ) : (
                  <div className="font-medium">{p.pricePerSOL ?? "—"}</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
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
              className="h-8 w-8 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-semibold uppercase">Post Orders</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate("/express/add-post")}
              className="h-8"
            >
              <Plus className="mr-1 h-4 w-4" /> Add Post
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-6">
          <div className="mb-3 rounded-xl border bg-wallet-purple-50 p-3 text-xs text-muted-foreground">
            Manage all posts. Toggle online/offline, edit inline then save, or
            open detailed edit.
          </div>

          {loading ? (
            <div className="rounded-xl border bg-white p-6 text-center text-sm">
              Loading…
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-center text-sm">
              No posts yet.
            </div>
          ) : (
            <div className="space-y-3">{posts.map(renderRow)}</div>
          )}
        </div>
      </main>
    </div>
  );
}
