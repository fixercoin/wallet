import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowLeft } from "lucide-react";

export default function OrderDetail() {
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<any | null>(null);
  const [status, setStatus] = useState<"pending" | "completed" | null>(null);

  useEffect(() => {
    try {
      const pRaw = localStorage.getItem("orders_pending");
      const cRaw = localStorage.getItem("orders_completed");
      const p = pRaw ? JSON.parse(pRaw) : [];
      const c = cRaw ? JSON.parse(cRaw) : [];
      const foundP = Array.isArray(p)
        ? p.find((o: any) => String(o.id) === String(orderId))
        : null;
      const foundC = Array.isArray(c)
        ? c.find((o: any) => String(o.id) === String(orderId))
        : null;
      if (foundC) {
        setOrder(foundC);
        setStatus("completed");
      } else if (foundP) {
        setOrder(foundP);
        setStatus("pending");
      }
    } catch {}
  }, [orderId]);

  const goBack = () => navigate(-1);

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
          <div className="flex-1 text-center font-semibold">Order Detail</div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 relative z-20">
        {!order ? (
          <div className="text-center text-white/70">Order not found</div>
        ) : (
          <Card className="bg-transparent backdrop-blur-xl rounded-md">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs opacity-80">Order Number</div>
                <div className="font-semibold">{order.id}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs opacity-80">Status</div>
                <div className="font-semibold capitalize">{status}</div>
              </div>
              {order.token && (
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-80">Token</div>
                  <div className="font-semibold">{order.token}</div>
                </div>
              )}
              {typeof order.amountPKR !== "undefined" && (
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-80">Amount</div>
                  <div className="font-semibold">
                    {formatCurrency(Number(order.amountPKR), {
                      from: "PKR",
                      minimumFractionDigits: 0,
                    })}
                  </div>
                </div>
              )}
              {typeof order.amountTokens !== "undefined" && (
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-80">Amount Tokens</div>
                  <div className="font-semibold">
                    {Number(order.amountTokens).toFixed(6)} {order.token}
                  </div>
                </div>
              )}
              {typeof order.pricePKRPerQuote !== "undefined" && (
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-80">Exchange Rate</div>
                  <div className="font-semibold">
                    1 {order.token} ={" "}
                    {formatCurrency(Number(order.pricePKRPerQuote), {
                      from: "PKR",
                      minimumFractionDigits:
                        Number(order.pricePKRPerQuote) < 1 ? 6 : 2,
                    })}
                  </div>
                </div>
              )}
              {order.paymentMethod && (
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-80">Payment Method</div>
                  <div className="font-semibold capitalize">
                    {order.paymentMethod}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
