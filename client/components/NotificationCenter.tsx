import React, { useState, useEffect, useRef } from "react";
import { Bell, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { playNotificationSound } from "@/lib/services/notification-sound";

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead } = useOrderNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const previousUnreadCountRef = useRef(0);

  // Play bell sound when new notifications arrive
  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current && unreadCount > 0) {
      playNotificationSound();
    }
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order_created":
        return "📦";
      case "new_buy_order":
        return "🛍️";
      case "payment_confirmed":
        return "💰";
      case "seller_payment_received":
        return "✅";
      case "transfer_initiated":
        return "🚀";
      case "crypto_received":
        return "🎉";
      case "order_cancelled":
        return "❌";
      case "order_accepted":
        return "👍";
      case "order_rejected":
        return "👎";
      case "order_completed_by_seller":
        return "📋";
      default:
        return "📢";
    }
  };

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case "order_created":
        return "New Order";
      case "new_buy_order":
        return "New Buy Order";
      case "payment_confirmed":
        return "Payment Confirmed";
      case "seller_payment_received":
        return "Payment Received";
      case "transfer_initiated":
        return "Crypto Transfer Started";
      case "crypto_received":
        return "Crypto Received";
      case "order_cancelled":
        return "Order Cancelled";
      case "order_accepted":
        return "Order Accepted";
      case "order_rejected":
        return "Order Rejected";
      case "order_completed_by_seller":
        return "Order Completed by Seller";
      default:
        return "Notification";
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-900 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-[#1a2847] border border-gray-300/30 shadow-xl z-50">
          <div className="p-4 border-b border-gray-300/30 flex items-center justify-between">
            <h3 className="font-semibold text-white uppercase text-sm">
              Notifications
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-900 rounded transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          <ScrollArea className="h-96">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-white/70">
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-300/20">
                {notifications
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-900/50 transition-colors cursor-pointer ${
                        !notification.read ? "bg-gray-900/30" : ""
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead(notification.id);
                        }

                        setIsOpen(false);

                        // For new buy orders, navigate to seller order confirmation page
                        if (notification.type === "new_buy_order") {
                          navigate(`/seller-order-confirmation/${notification.orderId}`);
                          return;
                        }

                        // For other notifications, navigate to order-complete
                        // Determine buyer and seller based on notification type
                        // For BUY orders: senderWallet is buyer, recipientWallet is seller/admin
                        // For SELL orders: senderWallet is seller, recipientWallet is buyer
                        const isBuyOrder = notification.orderType === "BUY";
                        const buyerWallet = isBuyOrder
                          ? notification.senderWallet
                          : notification.recipientWallet;
                        const sellerWallet = isBuyOrder
                          ? notification.recipientWallet
                          : notification.senderWallet;

                        navigate("/order-complete", {
                          state: {
                            order: {
                              id: notification.orderId,
                              type: notification.orderType,
                              token: notification.orderData.token,
                              amountTokens: notification.orderData.amountTokens,
                              amountPKR: notification.orderData.amountPKR,
                              buyerWallet,
                              sellerWallet,
                              payment_method: "easypaisa",
                              roomId: notification.orderId,
                              offerId: "",
                              pricePKRPerQuote: 280,
                              status: "PENDING",
                              createdAt: notification.createdAt,
                            },
                            openChat: true,
                          },
                        });
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="text-xl pt-1 flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-white">
                              {getNotificationTitle(notification.type)}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-xs text-white/70 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                            <span>{notification.orderData.token}</span>
                            <span>•</span>
                            <span>
                              {notification.orderData.amountPKR.toFixed(2)} PKR
                            </span>
                            <span>•</span>
                            <span>{formatTime(notification.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
