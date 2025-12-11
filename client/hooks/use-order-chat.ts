import { useState, useCallback, useEffect } from "react";
import {
  ChatMessage,
  saveChatMessage,
  loadChatHistory,
  loadServerChatHistory,
} from "@/lib/p2p-chat";
import { useWallet } from "@/contexts/WalletContext";
import type { P2POrder } from "@/lib/p2p-api";

interface UseOrderChatOptions {
  order?: P2POrder | null;
  enabled?: boolean;
}

export function useOrderChat(options: UseOrderChatOptions = {}) {
  const { order, enabled = true } = options;
  const { wallet } = useWallet();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomId = order?.id || "";

  useEffect(() => {
    if (!enabled || !roomId) return;

    const loadMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await loadServerChatHistory(roomId);
        setMessages(loaded);
      } catch (err) {
        console.error("Failed to load chat history:", err);
        setError("Failed to load chat history");
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [roomId, enabled]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!roomId || !wallet || !order) {
        setError("Missing required data to send message");
        return;
      }

      if (!text.trim()) {
        setError("Message cannot be empty");
        return;
      }

      setIsSending(true);
      setError(null);

      try {
        const isBuyer = order.buyer_wallet === wallet.address;
        const isSeller = order.creator_wallet === wallet.address;
        const role = isBuyer ? "buyer" : isSeller ? "seller" : "unknown";

        if (role === "unknown") {
          throw new Error("Cannot determine user role in this order");
        }

        const message: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          roomId,
          senderWallet: wallet.address,
          senderRole: role as "buyer" | "seller",
          type: "message",
          text: text.trim(),
          timestamp: Date.now(),
        };

        try {
          const response = await fetch(
            `/api/p2p/rooms/${encodeURIComponent(roomId)}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: text.trim(),
                sender_wallet: wallet.address,
              }),
            },
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData?.error || "Failed to send message to server",
            );
          }

          saveChatMessage(message);
          setMessages((prev) => [...prev, message]);
        } catch (err) {
          saveChatMessage(message);
          setMessages((prev) => [...prev, message]);
          console.warn(
            "Message saved locally but failed to send to server:",
            err,
          );
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMsg);
        console.error("Error sending message:", err);
      } finally {
        setIsSending(false);
      }
    },
    [roomId, wallet, order],
  );

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    roomId,
  };
}
