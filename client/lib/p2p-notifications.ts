/**
 * P2P Event Notifications
 * Handles notifications for order expiry, payment confirmations, and other P2P events
 */

import { toast } from "sonner";

export interface P2PNotification {
  id: string;
  type: "order_expired" | "payment_confirmed" | "auto_released" | "seller_needs_verification";
  title: string;
  message: string;
  orderId?: string;
  roomId?: string;
  timestamp: number;
  read: boolean;
}

const NOTIFICATIONS_STORAGE_KEY = "p2p_events_notifications";

/**
 * Show a toast notification with custom styling
 */
export function showP2PToast(
  type: "success" | "error" | "info" | "warning",
  title: string,
  message: string,
) {
  const descriptions = {
    success: `✅ ${title}: ${message}`,
    error: `❌ ${title}: ${message}`,
    info: `ℹ️ ${title}: ${message}`,
    warning: `⚠️ ${title}: ${message}`,
  };

  toast[type](descriptions[type], {
    duration: 4000,
  });
}

/**
 * Notify when an order is about to expire
 */
export function notifyOrderExpiring(orderId: string, minutesRemaining: number) {
  showP2PToast(
    "warning",
    "Order Expiring Soon",
    `Your order will expire in ${minutesRemaining} minutes. Take action now!`,
  );
  saveNotification({
    type: "order_expired",
    title: "Order Expiring",
    message: `Order will expire in ${minutesRemaining} minutes`,
    orderId,
  });
}

/**
 * Notify when an order has expired
 */
export function notifyOrderExpired(orderId: string) {
  showP2PToast(
    "error",
    "Order Expired",
    "Your order has expired and been removed from the marketplace.",
  );
  saveNotification({
    type: "order_expired",
    title: "Order Expired",
    message: "Your order has been automatically cancelled due to timeout",
    orderId,
  });
}

/**
 * Notify when one party confirms payment
 */
export function notifyPaymentConfirmed(
  walletAddress: string,
  isBuyer: boolean,
) {
  const party = isBuyer ? "Buyer" : "Seller";
  showP2PToast(
    "info",
    "Payment Confirmed",
    `${party} has confirmed payment. Waiting for other party...`,
  );
}

/**
 * Notify when both parties confirm payment and escrow is released
 */
export function notifyAutoRelease(roomId: string) {
  showP2PToast(
    "success",
    "Escrow Released",
    "Both parties confirmed payment! Funds have been automatically released.",
  );
  saveNotification({
    type: "auto_released",
    title: "Escrow Released",
    message: "Both parties confirmed payment. Funds released to seller.",
    roomId,
  });
}

/**
 * Notify seller that they need to verify payment method
 */
export function notifySellerNeedsVerification() {
  showP2PToast(
    "error",
    "Payment Method Required",
    "You must add a payment method to create sell orders.",
  );
  saveNotification({
    type: "seller_needs_verification",
    title: "Payment Method Required",
    message: "Add a payment method to start selling",
  });
}

/**
 * Save notification to localStorage
 */
function saveNotification(
  notification: Omit<P2PNotification, "id" | "timestamp" | "read">,
) {
  try {
    const existing = getNotifications();
    const newNotif: P2PNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      read: false,
    };
    existing.push(newNotif);
    // Keep last 50 notifications
    const trimmed = existing.slice(-50);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Failed to save notification", e);
  }
}

/**
 * Get all notifications
 */
export function getNotifications(): P2PNotification[] {
  try {
    const json = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

/**
 * Get unread notifications
 */
export function getUnreadNotifications(): P2PNotification[] {
  return getNotifications().filter((n) => !n.read);
}

/**
 * Mark notification as read
 */
export function markAsRead(notificationId: string) {
  try {
    const notifications = getNotifications();
    const updated = notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n,
    );
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to mark notification as read", e);
  }
}

/**
 * Clear all notifications
 */
export function clearAllNotifications() {
  try {
    localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear notifications", e);
  }
}

/**
 * Check if order is about to expire (within 2 minutes)
 */
export function isOrderAboutToExpire(expiresAt: number): boolean {
  const TWO_MINUTES = 2 * 60 * 1000;
  return Date.now() > expiresAt - TWO_MINUTES && Date.now() < expiresAt;
}

/**
 * Get minutes remaining until order expires
 */
export function getMinutesRemaining(expiresAt: number): number {
  const msRemaining = Math.max(0, expiresAt - Date.now());
  return Math.ceil(msRemaining / 60000);
}
