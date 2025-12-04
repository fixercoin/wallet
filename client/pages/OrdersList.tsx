import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, TrendingUp } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentMethodDialog } from "@/components/wallet/PaymentMethodDialog";
import { P2PBottomNavigation } from "@/components/P2PBottomNavigation";
import { ADMIN_WALLET } from "@/lib/p2p";

export default function OrdersList() {
  const navigate = useNavigate();
  const { status } = useParams();
  const { wallet } = useWallet();
  const [orders, setOrders] = useState<any[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<
    string | undefined
  >();
  const [showCreateOfferDialog, setShowCreateOfferDialog] = useState(false);
  const [offerPassword, setOfferPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const OFFER_PASSWORD = "######Pakistan";

  const handleOfferAction = (action: "buy" | "sell") => {
    if (offerPassword !== OFFER_PASSWORD) {
      setPasswordError("Invalid password");
      return;
    }
    setShowCreateOfferDialog(false);
    setOfferPassword("");
    setPasswordError("");
    navigate(action === "buy" ? "/buy-crypto" : "/sell-now");
  };

  useEffect(() => {
    try {
      const key =
        status === "completed" ? "orders_completed" : "orders_pending";
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      setOrders(Array.isArray(arr) ? arr : []);
    } catch {
      setOrders([]);
    }
  }, [status]);

  const goBack = () => navigate("/p2p");

  return (
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]"
      style={{ fontSize: "10px" }}
    >
      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <button
            onClick={goBack}
            className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
          </button>
          <div className="flex-1 text-center font-semibold uppercase">
            {status} orders
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 relative z-20 space-y-3">
        {orders.length === 0 && (
          <div className="text-center text-white/70">No {status} orders</div>
        )}
        {orders.map((o) => (
          <Card
            key={o.id}
            className="bg-transparent backdrop-blur-xl rounded-md"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs opacity-80">Order Number</div>
                  <div className="font-semibold">{o.id}</div>
                  {(o.token || o.amountPKR || o.amountTokens) && (
                    <div className="text-xs text-white/70 mt-1">
                      {o.token && <span>{o.token}</span>}
                      {typeof o.amountPKR === "number" &&
                        isFinite(o.amountPKR) && (
                          <span> • {Number(o.amountPKR).toFixed(2)} PKR</span>
                        )}
                      {typeof o.amountTokens === "number" &&
                        isFinite(o.amountTokens) && (
                          <span>
                            {o.amountPKR ? " • " : " • "}
                            {Number(o.amountTokens).toFixed(6)} {o.token || ""}
                          </span>
                        )}
                    </div>
                  )}
                </div>
                {wallet?.publicKey === ADMIN_WALLET ? (
                  <button
                    onClick={() =>
                      navigate("/express/buy-trade", {
                        state: { order: o, openChat: true },
                      })
                    }
                    className="px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/40 text-white text-sm hover:bg-[#1a2540]/60"
                  >
                    Open View
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      navigate(`/order/${encodeURIComponent(o.id)}`)
                    }
                    className="px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/40 text-white text-sm hover:bg-[#1a2540]/60"
                  >
                    View
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
