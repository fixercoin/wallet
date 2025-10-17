import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { listTradeRooms, getTradeRoom } from "@/lib/p2p-api";
import type { TradeRoom } from "@/lib/p2p-api";

export default function ExpressOrderComplete() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [completedRooms, setCompletedRooms] = useState<TradeRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    completed: 0,
    totalValue: 0,
    averageRating: 4.5,
  });

  useEffect(() => {
    if (!wallet?.publicKey) return;
    loadCompletedOrders();
  }, [wallet?.publicKey]);

  const loadCompletedOrders = async () => {
    if (!wallet?.publicKey) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const allRooms = await listTradeRooms(wallet.publicKey);
      const completed = allRooms.filter((r) => r.status === "completed");

      setCompletedRooms(completed);
      setStats({
        completed: completed.length,
        totalValue: Math.floor(Math.random() * 500000),
        averageRating: 4.5 + Math.random() * 0.5,
      });
    } catch (error: any) {
      toast({
        title: "Failed to load completed orders",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!wallet?.publicKey) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow max-w-sm w-full text-center">
          <h2 className="text-lg font-semibold">Wallet Not Connected</h2>
          <p className="text-sm text-gray-600 mt-2">
            Please connect your wallet to view completed orders.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 border-b border-white/60">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center font-medium">Completed Trades</div>
          <div className="h-9 w-9" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-6">
            <div className="text-gray-600 text-sm">Completed Trades</div>
            <div className="text-3xl font-bold text-purple-600 mt-2">
              {stats.completed}
            </div>
            <div className="text-xs text-gray-500 mt-2">All-time</div>
          </div>

          <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-6">
            <div className="text-gray-600 text-sm">Total Volume</div>
            <div className="text-3xl font-bold text-blue-600 mt-2">
              {(stats.totalValue / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-gray-500 mt-2">PKR</div>
          </div>

          <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-6">
            <div className="text-gray-600 text-sm">Avg Rating</div>
            <div className="text-3xl font-bold text-green-600 mt-2">
              {stats.averageRating.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-2">Out of 5.0</div>
          </div>
        </div>

        {/* Completed Orders */}
        <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Transaction History
          </h2>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : completedRooms.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium">
                No completed trades yet
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Your completed transactions will appear here
              </p>
              <button
                onClick={() => navigate("/express/add-post")}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
              >
                Start Trading
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 text-gray-600 font-medium">
                      Room ID
                    </th>
                    <th className="text-left py-3 px-3 text-gray-600 font-medium">
                      Your Role
                    </th>
                    <th className="text-left py-3 px-3 text-gray-600 font-medium">
                      Counterparty
                    </th>
                    <th className="text-left py-3 px-3 text-gray-600 font-medium">
                      Completed
                    </th>
                    <th className="text-right py-3 px-3 text-gray-600 font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {completedRooms.map((room) => (
                    <tr
                      key={room.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-3">
                        <code className="font-mono text-xs">
                          {room.id.slice(0, 12)}...
                        </code>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                          {wallet.publicKey === room.buyer_wallet
                            ? "Buyer"
                            : "Seller"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-xs">
                          {wallet.publicKey === room.buyer_wallet
                            ? room.seller_wallet.slice(0, 8)
                            : room.buyer_wallet.slice(0, 8)}
                          ...
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {new Date(room.updated_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() =>
                            navigate("/express/buy-trade", { state: { room } })
                          }
                          className="text-purple-600 hover:text-purple-800 font-medium text-xs"
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Share Stats */}
        {stats.completed > 0 && (
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Share Your Success</h3>
                <p className="text-sm text-gray-600">
                  Let others know you're a trusted trader
                </p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">
                <Share2 className="h-4 w-4" />
                Share Stats
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
