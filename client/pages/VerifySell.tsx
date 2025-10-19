import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDurableRoom } from "@/hooks/useDurableRoom";
import { useWallet } from "@/contexts/WalletContext";
import { API_BASE } from "@/lib/p2p";
import { 
  getPaymentReceivedNotifications, 
  clearNotificationsForRoom,
  saveChatMessage,
  sendChatMessage,
  broadcastNotification,
  type ChatMessage,
  type ChatNotification,
} from "@/lib/p2p-chat";

export default function VerifySell() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();
  const { send } = useDurableRoom("global", API_BASE);

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  useEffect(() => {
    if (!wallet?.publicKey) return;
    
    const notifications = getPaymentReceivedNotifications(wallet.publicKey);
    const ordersList = notifications.map((notif) => ({
      id: notif.data?.orderId || notif.roomId,
      roomId: notif.roomId,
      token: notif.data?.token || "USDC",
      amountPKR: notif.data?.amountPKR || 0,
      amountTokens: notif.data?.estimatedTokens || 0,
      paymentMethod: "easypaisa",
      timestamp: notif.timestamp,
    }));
    
    setOrders(ordersList);
    
    if (ordersList.length > 0 && !selectedOrderId) {
      setSelectedOrderId(ordersList[0].id);
    }
  }, [wallet?.publicKey]);

  const handleVerified = async () => {
    if (!selectedOrder) return;
    setLoading(true);
    
    try {
      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        roomId: selectedOrder.roomId,
        senderWallet: wallet?.publicKey || "",
        senderRole: "seller",
        type: "seller_verified",
        text: "Seller verified buyer's payment",
        timestamp: Date.now(),
      };

      saveChatMessage(message);
      sendChatMessage(send, message);

      const notification: ChatNotification = {
        type: "status_change",
        roomId: selectedOrder.roomId,
        initiatorWallet: wallet?.publicKey || "",
        initiatorRole: "seller",
        message: "Payment verified - waiting for transfer",
        timestamp: Date.now(),
      };

      saveNotification(notification);
      broadcastNotification(send, notification);

      clearNotificationsForRoom(selectedOrder.roomId);

      toast({
        title: "Payment verified",
        description: "Buyer notification sent",
      });

      navigate("/express/buy-trade", {
        state: {
          order: {
            id: selectedOrder.id,
            type: "sell",
            token: selectedOrder.token,
            amountPKR: selectedOrder.amountPKR,
            amountTokens: selectedOrder.amountTokens,
            pricePKRPerQuote: selectedOrder.amountPKR / selectedOrder.amountTokens,
            quoteAsset: selectedOrder.token,
            paymentMethod: selectedOrder.paymentMethod,
          },
          openChat: true,
          initialPhase: "seller_verified",
        },
      });
    } catch (error: any) {
      toast({
        title: "Failed to verify",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => navigate("/");

  if (orders.length === 0) {
    return (
      <div
        className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]"
        style={{ fontSize: "10px" }}
      >
        <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center">
            <button
              onClick={goBack}
              className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
            </button>
            <div className="flex-1 text-center font-semibold">Pending Verifications</div>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-10">
          <Card className="bg-transparent backdrop-blur-xl rounded-md">
            <CardContent className="pt-10 pb-10 text-center">
              <Clock className="w-12 h-12 mx-auto text-white/40 mb-4" />
              <div className="text-white/80">
                No pending payment verifications.
              </div>
              <Button
                onClick={goBack}
                className="mt-4 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
              >
                Go back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden text-[10px]"
      style={{ fontSize: "10px" }}
    >
      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <button
            onClick={goBack}
            className="p-2 hover:bg-[#1a2540]/50 rounded-lg transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF7A5C]" />
          </button>
          <div className="flex-1 text-center font-semibold">
            Verify Payment ({orders.length})
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 relative z-20 space-y-4">
        {orders.length > 1 && (
          <div className="space-y-2">
            <label className="text-xs text-white/60">Select Order</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedOrderId === order.id
                      ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white"
                      : "bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white/80 hover:border-[#FF7A5C]"
                  }`}
                >
                  {order.token} {Number(order.amountTokens).toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedOrder && (
          <Card className="bg-transparent backdrop-blur-xl rounded-md">
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-[#FF7A5C]/20 to-[#FF5A8C]/20 border border-[#FF7A5C]/30">
                <Clock className="w-5 h-5 text-[#FF7A5C] flex-shrink-0" />
                <div className="text-sm text-white/90">
                  Buyer has confirmed payment. Please verify and proceed to transfer.
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Order Number</span>
                  <span className="font-mono text-xs">{selectedOrder.id}</span>
                </div>
                <Separator className="bg-[#FF7A5C]/20" />
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Token</span>
                  <span className="font-semibold">{selectedOrder.token}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Amount Tokens</span>
                  <span className="font-semibold">
                    {Number(selectedOrder.amountTokens).toFixed(6)} {selectedOrder.token}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Amount (PKR)</span>
                  <span className="font-semibold">
                    {Number(selectedOrder.amountPKR).toFixed(2)} PKR
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-80">Rate</span>
                  <span className="font-semibold">
                    {(selectedOrder.amountPKR / selectedOrder.amountTokens).toFixed(2)} PKR/{selectedOrder.token}
                  </span>
                </div>
              </div>

              <Separator className="bg-[#FF7A5C]/20" />

              <div className="space-y-3">
                <Button
                  onClick={handleVerified}
                  disabled={loading}
                  className="w-full h-12 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      I HAVE VERIFIED
                    </>
                  )}
                </Button>
                <Button
                  onClick={goBack}
                  variant="outline"
                  className="w-full text-white border-white/20 hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
