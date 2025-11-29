import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ArrowDownLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { TransactionNotification } from "@/lib/services/transaction-monitor";

interface MobileNotificationProps {
  notification: TransactionNotification | null;
  onClose: () => void;
  autoHideDelay?: number;
}

export const MobileNotification: React.FC<MobileNotificationProps> = ({
  notification,
  onClose,
  autoHideDelay = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      setIsAnimating(true);

      // Auto-hide after delay
      const timer = setTimeout(() => {
        handleClose();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [notification, autoHideDelay]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  const formatAmount = (amount?: number, token?: string): string => {
    if (!amount || !token) return "";

    if (token === "SOL") {
      return `${amount.toFixed(6)} SOL`;
    }

    if (token === "FIXERCOIN" || token === "LOCKER") {
      return `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${token}`;
    }

    return `${amount.toLocaleString()} ${token}`;
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const openTransaction = () => {
    if (notification?.signature) {
      window.open(
        `https://explorer.solana.com/tx/${notification.signature}`,
        "_blank",
      );
    }
  };

  if (!isVisible || !notification) return null;

  const isIncoming = notification.type === "incoming";

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <Card
        className={`
          w-full max-w-md mx-auto 
          ${
            isIncoming
              ? "bg-gradient-to-r from-emerald-500/90 to-green-600/90"
              : "bg-gradient-to-r from-blue-500/90 to-purple-600/90"
          } 
          backdrop-blur-xl border border-white/5 shadow-2xl
          transform transition-all duration-300 ease-out
          ${
            isAnimating
              ? "translate-y-0 opacity-100 scale-100"
              : "-translate-y-full opacity-0 scale-95"
          }
        `}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              {/* Icon */}
              <div className="flex-shrink-0 p-2 bg-white/20 rounded-full">
                {isIncoming ? (
                  <ArrowDownLeft className="h-5 w-5 text-white" />
                ) : (
                  <ArrowUpRight className="h-5 w-5 text-white" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 text-white">
                <h3 className="font-semibold text-sm mb-1">
                  {isIncoming ? "Transaction Received! 🎉" : "Transaction Sent"}
                </h3>

                {notification.amount && notification.token && (
                  <p className="text-white/90 text-lg font-bold mb-1">
                    {formatAmount(notification.amount, notification.token)}
                  </p>
                )}

                <p className="text-white/70 text-xs">
                  {formatTime(notification.timestamp)}
                </p>

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openTransaction}
                    className="h-7 px-2 text-white/90 hover:text-white hover:bg-white/20 border border-white/30"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/20 rounded-full flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface NotificationManagerProps {
  children: React.ReactNode;
}

export const NotificationManager: React.FC<NotificationManagerProps> = ({
  children,
}) => {
  const [currentNotification, setCurrentNotification] =
    useState<TransactionNotification | null>(null);

  useEffect(() => {
    // Listen for custom notification events
    const handleNotification = (
      event: CustomEvent<TransactionNotification>,
    ) => {
      setCurrentNotification(event.detail);

      // Vibrate on mobile if supported
      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    };

    window.addEventListener(
      "wallet-transaction",
      handleNotification as EventListener,
    );

    return () => {
      window.removeEventListener(
        "wallet-transaction",
        handleNotification as EventListener,
      );
    };
  }, []);

  const handleCloseNotification = () => {
    setCurrentNotification(null);
  };

  return (
    <>
      {children}
      <MobileNotification
        notification={currentNotification}
        onClose={handleCloseNotification}
      />
    </>
  );
};

// Utility function to trigger notifications
export const showTransactionNotification = (
  notification: TransactionNotification,
) => {
  const event = new CustomEvent("wallet-transaction", { detail: notification });
  window.dispatchEvent(event);
};
