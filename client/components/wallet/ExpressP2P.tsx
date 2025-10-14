import React, { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const ORDER_SESSION_KEY = "express-cloudflare-p2p-session";

type OrderRole = "buyer" | "seller";

interface OrderSession {
  orderId: string;
  token: string;
  role: OrderRole;
}

export const ExpressP2P: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const { toast } = useToast();

  const [session, setSession] = useState<OrderSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(ORDER_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OrderSession;
    } catch {
      return null;
    }
  });

  const orderIdRef = useRef<HTMLInputElement | null>(null);
  const tokenRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(ORDER_SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(ORDER_SESSION_KEY);
    }
  }, [session]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate("/");
  };

  const handleCreateOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!wallet?.publicKey) {
      toast({ title: "Wallet required", description: "Connect a wallet first.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: wallet.publicKey, role: "buyer" }),
      });
      if (!res.ok) throw new Error(`Failed to create order (${res.status})`);
      const data = await res.json();
      const id = String(data?.orderId ?? data?.id ?? "");
      const token = String(data?.token ?? data?.jwt ?? "");
      if (!id || !token) {
        toast({ title: "Order creation failed", description: "Missing order ID or token.", variant: "destructive" });
        return;
      }
      setSession({ orderId: id, token, role: "buyer" });
      toast({ title: "Order created", description: `Order ${id} created.` });
    } catch (err: any) {
      toast({ title: "Order creation failed", description: String(err?.message || err), variant: "destructive" });
    }
  };

  const handleJoinOrder = (e: FormEvent) => {
    e.preventDefault();
    const id = orderIdRef.current?.value?.trim() ?? "";
    const token = tokenRef.current?.value?.trim() ?? "";
    if (!id || !token) {
      toast({ title: "Missing data", description: "Enter both order ID and token.", variant: "destructive" });
      return;
    }
    setSession({ orderId: id, token, role: "seller" });
    toast({ title: "Joined order", description: `Joined order ${id}` });
  };

  const handleLeave = () => {
    setSession(null);
    toast({ title: "Left order", description: "Disconnected from order room." });
  };

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Express P2P</h1>
          <p className="text-sm text-muted-foreground">Simple, fixed UI while repairing the file.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{wallet?.publicKey ? "Wallet connected" : "No wallet"}</Badge>
          <Button variant="ghost" size="sm" onClick={handleBack}>
            Back
          </Button>
        </div>
      </div>

      {!session ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Order</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrder} className="space-y-3">
                <Label>Creating an order will call the /api/orders endpoint and persist a session.</Label>
                <div className="flex gap-2">
                  <Button type="submit" className="w-full">
                    Create Order
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Join Order</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinOrder} className="space-y-3">
                <div>
                  <Label>Order ID</Label>
                  <Input ref={orderIdRef} placeholder="Order ID" />
                </div>
                <div>
                  <Label>Session Token</Label>
                  <Input ref={tokenRef} placeholder="Session token" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="w-full">
                    Join
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <Label>Order ID</Label>
                <div className="font-mono break-all">{session.orderId}</div>
              </div>
              <div>
                <Label>Role</Label>
                <div>{session.role}</div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleLeave} variant="destructive">
                  Leave Order
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
