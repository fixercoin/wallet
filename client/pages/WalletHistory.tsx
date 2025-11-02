import React, { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BASE_SOLSCAN_TX = (sig: string) => `https://solscan.io/tx/${sig}`;

function findSignaturesInObject(obj: any): string[] {
  const results: string[] = [];
  const base58Regex = /^[A-HJ-NP-Za-km-z1-9]{40,90}$/;

  function recurse(value: any) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(recurse);
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => {
        const key = k.toLowerCase();
        if (typeof v === "string") {
          const str = v.trim();
          if (
            key.includes("signature") ||
            key.includes("tx") ||
            key.includes("transaction") ||
            key.includes("txid") ||
            base58Regex.test(str)
          ) {
            if (!results.includes(str) && base58Regex.test(str)) results.push(str);
            // also accept short-ish signatures if key signals transaction
            else if (!results.includes(str) && (key.includes("signature") || key.includes("tx") || key.includes("transaction") || key.includes("txid"))) results.push(str);
          }
        } else {
          recurse(v);
        }
      });
    }
  }

  recurse(obj);
  return results;
}

export default function WalletHistory() {
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [locks, setLocks] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!wallet?.publicKey) return;
    try {
      const raw = localStorage.getItem(`spl_token_locks_${wallet.publicKey}`) || "[]";
      const parsed = JSON.parse(raw);
      setLocks(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      setLocks([]);
    }

    try {
      const rawC = localStorage.getItem("orders_completed") || "[]";
      setCompletedOrders(JSON.parse(rawC));
    } catch (e) {
      setCompletedOrders([]);
    }

    try {
      const rawP = localStorage.getItem("orders_pending") || "[]";
      setPendingOrders(JSON.parse(rawP));
    } catch (e) {
      setPendingOrders([]);
    }
  }, [wallet?.publicKey]);

  return (
    <div className="min-h-screen bg-white text-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold">History</h1>
        </div>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Token Locks ({locks.length})</h2>
          {locks.length === 0 ? (
            <div className="text-sm text-gray-600">No token lock history found.</div>
          ) : (
            <ul className="space-y-3">
              {locks.map((l: any) => (
                <li key={l.id || Math.random()} className="p-3 rounded-md border border-[#e6f6ec]/20 bg-white/80">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-gray-900">{l.amount} {l.symbol}</div>
                      <div className="text-xs text-gray-600">Locked on {new Date(l.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-gray-600">{l.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Completed Orders ({(completedOrders && completedOrders.length) || 0})</h2>
          {(!completedOrders || completedOrders.length === 0) ? (
            <div className="text-sm text-gray-600">No completed orders in history.</div>
          ) : (
            <ul className="space-y-3">
              {completedOrders.map((o: any, idx: number) => (
                <li key={o.id || idx} className="p-3 rounded-md border border-[#e6f6ec]/20 bg-white/80">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-gray-900">Order {o.id || idx}</div>
                      <div className="text-xs text-gray-600">{o.description || JSON.stringify(o)}</div>
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Pending Orders ({(pendingOrders && pendingOrders.length) || 0})</h2>
          {(!pendingOrders || pendingOrders.length === 0) ? (
            <div className="text-sm text-gray-600">No pending orders.</div>
          ) : (
            <ul className="space-y-3">
              {pendingOrders.map((o: any, idx: number) => (
                <li key={o.id || idx} className="p-3 rounded-md border border-[#e6f6ec]/20 bg-white/80">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-gray-900">Order {o.id || idx}</div>
                      <div className="text-xs text-gray-600">{o.description || JSON.stringify(o)}</div>
                    </div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
