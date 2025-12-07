import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/p2p";
import {
  broadcastNotification,
  saveNotification,
  type ChatNotification,
} from "@/lib/p2p-chat";

export default function AdminBroadcast() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId") || params.get("roomId") || "global";
  const sender = params.get("sender") || "";
  const text =
    params.get("text") ||
    "i have paid msg ///using p2p buy function at admin wallet dashboard";
  const typeParam = params.get("type") || "payment_received";

  const notification: ChatNotification = useMemo(
    () => ({
      type: (typeParam as any) || "payment_received",
      roomId: orderId,
      initiatorWallet: sender || "unknown",
      initiatorRole: "buyer",
      message: text,
      data: { orderId, source: "admin-broadcast" },
      timestamp: Date.now(),
    }),
    [orderId, sender, text, typeParam],
  );

  const [sent, setSent] = useState(false);

  const doSend = () => {
    saveNotification(notification);
    setSent(true);
  };

  useEffect(() => {
    // auto-send on mount once
    doSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full space-y-4">
        <h1 className="text-xl font-semibold">Admin Broadcast Utility</h1>
        <div className="text-sm text-gray-600">
          Room/Order ID: <code>{orderId}</code>
        </div>
        <div className="text-sm text-gray-600 break-all">
          Sender: <code>{sender || "(not provided)"}</code>
        </div>
        <div className="text-sm text-gray-600 break-words">
          Message: <code>{text}</code>
        </div>
        <div className="text-sm text-gray-600">
          Type: <code>{typeParam}</code>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button className="wallet-button-primary" onClick={doSend}>
            Resend
          </Button>
          {sent && <span className="text-green-600 text-sm">Sent</span>}
        </div>
      </div>
    </div>
  );
}
