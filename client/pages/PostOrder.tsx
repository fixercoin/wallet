import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const PRICE_MAP: Record<string, number> = {
  USDC: 300,
  SOL: 30000,
  FIXERCOIN: 5,
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function PostOrder() {
  const navigate = useNavigate();
  const [adminToken, setAdminToken] = useState("");

  const [mode, setMode] = useState<"buy" | "sell">("buy");

  // Shared state
  const [token, setToken] = useState("USDC");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [price, setPrice] = useState("");

  // Buy-specific
  const [paymentMethod, setPaymentMethod] = useState("easypaisa");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // Sell-specific
  const [walletAddress, setWalletAddress] = useState("");

  const autoFillPrice = (t: string) => {
    const p = PRICE_MAP[t] ?? 0;
    setPrice(String(p));
  };

  const clearForm = () => {
    setToken("USDC");
    setMinAmount("");
    setMaxAmount("");
    setPrice("");
    setPaymentMethod("easypaisa");
    setAccountName("");
    setAccountNumber("");
    setWalletAddress("");
  };

  const handleCreate = () => {
    const id = generateId();
    const base = {
      id,
      type: mode,
      token,
      minAmount,
      maxAmount,
      pricePKRPerQuote: price,
    } as any;

    if (mode === "buy") {
      if (
        !minAmount ||
        !maxAmount ||
        !price ||
        !accountName ||
        !accountNumber
      ) {
        alert("Please fill all required buy fields");
        return;
      }
      base.paymentMethod = paymentMethod;
      base.accountName = accountName;
      base.accountNumber = accountNumber;
    } else {
      if (!minAmount || !maxAmount || !price || !walletAddress) {
        alert("Please fill all required sell fields");
        return;
      }
      base.walletAddress = walletAddress;
    }

    if (adminToken === "fixorium-create-2025") {
      const order = { ...base, online: false };
      try {
        sessionStorage.setItem("last_order", JSON.stringify(order));
      } catch {}
      navigate("/express/post-order/detail");
      return;
    }

    try {
      sessionStorage.setItem("last_order", JSON.stringify(base));
    } catch {}
    alert("Order created locally. Provide correct admin token to publish.");
  };

  const openDetail = () => {
    const raw = sessionStorage.getItem("last_order");
    if (!raw) {
      alert("No order found. Create one first.");
      return;
    }
    navigate("/express/post-order/detail");
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex-1 text-center font-medium">Post Order</div>
          <div className="h-9 w-9" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="wallet-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setMode("buy")}
                className={`px-3 py-2 rounded-xl ${mode === "buy" ? "bg-purple-600 text-white" : "bg-white"}`}
              >
                Buy
              </button>
              <button
                onClick={() => setMode("sell")}
                className={`px-3 py-2 rounded-xl ${mode === "sell" ? "bg-purple-600 text-white" : "bg-white"}`}
              >
                Sell
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Mode: {mode.toUpperCase()}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Select token
              </label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 bg-white"
              >
                <option value="USDC">USDC</option>
                <option value="SOL">SOL</option>
                <option value="FIXERCOIN">FIXERCOIN</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Minimum amount (PKR)
                </label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Maximum amount (PKR)
                </label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Auto price fill
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="flex-1 border rounded-xl px-3 py-2 bg-white"
                />
                <button
                  type="button"
                  onClick={() => autoFillPrice(token)}
                  className="px-3 py-2 bg-gray-200 rounded-xl"
                >
                  Auto
                </button>
              </div>
            </div>

            {mode === "buy" ? (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Payment method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="easypaisa">Easypaisa</option>
                    <option value="jazcash">JazzCash</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Account name
                    </label>
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Account number
                    </label>
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2 bg-white"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Wallet address
                </label>
                <input
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={clearForm}
                className="flex-1 bg-gray-200 rounded-xl px-3 py-2"
              >
                Clear
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl px-3 py-2"
              >
                Create Order
              </button>
            </div>

            <div className="text-xs text-gray-500">
              Tip: switch between Buy and Sell above. You can auto-fill price
              based on the selected token.
            </div>
          </div>
        </div>

        <div className="mt-4 wallet-card rounded-2xl p-4">
          <label className="block text-xs text-gray-500 mb-1">
            Admin token (required to publish)
          </label>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 bg-white"
            placeholder="Enter admin token if you are publishing"
          />
          <div className="mt-3 text-sm text-gray-500">
            After creating an order with the correct admin token (
            <code>fixorium-create-2025</code>) you will be redirected to the
            Order Detail page where you can toggle online/offline.
          </div>
        </div>
      </div>

      <button
        onClick={openDetail}
        aria-label="Open last order"
        title="Open last order"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          width: 48,
          height: 48,
          borderRadius: 24,
          background: "#7c3aed",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 18px rgba(124,58,237,0.24)",
        }}
      >
        +
      </button>
    </div>
  );
}
