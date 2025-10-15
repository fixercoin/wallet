import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PostOrder() {
  const navigate = useNavigate();
  const [amountPKR, setAmountPKR] = useState("");
  const [quoteAsset, setQuoteAsset] = useState("USDC");
  const [pricePKRPerQuote, setPricePKRPerQuote] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountPKR || !pricePKRPerQuote) {
      alert("Please fill required fields");
      return;
    }

    // Simplified behavior: show a confirmation and navigate to orderbook.
    // Real creation requires backend APIs; keep this simple so the page renders anywhere.
    alert(
      `Order created: ${amountPKR} PKR → ${quoteAsset} at ${pricePKRPerQuote} PKR/${quoteAsset}`,
    );
    navigate("/express/orderbook");
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="max-w-md mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold mb-4">Post Order (Simplified)</h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount (PKR)</label>
            <input
              type="number"
              value={amountPKR}
              onChange={(e) => setAmountPKR(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 bg-white"
              placeholder="e.g. 10000"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Token</label>
            <select
              value={quoteAsset}
              onChange={(e) => setQuoteAsset(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 bg-white"
            >
              <option value="USDC">USDC</option>
              <option value="SOL">SOL</option>
              <option value="FIXERCOIN">FIXERCOIN</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Token price (PKR)</label>
            <input
              type="number"
              value={pricePKRPerQuote}
              onChange={(e) => setPricePKRPerQuote(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 bg-white"
              placeholder="e.g. 3000"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/express/orderbook")}
              className="flex-1 bg-gray-200 rounded-xl px-3 py-2"
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl px-3 py-2"
            >
              Create Order
            </button>
          </div>
        </form>

        <div className="text-xs text-gray-500 mt-4">
          This is a simplified page that avoids external API calls so it renders
          reliably on any static deployment. To restore full functionality,
          ensure the app build and server functions are deployed.
        </div>
      </div>
    </div>
  );
}
