import React, { useMemo, useState } from "react";
import { API_BASE, createOrder } from "../api";
import { OrderCard } from "../components/OrderCard";

export default function P2PRoom() {
  const roomId = "global";

  const [spend, setSpend] = useState(25000);
  const rate = 313.99; // PKR per USDT
  const receive = useMemo(() => (spend / rate).toFixed(4), [spend]);
  const [adminToken, setAdminToken] = useState("");

  const onSubmit = async () => {
    const order = await createOrder(
      {
        side: "buy",
        amountPKR: spend,
        quoteAsset: "USDT",
        pricePKRPerQuote: rate,
        paymentMethod: "easypaisa",
        roomId,
        createdBy: "admin",
      },
      adminToken,
    );
    console.log("created", order);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="space-y-4 w-full max-w-lg">
        <OrderCard>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500">Spend</label>
              <div className="flex items-center gap-2 bg-gray-50 border rounded-xl p-3">
                <input
                  type="number"
                  value={spend}
                  onChange={(e) => setSpend(Number(e.target.value))}
                  className="flex-1 bg-transparent outline-none"
                />
                <span className="px-2 py-1 rounded bg-gray-100 text-sm">
                  PKR
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Receive ≈</label>
              <div className="flex items-center gap-2 bg-gray-50 border rounded-xl p-3">
                <input
                  readOnly
                  value={receive}
                  className="flex-1 bg-transparent outline-none"
                />
                <span className="px-2 py-1 rounded bg-green-100 text-sm">
                  USDT
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500">1 USDT ≈ {rate} PKR</p>
            <div>
              <label className="text-xs text-gray-500">Payment Methods</label>
              <select
                className="w-full border rounded-lg p-2 bg-white"
                value="easypaisa"
                readOnly
              >
                <option value="easypaisa">Easypaisa (only)</option>
              </select>
            </div>
            <div className="pt-2">
              <input
                type="password"
                placeholder="Admin token to post order"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>
        </OrderCard>

        <div className="bg-white rounded-xl shadow border p-4">
          <h3 className="font-semibold mb-2">Live feed</h3>
          <pre className="text-xs max-h-40 overflow-auto bg-gray-50 p-2 rounded">
            {JSON.stringify([], null, 2)}
          </pre>
          <button
            onClick={onSubmit}
            className="mt-3 w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded"
          >
            Create Admin Order
          </button>
        </div>
      </div>
    </div>
  );
}
