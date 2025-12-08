import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { createP2POrder } from "@/lib/p2p-api";

const PRICE_MAP: Record<string, number> = {
  USDT: 300,
  SOL: 30000,
  FIXERCOIN: 5,
};

export default function PostOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [token, setToken] = useState("USDT");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [price, setPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("easypaisa");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const autoFillPrice = (t: string) => {
    const p = PRICE_MAP[t] ?? 0;
    setPrice(String(p));
  };

  const clearForm = () => {
    setToken("USDT");
    setMinAmount("");
    setMaxAmount("");
    setPrice("");
    setPaymentMethod("easypaisa");
    setAccountName("");
    setAccountNumber("");
    setWalletAddress("");
  };

  const handleCreate = async () => {
    if (!wallet?.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (mode === "buy") {
      if (
        !minAmount ||
        !maxAmount ||
        !price ||
        !accountName ||
        !accountNumber
      ) {
        toast({
          title: "Missing fields",
          description: "Please fill all required buy fields",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!minAmount || !maxAmount || !price || !walletAddress) {
        toast({
          title: "Missing fields",
          description: "Please fill all required sell fields",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsLoading(true);

      const pkrAmount = Number(maxAmount) || Number(minAmount) || 0;
      const tokenAmount = pkrAmount / Number(price);

      const order = await createP2POrder({
        type: mode,
        creator_wallet: wallet.publicKey,
        token,
        token_amount: String(tokenAmount),
        pkr_amount: pkrAmount,
        payment_method: paymentMethod,
        online: false,
        account_name: mode === "buy" ? accountName : undefined,
        account_number: mode === "buy" ? accountNumber : undefined,
        wallet_address: mode === "sell" ? walletAddress : undefined,
      });

      setCreatedOrderId(order.id);
      toast({
        title: "Success",
        description: "Order created successfully",
      });

      setTimeout(() => {
        navigate(`/express/post-order/${order.id}`);
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Failed to create order",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center font-medium">Post Order</div>
          <div className="h-9 w-9" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setMode("buy")}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  mode === "buy"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setMode("sell")}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  mode === "sell"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Sell
              </button>
            </div>
            <div className="text-sm text-gray-500">{mode.toUpperCase()}</div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 mb-2 font-medium">
                Select Token
              </label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-white text-sm"
              >
                <option value="USDC">USDC</option>
                <option value="SOL">SOL</option>
                <option value="FIXERCOIN">FIXERCOIN</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-2 font-medium">
                  Min Amount (PKR)
                </label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="1000"
                  className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-2 font-medium">
                  Max Amount (PKR)
                </label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-2 font-medium">
                Price (PKR per {token})
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="flex-1 border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => autoFillPrice(token)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium"
                >
                  Auto Fill
                </button>
              </div>
            </div>

            {mode === "buy" ? (
              <>
                <div>
                  <label className="block text-xs text-gray-600 mb-2 font-medium">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="jazzcash">JazzCash</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-2 font-medium">
                      Account Name
                    </label>
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-2 font-medium">
                      Account Number
                    </label>
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="03001234567"
                      className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs text-gray-600 mb-2 font-medium">
                  Solana Wallet Address
                </label>
                <input
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Enter recipient wallet address"
                  className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={clearForm}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-3 py-2 font-medium text-sm"
              >
                Clear
              </button>
              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg px-3 py-2 font-medium text-sm disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Create Order"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
          <p>
            <strong>Tip:</strong> Switch between Buy and Sell above. You can
            auto-fill the price based on current market rates.
          </p>
        </div>
      </div>
    </div>
  );
}
