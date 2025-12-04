import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, ShoppingCart, TrendingUp } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import {
  getUnreadNotifications,
  loadChatHistory,
  type ChatNotification,
} from "@/lib/p2p-chat";

interface TradeRoom {
  id: string;
  type: "buy" | "sell";
  token: string;
  amount: string;
  status: "active" | "pending" | "completed";
  lastMessage?: string;
  timestamp?: number;
  unreadCount: number;
}

export default function P2PHome() {
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const [tradeRooms, setTradeRooms] = useState<TradeRoom[]>([]);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [activeTab, setActiveTab] = useState<"buy" | "sell" | "active">(
    "active",
  );

  useEffect(() => {
    if (!wallet) return;

    const unread = getUnreadNotifications(wallet.publicKey);
    setNotifications(unread);

    // Load active trade rooms from notifications
    const rooms: Map<string, TradeRoom> = new Map();

    unread.forEach((notif) => {
      if (!rooms.has(notif.roomId)) {
        rooms.set(notif.roomId, {
          id: notif.roomId,
          type: notif.initiatorRole === "buyer" ? "buy" : "sell",
          token: notif.data?.token || "Unknown",
          amount: notif.data?.amount || "",
          status: "active",
          timestamp: notif.timestamp,
          unreadCount: 0,
        });
      }

      const room = rooms.get(notif.roomId)!;
      if (notif.initiatorWallet !== wallet.publicKey) {
        room.unreadCount++;
      }
    });

    setTradeRooms(Array.from(rooms.values()));
  }, [wallet]);

  if (!wallet) {
    return (
      <div
        className="w-full min-h-screen pb-24"
        style={{ fontSize: "10px", backgroundColor: "#0f0f0f", color: "#fff" }}
      >
        <div className="text-center pt-20 text-white/70">
          Please connect your wallet first
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen pb-24"
      style={{ fontSize: "10px", backgroundColor: "#0f0f0f", color: "#fff" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a] to-transparent p-4">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#22c55e]/20 border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/30 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">P2P TRADE</h1>
            <p className="text-xs text-white/60">Buy or Sell Crypto</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">Active Trades</div>
            <div className="text-lg font-bold text-[#FF7A5C]">
              {tradeRooms.length}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          {(["active", "buy", "sell"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-colors ${
                activeTab === tab
                  ? "bg-[#22c55e] text-black"
                  : "bg-[#22c55e]/10 text-white border border-[#22c55e]/40 hover:bg-[#22c55e]/20"
              }`}
            >
              {tab === "active" ? "Active" : tab === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {activeTab === "active" && (
          <>
            {tradeRooms.length === 0 ? (
              <Card className="border-0">
                <CardContent className="pt-12 pb-12 text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-white/40" />
                  <div className="text-white/70 mb-6">
                    No active trades yet. Start trading now!
                  </div>
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        setActiveTab("buy");
                      }}
                      className="w-full h-12 bg-[#22c55e] hover:bg-[#22c55e]/90 text-black font-bold rounded-lg"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Buy Crypto
                    </Button>
                    <Button
                      onClick={() => {
                        setActiveTab("sell");
                      }}
                      variant="outline"
                      className="w-full h-12 border-[#FF7A5C] text-[#FF7A5C] hover:bg-[#FF7A5C]/10"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Sell Crypto
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              tradeRooms.map((room) => (
                <Card
                  key={room.id}
                  className="border-[#22c55e]/30 cursor-pointer hover:border-[#22c55e]/60 transition-colors"
                  onClick={() => navigate("/express/buy-trade", { state: { room } })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              room.type === "buy"
                                ? "bg-[#22c55e]/20 text-[#22c55e]"
                                : "bg-[#FF7A5C]/20 text-[#FF7A5C]"
                            }`}
                          >
                            {room.type === "buy" ? "BUYING" : "SELLING"}
                          </div>
                          <div className="text-xs text-white/60">
                            {new Date(room.timestamp || 0).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-white mb-1">
                          {room.amount} {room.token}
                        </div>
                        {room.unreadCount > 0 && (
                          <div className="text-xs text-[#FF7A5C]">
                            {room.unreadCount} unread messages
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            room.status === "active"
                              ? "bg-[#22c55e]/20 text-[#22c55e]"
                              : room.status === "pending"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-green-500/20 text-green-400"
                          }`}
                        >
                          {room.status.toUpperCase()}
                        </div>
                        <MessageSquare className="w-4 h-4 text-[#FF7A5C]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {activeTab === "buy" && (
          <Card className="border-0">
            <CardContent className="pt-8 pb-8 text-center">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-[#22c55e]" />
              <div className="text-white mb-6">
                <h3 className="font-bold text-lg mb-2">Buy Crypto</h3>
                <p className="text-sm text-white/70">
                  Purchase crypto using your preferred payment method
                </p>
              </div>
              <Button
                onClick={() => navigate("/buy-crypto")}
                className="w-full h-12 bg-[#22c55e] hover:bg-[#22c55e]/90 text-black font-bold rounded-lg"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Start Buying
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === "sell" && (
          <Card className="border-0">
            <CardContent className="pt-8 pb-8 text-center">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 text-[#FF7A5C]" />
              <div className="text-white mb-6">
                <h3 className="font-bold text-lg mb-2">Sell Crypto</h3>
                <p className="text-sm text-white/70">
                  Sell your crypto and get paid in your preferred currency
                </p>
              </div>
              <Button
                onClick={() => navigate("/sell-now")}
                className="w-full h-12 bg-[#FF7A5C] hover:bg-[#FF7A5C]/90 text-white font-bold rounded-lg"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Start Selling
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
