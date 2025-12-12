import React, { useRef, useEffect, useState } from "react";
import {
  Send,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useOrderChat } from "@/hooks/use-order-chat";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { P2POrder } from "@/lib/p2p-api";

interface ActiveTrade {
  id: string;
  order: P2POrder;
  counterparty: string;
  status: "negotiating" | "confirmed" | "completed";
  createdAt: number;
}

interface AIBotChatProps {
  trade: ActiveTrade;
  onBack: () => void;
  onTradeUpdate: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "counterparty";
  text: string;
  timestamp: number;
  type?: "message" | "system" | "suggestion";
}

export function AIBotChat({ trade, onBack, onTradeUpdate }: AIBotChatProps) {
  const { wallet } = useWallet();
  const { messages, sendMessage, isSending } = useOrderChat({
    order: trade.order,
    enabled: !!trade.order,
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isLoadingAIResponse, setIsLoadingAIResponse] = useState(false);
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const USDT_RATE = 291.90;

  // Fetch token price on mount
  useEffect(() => {
    const fetchTokenPrice = async () => {
      if (trade.order.token === "USDT") {
        setTokenPrice(USDT_RATE);
      } else if (trade.order.token === "FIXERCOIN") {
        try {
          const response = await fetch("/api/token-price?token=FIXERCOIN");
          if (response.ok) {
            const data = await response.json();
            setTokenPrice(data.price || null);
          }
        } catch (error) {
          console.log("Could not fetch FIXERCOIN price");
        }
      }
    };
    fetchTokenPrice();
  }, [trade.order.token]);

  const getConversionText = (amount: number): string => {
    if (!tokenPrice) return "";
    const pkrAmount = amount * tokenPrice;
    return ` (${pkrAmount.toFixed(2)} PKR @ 1 ${trade.order.token} = ${tokenPrice.toFixed(2)} PKR)`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    // Initialize chat with AI bot welcome message
    const amount = trade.order.amountTokens || 0;
    const conversionText = getConversionText(amount);

    const welcomeMessage: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      sender: "ai",
      text: `Welcome to AI P2P Trading! I'm your trading assistant. I'll help facilitate this ${trade.order.type === "BUY" ? "buy" : "sell"} order for ${amount} ${trade.order.token}${conversionText}. You can start negotiating with the counterparty, and I'll provide suggestions and help with order completion.`,
      timestamp: Date.now(),
      type: "system",
    };

    setChatMessages([welcomeMessage]);
  }, [trade.order.id]);

  // Monitor order approval status
  useEffect(() => {
    const checkOrderStatus = async () => {
      try {
        const response = await fetch(`/api/p2p/orders/${trade.order.id}`);
        if (response.ok) {
          const data = await response.json();
          const order = data.order;

          // Check if order was approved
          if (order.status === "active" && trade.order.status === "pending_approval") {
            const approvalMsg: ChatMessage = {
              id: `msg-approval-${Date.now()}`,
              sender: "ai",
              text: "🎉 Your order has been approved by the admin! You can now start negotiating with buyers/sellers.",
              timestamp: Date.now(),
              type: "system",
            };
            setChatMessages((prev) => [...prev, approvalMsg]);
          }
          // Check if order was rejected
          else if (order.status === "rejected" && trade.order.status === "pending_approval") {
            const rejectionMsg: ChatMessage = {
              id: `msg-rejection-${Date.now()}`,
              sender: "ai",
              text: "❌ Your order has been rejected by the admin. Please contact support for more information.",
              timestamp: Date.now(),
              type: "system",
            };
            setChatMessages((prev) => [...prev, rejectionMsg]);
          }
        }
      } catch (error) {
        console.log("Error checking order status:", error);
      }
    };

    // Check status every 5 seconds
    const interval = setInterval(checkOrderStatus, 5000);
    return () => clearInterval(interval);
  }, [trade.order.id, trade.order.status]);

  const generateAIResponse = async (userMessage: string): Promise<string> => {
    // Simulate AI response generation based on order context
    const orderType = trade.order.type;
    const token = trade.order.token;
    const amount = trade.order.amountTokens || 0;
    const conversionText = getConversionText(amount);

    // AI suggestions based on conversation context
    const keywords = userMessage.toLowerCase();

    if (keywords.includes("price") || keywords.includes("rate")) {
      return `For this ${orderType} order of ${amount} ${token}${conversionText}, I can help you negotiate the price. What rate would you like to propose to the counterparty?`;
    }

    if (keywords.includes("complete") || keywords.includes("done")) {
      return `To complete this order of ${amount} ${token}${conversionText}, both parties need to confirm receipt/payment. Would you like me to send a completion request to the counterparty?`;
    }

    if (keywords.includes("payment") || keywords.includes("transfer")) {
      return `For payment details on your ${amount} ${token} order${conversionText}, I can help you share your preferred payment method. What method would you like to use for this transaction?`;
    }

    if (keywords.includes("confirm")) {
      return `Great! I'll help you confirm this order of ${amount} ${token}${conversionText}. Please ensure all transaction details are correct before we proceed with completion.`;
    }

    // Default AI response
    return `I understand you want to ${orderType.toLowerCase()} ${amount} ${token}${conversionText}. ${
      orderType === "BUY"
        ? "I can help you find sellers and negotiate the best rate."
        : "I can help you reach potential buyers for your tokens."
    } What would you like to do next?`;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending || isLoadingAIResponse) return;

    const userMessage = messageInput;
    setMessageInput("");

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: userMessage,
      timestamp: Date.now(),
      type: "message",
    };

    setChatMessages((prev) => [...prev, userMsg]);

    // Send to counterparty
    try {
      await sendMessage(userMessage);
    } catch (error) {
      console.error("Error sending message:", error);
    }

    // Generate AI response
    setIsLoadingAIResponse(true);
    try {
      const aiResponse = await generateAIResponse(userMessage);
      const aiMsg: ChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        text: aiResponse,
        timestamp: Date.now(),
        type: "message",
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("Error generating AI response:", error);
    } finally {
      setIsLoadingAIResponse(false);
    }
  };

  const handleCompleteOrder = async () => {
    try {
      const response = await fetch(
        `/api/p2p/orders/${trade.order.id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: wallet?.address,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to complete order");
      }

      toast.success("Order completed successfully!");
      onTradeUpdate();
      onBack();
    } catch (error) {
      console.error("Error completing order:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to complete order",
      );
    }
  };

  const currentUserWallet = wallet?.address;
  const isBuyer = trade.order.buyer_wallet === currentUserWallet;
  const isSeller = trade.order.creator_wallet === currentUserWallet;
  const userRole = isBuyer ? "Buyer" : isSeller ? "Seller" : "Unknown";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1f1f1f] to-[#2a2a2a] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#1a1a1a]/95 to-transparent backdrop-blur-sm border-b border-gray-700/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="text-gray-300 hover:text-gray-100 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 mx-4">
            <h2 className="font-semibold text-lg">
              {trade.order.type === "BUY" ? "Buy" : "Sell"} {trade.order.token}
            </h2>
            <p className="text-xs text-gray-400">
              {userRole} •{" "}
              {trade.order.amountTokens || trade.order.token_amount || "0"}{" "}
              {trade.order.token}
              {tokenPrice && (
                <span className="text-green-400 ml-1">
                  ({((trade.order.amountTokens || trade.order.token_amount || 0) * tokenPrice).toFixed(2)} PKR)
                </span>
              )}
            </p>
          </div>
          <div
            className={cn(
              "w-3 h-3 rounded-full",
              trade.status === "completed"
                ? "bg-green-500"
                : trade.status === "confirmed"
                  ? "bg-blue-500"
                  : "bg-yellow-500",
            )}
          ></div>
        </div>

        {/* Order Status Bar */}
        <div className="flex items-center gap-2 text-xs">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded",
              trade.status === "completed"
                ? "bg-green-900/30 text-green-300"
                : trade.status === "confirmed"
                  ? "bg-blue-900/30 text-blue-300"
                  : "bg-yellow-900/30 text-yellow-300",
            )}
          >
            {trade.status === "completed" && (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {trade.status === "confirmed" && (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="capitalize">{trade.status}</span>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-4"
      >
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/40 text-xs text-center">
            <div>Loading chat...</div>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.sender === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-xs px-4 py-2 rounded-lg text-sm break-words",
                  msg.sender === "user"
                    ? "bg-purple-600/80 text-white rounded-br-none"
                    : msg.sender === "ai"
                      ? "bg-blue-600/40 text-blue-100 border border-blue-500/30 rounded-bl-none"
                      : "bg-gray-700/40 text-gray-200 border border-gray-600/30 rounded-bl-none",
                  msg.type === "system" && "w-full text-center text-gray-400",
                )}
              >
                {msg.sender === "ai" && (
                  <p className="text-xs font-semibold text-blue-300 mb-1">
                    AI Assistant
                  </p>
                )}
                {msg.text}
              </div>
            </div>
          ))
        )}
        {isLoadingAIResponse && (
          <div className="flex gap-2 justify-start">
            <div className="bg-blue-600/40 border border-blue-500/30 px-4 py-3 rounded-lg rounded-bl-none text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Actions Bar */}
      {trade.status !== "completed" && (
        <div className="border-t border-gray-700/30 bg-gray-900/50 p-4 space-y-3">
          {trade.status === "confirmed" && (
            <Button
              onClick={handleCompleteOrder}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete Order
            </Button>
          )}

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              disabled={isSending || isLoadingAIResponse}
            />
            <Button
              type="submit"
              size="sm"
              disabled={
                isSending || isLoadingAIResponse || !messageInput.trim()
              }
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>

          {/* Suggestion Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                const amount = trade.order.amountTokens || 0;
                const conversionText = getConversionText(amount);
                setMessageInput(`Can we confirm the price for ${amount} ${trade.order.token}${conversionText} and proceed?`);
              }}
              variant="outline"
              size="sm"
              className="text-xs h-8 border-gray-700"
            >
              Confirm Price
            </Button>
            <Button
              onClick={() => {
                const amount = trade.order.amountTokens || 0;
                const conversionText = getConversionText(amount);
                setMessageInput(`I've completed the payment of ${amount} ${trade.order.token}${conversionText}, ready to release?`);
              }}
              variant="outline"
              size="sm"
              className="text-xs h-8 border-gray-700"
            >
              Payment Done
            </Button>
            <Button
              onClick={() => {
                const amount = trade.order.amountTokens || 0;
                setMessageInput(`I've received the ${amount} ${trade.order.token}`);
              }}
              variant="outline"
              size="sm"
              className="text-xs h-8 border-gray-700"
            >
              Crypto Received
            </Button>
            <Button
              onClick={() => {
                const amount = trade.order.amountTokens || 0;
                const conversionText = getConversionText(amount);
                setMessageInput(`Let's complete this order of ${amount} ${trade.order.token}${conversionText}`);
              }}
              variant="outline"
              size="sm"
              className="text-xs h-8 border-gray-700"
            >
              Complete Order
            </Button>
          </div>
        </div>
      )}

      {trade.status === "completed" && (
        <div className="border-t border-gray-700/30 bg-green-900/20 p-4 text-center">
          <p className="text-green-300 text-sm font-semibold">
            ✓ Order completed successfully!
          </p>
          <Button onClick={onBack} variant="outline" size="sm" className="mt-3">
            Back to Orders
          </Button>
        </div>
      )}
    </div>
  );
}
