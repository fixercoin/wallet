/**
 * Push Notification Service
 * Handles Web Push API notifications for order updates
 */

export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  async init(): Promise<void> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications not supported in this browser");
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      console.log("Push notification service initialized");
    } catch (error) {
      console.error("Failed to initialize push notifications:", error);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      } catch (error) {
        console.error("Failed to request notification permission:", error);
        return false;
      }
    }

    return false;
  }

  async sendNotification(
    title: string,
    options: NotificationOptions = {},
  ): Promise<void> {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      console.warn("Notification permission not granted");
      return;
    }

    try {
      if (this.registration && this.registration.showNotification) {
        await this.registration.showNotification(title, {
          badge: "/icon-192x192.png",
          icon: "/icon-192x192.png",
          ...options,
        });
      } else {
        new Notification(title, options);
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }

  async sendOrderNotification(
    type: "order_created" | "payment_confirmed" | "received_confirmed",
    message: string,
    orderData: { token: string; amountPKR: number },
  ): Promise<void> {
    const titles = {
      order_created: "📦 New Order",
      payment_confirmed: "✅ Payment Confirmed",
      received_confirmed: "🎉 Order Received",
    };

    const title = titles[type] || "Order Notification";
    const body = `${message}\n${orderData.token} - ${orderData.amountPKR.toFixed(2)} PKR`;

    await this.sendNotification(title, {
      body,
      tag: `order-${Date.now()}`,
      requireInteraction: false,
    });
  }

  isSupported(): boolean {
    return "Notification" in window && "serviceWorker" in navigator;
  }

  getPermissionStatus(): NotificationPermission {
    if ("Notification" in window) {
      return Notification.permission;
    }
    return "denied";
  }
}

export const pushNotificationService = new PushNotificationService();

export function usePushNotifications() {
  const initPushNotifications = async (): Promise<void> => {
    if (!pushNotificationService.isSupported()) {
      return;
    }

    await pushNotificationService.init();

    const permission = pushNotificationService.getPermissionStatus();
    if (permission === "default") {
      const granted = await pushNotificationService.requestPermission();
      if (granted) {
        console.log("Push notification permission granted");
      }
    }
  };

  const sendOrderNotification = async (
    type: "order_created" | "payment_confirmed" | "received_confirmed",
    message: string,
    orderData: { token: string; amountPKR: number },
  ): Promise<void> => {
    await pushNotificationService.sendOrderNotification(
      type,
      message,
      orderData,
    );
  };

  return {
    initPushNotifications,
    sendOrderNotification,
    isSupported: pushNotificationService.isSupported(),
  };
}
