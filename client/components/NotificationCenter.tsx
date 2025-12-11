import React, { useState, useEffect, useRef } from "react";
import { User, Store, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { playNotificationSound } from "@/lib/services/notification-sound";
import { useP2POrderFlow } from "@/contexts/P2POrderFlowContext";
import { syncOrderFromStorage } from "@/lib/p2p-order-api";
import type { P2POrder } from "@/lib/p2p-api";

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead } = useOrderNotifications();
  const [isOpen, setIsOpen] = useState<"buyer" | "seller" | null>(null);
  const navigate = useNavigate();
  const { wallet } = useWallet();
  const previousUnreadCountRef = useRef(0);
  const processedNotificationsRef = useRef<Set<string>>(new Set());
  const { openBuyerWalletDialog, openCryptoReceivedDialog } = useP2POrderFlow();

  // Determine if a notification is for buyer or seller
  const isBuyerNotification = (type: string): boolean => {
    return [
      "transfer_initiated",
      "order_accepted",
      "order_rejected",
      "order_completed_by_seller",
      "new_sell_order",
      "crypto_received",
    ].includes(type);
  };

  const isSellerNotification = (type: string): boolean => {
    return [
      "new_buy_order",
      "seller_payment_received",
      "order_created",
      "payment_confirmed",
    ].includes(type);
  };

  // Filter notifications by type
  const buyerNotifications = notifications.filter((n) =>
    isBuyerNotification(n.type),
  );
  const sellerNotifications = notifications.filter((n) =>
    isSellerNotification(n.type),
  );

  const buyerUnreadCount = buyerNotifications.filter((n) => !n.read).length;
  const sellerUnreadCount = sellerNotifications.filter((n) => !n.read).length;

  // Play bell sound when new notifications arrive
  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current && unreadCount > 0) {
      playNotificationSound();
    }
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // Automatically open dialog for critical notifications (only once per notification)
  useEffect(() => {
    const criticalNotifications = notifications.filter(
      (n) =>
        (n.type === "transfer_initiated" ||
          n.type === "seller_payment_received") &&
        !n.read &&
        !processedNotificationsRef.current.has(n.id),
    );

    // Only auto-open if user hasn't already interacted with the notification center
    // This prevents double-opening when user clicks notification manually
    if (criticalNotifications.length > 0 && !isOpen) {
      const notification = criticalNotifications[0];
      processedNotificationsRef.current.add(notification.id);

      // Add a small delay to ensure notification is fully stored
      const timeoutId = setTimeout(() => {
        if (
          notification.type === "transfer_initiated" &&
          notification.fullOrder
        ) {
          openCryptoReceivedDialog(notification.fullOrder);
        } else if (
          notification.type === "seller_payment_received" &&
          notification.fullOrder
        ) {
          openBuyerWalletDialog(
            notification.fullOrder,
            notification.fullOrder.wallet_address || "",
          );
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [notifications, openCryptoReceivedDialog, openBuyerWalletDialog, isOpen]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order_created":
        return "Order";
      case "new_buy_order":
        return "Buy Order";
      case "payment_confirmed":
        return "Payment";
      case "seller_payment_received":
        return "Seller";
      case "transfer_initiated":
        return "Transfer";
      case "crypto_received":
        return "Received";
      case "order_cancelled":
        return "Cancelled";
      case "order_accepted":
        return "Accepted";
      case "order_rejected":
        return "Rejected";
      case "order_completed_by_seller":
        return "Completed";
      default:
        return "Notice";
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

  const displayNotifications =
    isOpen === "buyer"
      ? buyerNotifications
      : isOpen === "seller"
        ? sellerNotifications
        : [];

  const panelTitle = isOpen === "buyer" ? "Buyer Messages" : "Seller Messages";

  return (
    <div className="relative flex gap-2">
      {/* Buyer Messages Button */}
      <button
        onClick={() => setIsOpen(isOpen === "buyer" ? null : "buyer")}
        className="relative p-2 rounded-lg hover:bg-gray-900 transition-colors"
        aria-label="Buyer Messages"
      >
        <User className="w-6 h-6 text-white" />
        {buyerUnreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-blue-600 rounded-full">
            {buyerUnreadCount > 9 ? "9+" : buyerUnreadCount}
          </span>
        )}
      </button>

      {/* Seller Messages Button */}
      <button
        onClick={() => setIsOpen(isOpen === "seller" ? null : "seller")}
        className="relative p-2 rounded-lg hover:bg-gray-900 transition-colors"
        aria-label="Seller Messages"
      >
        <Store className="w-6 h-6 text-white" />
        {sellerUnreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-purple-600 rounded-full">
            {sellerUnreadCount > 9 ? "9+" : sellerUnreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-[#1a2847] border border-gray-300/30 shadow-xl z-50">
          <div className="p-4 border-b border-gray-300/30 flex items-center justify-between">
            <h3 className="font-semibold text-white uppercase text-sm">
              {panelTitle}
            </h3>
            <button
              onClick={() => setIsOpen(null)}
              className="p-1 hover:bg-gray-900 rounded transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>

          <ScrollArea className="h-96">
            {displayNotifications.length === 0 ? (
              <div className="p-8 text-center text-white/70">
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-300/20">
                {displayNotifications
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-900/50 transition-colors cursor-pointer ${
                        !notification.read ? "bg-gray-900/30" : ""
                      }`}
                      onClick={async () => {
                        if (!notification.read) {
                          markAsRead(notification.id);
                        }

                        setIsOpen(false);

                        // Load the order from storage
                        let order: P2POrder | null = null;
                        try {
                          order = await syncOrderFromStorage(
                            notification.orderId,
                          );
                        } catch (error) {
                          console.error("Failed to load order:", error);
                        }

                        // Handle new buy order - seller receives notification
                        if (notification.type === "new_buy_order" && order) {
                          // Open buyer wallet dialog for seller
                          // Get buyer wallet from the loaded order
                          const buyerWallet =
                            order.creator_wallet ||
                            notification.senderWallet ||
                            "";
                          openBuyerWalletDialog(order, buyerWallet);
                          return;
                        }

                        // Handle crypto transfer initiated - buyer receives notification
                        if (
                          notification.type === "transfer_initiated" &&
                          order
                        ) {
                          // Open crypto received dialog for buyer
                          openCryptoReceivedDialog(order);
                          return;
                        }

                        // For new sell orders, open crypto received dialog to show order confirmation
                        if (notification.type === "new_sell_order" && order) {
                          // Open crypto received dialog to show seller's order summary
                          openCryptoReceivedDialog(order);
                          return;
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="text-xs font-semibold text-blue-400 pt-0.5 flex-shrink-0 px-2 py-1 rounded bg-blue-500/20">
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
