import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ExpressPostOrderDetail() {
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("last_order");
      if (raw) {
        const parsed = JSON.parse(raw);
        setOrder(parsed);
        setOnline(Boolean(parsed?.online));
      } else {
        // if no order present, navigate back
        // navigate('/express/post-order');
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleOnline = () => {
    const next = !online;
    setOnline(next);
    const o = { ...(order || {}), online: next };
    setOrder(o);
    try {
      sessionStorage.setItem("last_order", JSON.stringify(o));
      alert(`Order is now ${next ? "ONLINE" : "OFFLINE"}`);
    } catch {}
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold">No order found</h2>
          <p className="text-sm text-gray-500 mt-2">
            Create an order first on the Post Order page.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigate("/express/post-order")}
              className="flex-1 bg-gray-200 rounded-xl px-3 py-2"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))] p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl p-6 shadow space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Order Detail</h1>
          <div className="text-sm text-gray-500">
            {order.type?.toUpperCase()}
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <div>
            <strong>Token:</strong> {order.token}
          </div>
          <div>
            <strong>Min:</strong> {order.minAmount} PKR
          </div>
          <div>
            <strong>Max:</strong> {order.maxAmount} PKR
          </div>
          <div>
            <strong>Price:</strong> {order.pricePKRPerQuote} PKR/{order.token}
          </div>
          {order.type === "buy" && (
            <>
              <div>
                <strong>Payment method:</strong> {order.paymentMethod}
              </div>
              <div>
                <strong>Account name:</strong> {order.accountName}
              </div>
              <div>
                <strong>Account number:</strong> {order.accountNumber}
              </div>
            </>
          )}
          {order.type === "sell" && (
            <div>
              <strong>Wallet address:</strong> {order.walletAddress}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate("/express/post-order")}
            className="flex-1 bg-gray-200 rounded-xl px-3 py-2"
          >
            Back
          </button>

          <button
            onClick={toggleOnline}
            className={`flex-1 rounded-xl px-3 py-2 ${online ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}
          >
            {online ? "Go Offline" : "Go Online"}
          </button>
        </div>

        <div className="text-xs text-gray-500">
          Order ID: <span className="font-mono">{order.id || "-"}</span>
        </div>
      </div>
    </div>
  );
}
