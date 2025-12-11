import React, { useRef, useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { useOrderChat } from "@/hooks/use-order-chat";
import { useWallet } from "@/contexts/WalletContext";
import type { P2POrder } from "@/lib/p2p-api";
import { cn } from "@/lib/utils";

interface P2POrderChatProps {
  order?: P2POrder | null;
  className?: string;
}

export function P2POrderChat({ order, className }: P2POrderChatProps) {
  const { wallet } = useWallet();
  const { messages, isLoading, isSending, error, sendMessage } = useOrderChat({
    order,
    enabled: !!order,
  });
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending) return;

    await sendMessage(messageInput);
    setMessageInput("");
  };

  if (!order) return null;

  const currentUserWallet = wallet?.address;
  const isBuyer = order.buyer_wallet === currentUserWallet;
  const isSeller = order.creator_wallet === currentUserWallet;
  const userRole = isBuyer ? "Buyer" : isSeller ? "Seller" : "Unknown";

  return (
    <div
      className={cn(
        "flex flex-col h-96 bg-[#1a2847] border border-gray-300/30 rounded-lg overflow-hidden",
        className,
      )}
    >
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-300/20 bg-[#0f1e35] flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-xs font-semibold text-white uppercase">
            Order Chat
          </h3>
          <p className="text-xs text-white/60">
            {userRole} • {order.token || "Token"} - {order.amountPKR?.toFixed(2) || "0.00"} PKR
          </p>
        </div>
        <div className="text-xs text-white/40 px-2 py-1 rounded bg-white/5">
          {messages.length} messages
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-none px-4 py-3 space-y-3"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-white/50">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/40 text-xs text-center">
            <div>
              <p className="mb-1">No messages yet</p>
              <p className="text-white/30">Start a conversation with the other party</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.senderWallet === currentUserWallet;
            return (
              <div
                key={message.id}
                className={cn("flex gap-2", isCurrentUser && "flex-row-reverse")}
              >
                <div
                  className={cn(
                    "flex-1 max-w-xs px-3 py-2 rounded-lg text-xs break-words",
                    isCurrentUser
                      ? "bg-blue-600/70 text-white rounded-br-none"
                      : "bg-gray-700/50 text-white/90 rounded-bl-none",
                  )}
                >
                  {message.text}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-[10px] text-white/40 whitespace-nowrap">
                    {isCurrentUser ? "You" : message.senderRole}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-500/30 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Message Input */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-gray-300/20 bg-[#0f1e35] px-4 py-3 flex gap-2"
      >
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type message..."
          disabled={isSending}
          className="flex-1 px-3 py-2 rounded-lg bg-[#1a2540]/50 border border-gray-300/20 text-xs text-white placeholder-white/40 outline-none focus:border-blue-500/50 focus:bg-[#1a2540] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={isSending || !messageInput.trim()}
          className="px-3 py-2 rounded-lg bg-blue-600/70 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[44px]"
          title="Send message"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
