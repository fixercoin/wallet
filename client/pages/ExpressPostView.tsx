import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    minToken: post?.minToken ?? "",
    maxToken: post?.maxToken ?? "",
    paymentMethod: post?.paymentMethod ?? "bank",
  }));

  if (!post) {
    return (
      <div className="flex min-h-screen w-screen flex-col bg-background">
        <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
          <div className="container mx-auto flex h-14 items-center px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="ml-4 font-semibold">Post not found</div>
          </div>
        </header>
        <main className="flex-1">
          <div className="container mx-auto max-w-md px-4 py-6">
            <div className="rounded-xl border border-[hsl(var(--border))] bg-card p-4 text-sm">
              No post data was provided. Go back and create a post.
            </div>
          </div>
        </main>
      </div>
    );
  }

  const handleSave = () => {
    // Basic validation
    const price = parseFloat(form.pricePkr || "0");
    const min = parseFloat(form.minToken || "0");
    const max = parseFloat(form.maxToken || "0");
    if (!(price > 0) || !(min > 0) || !(max > 0) || min > max) {
      toast({ title: "Invalid values", variant: "destructive" });
      return;
    }

    const updated = { ...post, ...form };
    setPost(updated);
    setEditing(false);
    toast({ title: "Post saved" });
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
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="font-semibold">Offer Details</div>
          </div>
          <div>
            <Button onClick={() => setEditing((e) => !e)} className="mr-2">
              {editing ? "Cancel" : "Edit"}
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[hsl(330,81%,60%)] text-white"
            >
              Save
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-md px-4 py-6">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-card p-4">
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
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
