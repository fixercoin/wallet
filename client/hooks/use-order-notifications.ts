import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { pushNotificationService } from "@/lib/services/push-notifications";

export interface OrderNotification {
  id: string;
  orderId: string;
  recipientWallet: string;
  senderWallet: string;
  type:
    | "order_created"
    | "new_buy_order"
    | "new_sell_order"
    | "payment_confirmed"
    | "seller_payment_received"
    | "transfer_initiated"
    | "crypto_received"
    | "order_cancelled"
    | "order_accepted"
    | "order_rejected"
    | "order_completed_by_seller";
  orderType: "BUY" | "SELL";
  message: string;
  orderData: {
    token: string;
    amountTokens: number;
    amountPKR: number;
  };
  read: boolean;
  createdAt: number;
}

export function useOrderNotifications() {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(
    async (unreadOnly: boolean = false) => {
      if (!wallet) return;

      setLoading(true);
      try {
        const query = unreadOnly ? "&unread=true" : "";
        // Fetch direct notifications + broadcast notifications but filter out self-created ones
        const response = await fetch(
          `/api/p2p/notifications?wallet=${encodeURIComponent(wallet.publicKey)}&includeBroadcast=true${query}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch notifications: ${response.status}`);
        }

        const data = await response.json();

        // Filter out notifications where the user is the sender (self-created)
        // This ensures buyers don't receive notifications for orders they created,
        // and sellers don't receive notifications for orders they created
        const filteredNotifications = (data.data || []).filter(
          (n: OrderNotification) => n.senderWallet !== wallet.publicKey,
        );

        setNotifications(filteredNotifications);

        const unread = filteredNotifications.filter(
          (n: OrderNotification) => !n.read,
        ).length;
        setUnreadCount(unread);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    },
    [wallet],
  );

  const createNotification = useCallback(
    async (
      recipientWallet: string,
      type:
        | "order_created"
        | "new_buy_order"
        | "new_sell_order"
        | "payment_confirmed"
        | "seller_payment_received"
        | "transfer_initiated"
        | "crypto_received"
        | "order_cancelled"
        | "order_accepted"
        | "order_rejected"
        | "order_completed_by_seller",
      orderType: "BUY" | "SELL",
      orderId: string,
      message: string,
      orderData: {
        token: string;
        amountTokens: number;
        amountPKR: number;
      },
      sendPushNotification: boolean = true,
    ) => {
      if (!wallet) {
        console.error("Wallet not connected");
        return;
      }

      try {
        const response = await fetch("/api/p2p/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientWallet,
            senderWallet: wallet.publicKey,
            type,
            orderType,
            message,
            orderId,
            orderData,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create notification: ${response.status}`);
        }

        // Only send push notifications to other users, not to the user creating the notification
        if (sendPushNotification) {
          await pushNotificationService.sendOrderNotification(
            type,
            message,
            orderData,
          );
        }

        console.log(`Notification created for ${recipientWallet}`);
      } catch (error) {
        console.error("Error creating notification:", error);
      }
    },
    [wallet],
  );

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch("/api/p2p/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to mark notification as read: ${response.status}`,
        );
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const showNotificationToast = useCallback(
    (notification: OrderNotification) => {
      const titles: Record<string, string> = {
        order_created: "New Order",
        payment_confirmed: "Payment Confirmed",
        seller_payment_received: "Payment Received",
        transfer_initiated: "Crypto Transfer Started",
        crypto_received: "Crypto Received",
        order_cancelled: "Order Cancelled",
      };

      toast({
        title: titles[notification.type] || "Order Notification",
        description: notification.message,
        duration: 5000,
      });
    },
    [toast],
  );

  useEffect(() => {
    if (!wallet) return;

    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications();
    }, 3000);

    return () => clearInterval(interval);
  }, [wallet, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    createNotification,
    markAsRead,
    showNotificationToast,
  };
}
