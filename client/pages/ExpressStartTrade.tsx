// This file was created and structured by Builder.io
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { listP2POrders, createTradeRoom } from "@/lib/p2p-api";
import type { P2POrder } from "@/lib/p2p-api";

export default function ExpressStartTrade() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<P2POrder | null>(null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [pkrAmount, setPkrAmount] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await listP2POrders({ online: true, status: "active" });
      setOrders(data);
    } catch (error: any) {
      toast({
        title: "Failed to load orders",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOrder = (order: P2POrder) => {
    if (wallet?.publicKey === order.creator_wallet) {
      toast({
        title: "Cannot trade with yourself",
        description: "Select a different order",
        variant: "destructive",
      });
      return;
    }
    setSelectedOrder(order);
    setPkrAmount("");
    setAgreed(false);
  };

  const handleStartTrade = async () => {
    if (!selectedOrder || !wallet?.publicKey) return;

    if (!pkrAmount || Number(pkrAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid PKR amount",
        variant: "destructive",
      });
      return;
    }

    if (!agreed) {
      toast({
        title: "Please agree",
        description: "You must agree to the terms to continue",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsInitiating(true);

      const room = await createTradeRoom({
        buyer_wallet:
          selectedOrder.type === "sell"
            ? wallet.publicKey
            : selectedOrder.creator_wallet,
        seller_wallet:
          selectedOrder.type === "sell"
            ? selectedOrder.creator_wallet
            : wallet.publicKey,
        order_id: selectedOrder.id,
      });

      toast({
        title: "Trade started",
        description: "Entering trade chat...",
      });

      setTimeout(() => {
        navigate("/express/buy-trade", {
          state: { order: selectedOrder, room },
        });
      }, 500);
    } catch (error: any) {
      toast({
        title: "Failed to start trade",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsInitiating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  const rate = selectedOrder
    ? selectedOrder.pkr_amount / Number(selectedOrder.token_amount)
    : 0;
  const estimatedTokens = pkrAmount ? Number(pkrAmount) / rate : 0;

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              navigate("/");
              setSelectedOrder(null);
            }}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center font-medium">Quick Trade</div>
          <div className="h-9 w-9" />
        </div>
      </div>

      <div className="w-full px-4 py-6">
        {!selectedOrder ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold mb-4">Choose an Order</h2>
            {orders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl">
                <Zap className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No active orders available</p>
                <button
                  onClick={() => navigate("/express/add-post")}
                  className="mt-4 px-4 py-2 text-purple-600 font-medium hover:underline"
                >
                  Browse all orders →
                </button>
              </div>
            ) : (
              orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className="w-full bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        order.type === "buy"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {order.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-gray-600 text-xs">Token</div>
                      <div className="font-semibold">{order.token}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-xs">Rate</div>
                      <div className="font-semibold">
                        {(
                          order.pkr_amount / Number(order.token_amount)
                        ).toFixed(2)}{" "}
                        PKR
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-xs">Amount</div>
                      <div className="font-semibold">
                        {Number(order.token_amount).toFixed(6)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 text-xs">PKR</div>
                      <div className="font-semibold">
                        {order.pkr_amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Selected Order</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Change
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type</span>
                  <span className="font-semibold uppercase">
                    {selectedOrder.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Token</span>
                  <span className="font-semibold">{selectedOrder.token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Available Amount</span>
                  <span className="font-semibold">
                    {Number(selectedOrder.token_amount).toFixed(6)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold">
                  <span>Rate</span>
                  <span>
                    {rate.toFixed(2)} PKR per {selectedOrder.token}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-4">
              <label className="block text-sm font-medium mb-3">
                {selectedOrder.type === "buy"
                  ? "How much do you want to buy?"
                  : "How much do you want to sell?"}
              </label>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Amount in PKR
                  </label>
                  <input
                    type="number"
                    value={pkrAmount}
                    onChange={(e) => setPkrAmount(e.target.value)}
                    placeholder="Enter PKR amount"
                    className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {estimatedTokens > 0 && (
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                    <div className="text-sm">
                      <span className="text-gray-600">You will receive: </span>
                      <span className="font-bold text-lg text-purple-600">
                        {estimatedTokens.toFixed(6)} {selectedOrder.token}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded"
                />
                <span className="text-xs text-gray-700">
                  <strong>I agree</strong> to the P2P trading terms. I
                  understand:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
                    <li>I will follow the agreed payment method</li>
                    <li>I will not dispute without reason</li>
                    <li>My rating will be affected by conduct</li>
                  </ul>
                </span>
              </label>
            </div>

            <button
              onClick={handleStartTrade}
              disabled={isInitiating || !agreed || !pkrAmount}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isInitiating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Starting...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  Start Trade
                </>
              )}
            </button>

            {!agreed && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  You must agree to the terms before starting a trade.
                </p>
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                Enter a chat with the seller to discuss and complete the trade.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
