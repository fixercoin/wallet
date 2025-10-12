import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { ADMIN_WALLET } from "@/lib/p2p";

export default function ExpressPostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const initialPost = (location.state as any)?.post;
  const [post, setPost] = useState(() => initialPost ?? null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    type: post?.type ?? "buy",
    token: post?.token ?? "USDC",
    pricePkr: post?.pricePkr ?? "",
    pricePerUSDC: post?.pricePerUSDC ?? "",
    pricePerSOL: post?.pricePerSOL ?? "",
    minToken: post?.minToken ?? "",
    maxToken: post?.maxToken ?? "",
    paymentMethod: post?.paymentMethod ?? "bank",
    paymentDetails: {
      accountName: post?.paymentDetails?.accountName ?? "",
      accountNumber: post?.paymentDetails?.accountNumber ?? "",
    },
  }));

  if (!post) {
    return (
      <div className="flex min-h-screen w-screen flex-col bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
          <div className="container mx-auto flex h-14 items-center px-4"></div>
        </header>
        <main className="flex-1">
          <div className="container mx-auto max-w-md px-4 py-6">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  aria-label="Back"
                  className="h-8 w-8 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-semibold uppercase">
                  Post Not Found
                </div>
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] bg-slate-50 p-4 text-sm">
                No post data was provided. Go back and create a post.
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { wallet } = useWallet();

  const handleSave = async () => {
    // Basic validation
    const price = parseFloat(form.pricePkr || "0");
    const min = parseFloat(form.minToken || "0");
    const max = parseFloat(form.maxToken || "0");
    if (!(price > 0) || !(min > 0) || !(max > 0) || min > max) {
      toast({ title: "Invalid values", variant: "destructive" });
      return;
    }

    if (!wallet || wallet.publicKey !== ADMIN_WALLET) {
      toast({
        title: "Only admin wallet can save posts",
        variant: "destructive",
      });
      return;
    }

    try {
      const resp = await fetch(`/api/p2p/post`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Wallet": wallet.publicKey,
        },
        body: JSON.stringify({ id: post.id, ...form }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast({
          title: `Failed to save: ${err.error || resp.statusText}`,
          variant: "destructive",
        });
        return;
      }
      const data = await resp.json();
      setPost(data.post);
      setEditing(false);
      toast({ title: "Post saved" });
    } catch (e) {
      toast({ title: "Failed to save post", variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen w-screen flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Offer Details</div>
          </div>
          <div>
            <Button onClick={() => setEditing((e) => !e)} className="mr-2">
              {editing ? "Cancel" : "Edit"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!(wallet && wallet.publicKey === ADMIN_WALLET)}
              className="bg-[hsl(330,81%,60%)] text-white"
            >
              Save
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                aria-label="Back"
                className="h-8 w-8 rounded-full border border-[hsl(var(--border))] bg-white/90 text-[hsl(var(--primary))] shadow-sm hover:bg-[hsl(var(--primary))]/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold uppercase">
                Offer Details
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Type</div>
                {editing ? (
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                ) : (
                  <div className="font-semibold">
                    {post.type?.toUpperCase()}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Token</div>
                {editing ? (
                  <select
                    value={form.token}
                    onChange={(e) =>
                      setForm({ ...form, token: e.target.value })
                    }
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="USDC">USDC</option>
                    <option value="SOL">SOL</option>
                    <option value="FIXERCOIN">FIXERCOIN</option>
                  </select>
                ) : (
                  <div className="font-semibold">{post.token}</div>
                )}
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Price (PKR)</div>
                {editing ? (
                  <input
                    value={form.pricePkr}
                    onChange={(e) =>
                      setForm({ ...form, pricePkr: e.target.value })
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                ) : (
                  <div className="font-semibold">PKR {post.pricePkr}</div>
                )}
                {form.token === "FIXERCOIN" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground">
                        Price per USDC (Fixercoin)
                      </div>
                      {editing ? (
                        <input
                          value={form.pricePerUSDC as any}
                          onChange={(e) =>
                            setForm({ ...form, pricePerUSDC: e.target.value })
                          }
                          className="w-full rounded-md border px-3 py-2"
                        />
                      ) : (
                        <div className="text-sm">
                          {post.pricePerUSDC ?? "—"}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">
                        Price per SOL (Fixercoin)
                      </div>
                      {editing ? (
                        <input
                          value={form.pricePerSOL as any}
                          onChange={(e) =>
                            setForm({ ...form, pricePerSOL: e.target.value })
                          }
                          className="w-full rounded-md border px-3 py-2"
                        />
                      ) : (
                        <div className="text-sm">{post.pricePerSOL ?? "—"}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Min</div>
                  {editing ? (
                    <input
                      value={form.minToken}
                      onChange={(e) =>
                        setForm({ ...form, minToken: e.target.value })
                      }
                      className="w-full rounded-md border px-3 py-2"
                    />
                  ) : (
                    <div className="font-semibold">{post.minToken}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Max</div>
                  {editing ? (
                    <input
                      value={form.maxToken}
                      onChange={(e) =>
                        setForm({ ...form, maxToken: e.target.value })
                      }
                      className="w-full rounded-md border px-3 py-2"
                    />
                  ) : (
                    <div className="font-semibold">{post.maxToken}</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">
                  Payment Method
                </div>
                {editing ? (
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm({ ...form, paymentMethod: e.target.value })
                    }
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="easypaisa">Easypaisa</option>
                    <option value="firstpay">FirstPay</option>
                  </select>
                ) : (
                  <div className="font-semibold">{post.paymentMethod}</div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground">
                      Account Name
                    </div>
                    {editing ? (
                      <input
                        value={form.paymentDetails?.accountName as any}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            paymentDetails: {
                              ...(form.paymentDetails || {
                                accountName: "",
                                accountNumber: "",
                              }),
                              accountName: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-md border px-3 py-2"
                      />
                    ) : (
                      <div className="text-sm">
                        {post.paymentDetails?.accountName ?? "—"}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">
                      Account Number
                    </div>
                    {editing ? (
                      <input
                        value={form.paymentDetails?.accountNumber as any}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            paymentDetails: {
                              ...(form.paymentDetails || {
                                accountName: "",
                                accountNumber: "",
                              }),
                              accountNumber: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-md border px-3 py-2"
                      />
                    ) : (
                      <div className="text-sm">
                        {post.paymentDetails?.accountNumber ?? "—"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
