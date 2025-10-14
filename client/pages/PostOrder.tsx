import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { createOrder } from "@/lib/p2p";

export default function PostOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [adminToken, setAdminToken] = useState("");

  // Buy form
  const [buyAmountPKR, setBuyAmountPKR] = useState<number | "">("");
  const [buyToken, setBuyToken] = useState("USDC");
  const [buyPrice, setBuyPrice] = useState<number | "">("");

  // Sell form
  const [sellToken, setSellToken] = useState("USDC");
  const [sellTokenAmount, setSellTokenAmount] = useState<number | "">("");
  const [sellTokenPricePKR, setSellTokenPricePKR] = useState<number | "">("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const sellAmountPKR = useMemo(() => {
    if (!sellTokenAmount || !sellTokenPricePKR) return 0;
    return Number(sellTokenAmount) * Number(sellTokenPricePKR);
  }, [sellTokenAmount, sellTokenPricePKR]);

  const handleSave = async () => {
    try {
      if (!adminToken) {
        toast({ title: "Admin token required", variant: "destructive" });
        return;
      }
      if (mode === "buy") {
        if (!buyAmountPKR || !buyPrice) return;
        await createOrder(
          {
            side: "buy",
            amountPKR: Number(buyAmountPKR),
            quoteAsset: buyToken,
            pricePKRPerQuote: Number(buyPrice),
            paymentMethod: "easypaisa",
            roomId: "global",
          },
          adminToken,
        );
      } else {
        if (!sellTokenAmount || !sellTokenPricePKR) return;
        await createOrder(
          {
            side: "sell",
            amountPKR: Number(sellAmountPKR),
            quoteAsset: sellToken,
            pricePKRPerQuote: Number(sellTokenPricePKR),
            paymentMethod: "easypaisa",
            roomId: "global",
          } as any,
          adminToken,
        );
      }
      toast({ title: "Order saved" });
      navigate("/express/orderbook");
    } catch (e: any) {
      toast({ title: "Failed to save", description: String(e?.message || e), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/", { state: { goP2P: true } })}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))]"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center font-medium">Post Order</div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/express/orderbook")}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))]"
            aria-label="Orderbook"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="wallet-card rounded-2xl p-6 space-y-5">
          <div className="flex gap-2 bg-white rounded-xl p-1 border w-full">
            <button
              className={`flex-1 py-2 rounded-lg ${mode === "buy" ? "bg-pink-100 font-medium" : ""}`}
              onClick={() => setMode("buy")}
            >
              Buy
            </button>
            <button
              className={`flex-1 py-2 rounded-lg ${mode === "sell" ? "bg-pink-100 font-medium" : ""}`}
              onClick={() => setMode("sell")}
            >
              Sell
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Admin token</label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 bg-white"
              placeholder="Required to save orders"
            />
          </div>

          {mode === "buy" ? (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  min={0}
                  value={buyAmountPKR}
                  onChange={(e) => setBuyAmountPKR(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Token</label>
                <select
                  value={buyToken}
                  onChange={(e) => setBuyToken(e.target.value)}
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
                  min={0}
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Payment method</label>
                <input disabled className="w-full border rounded-xl px-3 py-2 bg-gray-50" value="easypaisa" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Token amount</label>
                <input
                  type="number"
                  min={0}
                  value={sellTokenAmount}
                  onChange={(e) => setSellTokenAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Token</label>
                <select
                  value={sellToken}
                  onChange={(e) => setSellToken(e.target.value)}
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
                  min={0}
                  value={sellTokenPricePKR}
                  onChange={(e) => setSellTokenPricePKR(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border rounded-xl px-3 py-2 bg-white"
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Account name</label>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Account number</label>
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 bg-white"
                    placeholder="0000000000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Payment method</label>
                <input disabled className="w-full border rounded-xl px-3 py-2 bg-gray-50" value="easypaisa" />
              </div>
              <div className="p-3 rounded-lg border bg-white">
                <div className="text-xs text-gray-500">Amount (PKR)</div>
                <div className="font-semibold mt-1">{sellAmountPKR}</div>
              </div>
            </>
          )}

          <Button className="w-full wallet-button-primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
