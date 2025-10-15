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

  // Buy form
  const [buyToken, setBuyToken] = useState("USDC");
  const [buyMin, setBuyMin] = useState("");
  const [buyMax, setBuyMax] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("easypaisa");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // Sell form
  const [sellToken, setSellToken] = useState("USDC");
  const [sellMin, setSellMin] = useState("");
  const [sellMax, setSellMax] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  const autoFillPrice = (token: string, isBuy: boolean) => {
    const p = PRICE_MAP[token] ?? 0;
    if (isBuy) setBuyPrice(String(p));
    else setSellPrice(String(p));
  };

  const handleCreate = (type: "buy" | "sell") => {
    const id = generateId();
    const common = {
      id,
      type,
      token: type === "buy" ? buyToken : sellToken,
      minAmount: type === "buy" ? buyMin : sellMin,
      maxAmount: type === "buy" ? buyMax : sellMax,
      pricePKRPerQuote: type === "buy" ? buyPrice : sellPrice,
    } as any;

    if (type === "buy") {
      if (!buyMin || !buyMax || !buyPrice || !accountName || !accountNumber) {
        alert("Please fill all buy fields");
        return;
      }
      common.paymentMethod = paymentMethod;
      common.accountName = accountName;
      common.accountNumber = accountNumber;
    } else {
      if (!sellMin || !sellMax || !sellPrice || !walletAddress) {
        alert("Please fill all sell fields");
        return;
      }
      common.walletAddress = walletAddress;
    }

    // If admin token matches, navigate to detail page and save order
    if (adminToken === "fixorium-create-2025") {
      const order = { ...common, online: false };
      try {
        sessionStorage.setItem("last_order", JSON.stringify(order));
      } catch {}
      navigate("/express/post-order/detail");
      return;
    }

    // Otherwise store locally and notify user
    try {
      sessionStorage.setItem("last_order", JSON.stringify(common));
    } catch {}
    alert("Order created locally. Provide admin token to proceed to publish.");
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

      <div className="max-w-3xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="wallet-card rounded-2xl p-4 space-y-3">
          <h2 className="text-lg font-semibold">Buy</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Select token</label>
            <select value={buyToken} onChange={(e) => setBuyToken(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white">
              <option value="USDC">USDC</option>
              <option value="SOL">SOL</option>
              <option value="FIXERCOIN">FIXERCOIN</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Minimum amount (PKR)</label>
              <input type="number" value={buyMin} onChange={(e) => setBuyMin(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Maximum amount (PKR)</label>
              <input type="number" value={buyMax} onChange={(e) => setBuyMax(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Auto price fill</label>
            <div className="flex gap-2">
              <input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="flex-1 border rounded-xl px-3 py-2 bg-white" />
              <button type="button" onClick={() => autoFillPrice(buyToken, true)} className="px-3 py-2 bg-gray-200 rounded-xl">Auto</button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Payment method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white">
              <option value="easypaisa">Easypaisa</option>
              <option value="jazcash">JazzCash</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account name</label>
              <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account number</label>
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => {}} className="flex-1 bg-gray-200 rounded-xl px-3 py-2">Clear</button>
            <button onClick={() => handleCreate("buy")} className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl px-3 py-2">Create Order</button>
          </div>
        </div>

        <div className="wallet-card rounded-2xl p-4 space-y-3">
          <h2 className="text-lg font-semibold">Sell</h2>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Select token</label>
            <select value={sellToken} onChange={(e) => setSellToken(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white">
              <option value="USDC">USDC</option>
              <option value="SOL">SOL</option>
              <option value="FIXERCOIN">FIXERCOIN</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Minimum amount (PKR)</label>
              <input type="number" value={sellMin} onChange={(e) => setSellMin(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Maximum amount (PKR)</label>
              <input type="number" value={sellMax} onChange={(e) => setSellMax(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Auto price fill</label>
            <div className="flex gap-2">
              <input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="flex-1 border rounded-xl px-3 py-2 bg-white" />
              <button type="button" onClick={() => autoFillPrice(sellToken, false)} className="px-3 py-2 bg-gray-200 rounded-xl">Auto</button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Wallet address</label>
            <input value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white" />
          </div>

          <div className="flex gap-2">
            <button onClick={() => {}} className="flex-1 bg-gray-200 rounded-xl px-3 py-2">Clear</button>
            <button onClick={() => handleCreate("sell")} className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl px-3 py-2">Create Order</button>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2">
          <div className="wallet-card rounded-2xl p-4">
            <label className="block text-xs text-gray-500 mb-1">Admin token (required to publish)</label>
            <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white" placeholder="Enter admin token if you are publishing" />
            <div className="mt-3 text-sm text-gray-500">After creating an order with the correct admin token (<code>fixorium-create-2025</code>) you will be redirected to the Order Detail page where you can toggle online/offline.</div>
          </div>
        </div>
      </div>

      {/* Floating + button to open last order detail */}
      <button onClick={openDetail} aria-label="Open last order" title="Open last order" style={{position: 'fixed', right: 20, bottom: 20, width:48, height:48, borderRadius:24, background:'#7c3aed', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 18px rgba(124,58,237,0.24)'}}>
        +
      </button>
    </div>
  );
}
