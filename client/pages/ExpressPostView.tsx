import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { getP2POrder, createTradeRoom } from "@/lib/p2p-api";
import type { P2POrder } from "@/lib/p2p-api";

export default function ExpressPostView() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [order, setOrder] = useState<P2POrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitiatingTrade, setIsInitiatingTrade] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setIsLoading(true);
      const data = await getP2POrder(orderId!);
      setOrder(data);
    } catch (error: any) {
      toast({
        title: "Failed to load order",
        description: error?.message || String(error),
        variant: "destructive",
      });
      setTimeout(() => navigate("/express/add-post"), 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateTrade = async () => {
    if (!wallet?.publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to initiate a trade",
        variant: "destructive",
      });
      return;
    }

    if (!order) return;

    if (order.creator_wallet === wallet.publicKey) {
      toast({
        title: "Cannot trade with yourself",
        description: "You cannot initiate a trade with your own order",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsInitiatingTrade(true);

      const room = await createTradeRoom({
        buyer_wallet:
          order.type === "sell" ? wallet.publicKey : order.creator_wallet,
        seller_wallet:
          order.type === "sell" ? order.creator_wallet : wallet.publicKey,
        order_id: order.id,
      });

      toast({
        title: "Trade initiated",
        description: "Entering trade chat...",
      });

      setTimeout(() => {
        navigate("/express/buy-trade", { state: { order, room } });
      }, 500);
    } catch (error: any) {
      toast({
        title: "Failed to initiate trade",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsInitiatingTrade(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 shadow max-w-sm w-full text-center">
          <h2 className="text-lg font-semibold">Order not found</h2>
          <button
            onClick={() => navigate("/express/add-post")}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const isCreator = wallet?.publicKey === order.creator_wallet;
  const rate =
    Number(order.token_amount) > 0
      ? order.pkr_amount / Number(order.token_amount)
      : 0;

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/express/add-post")}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center font-medium">Order Details</div>
          <div className="h-9 w-9" />
        </div>
      </div>

      <div className="w-full px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                order.type === "buy"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-green-100 text-green-800"
              }`}
            >
              {order.type === "buy" ? "LOOKING TO BUY" : "SELLING"}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                order.online
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {order.online ? "Online" : "Offline"}
            </span>
          </div>

          {/* Main Info */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 space-y-3">
            <div>
              <div className="text-gray-600 text-sm">Token</div>
              <div className="text-3xl font-bold">{order.token}</div>
            </div>
            <div className="flex justify-between pt-3 border-t border-purple-200">
              <div>
                <div className="text-gray-600 text-sm">Token Amount</div>
                <div className="text-lg font-semibold">
                  {Number(order.token_amount).toFixed(6)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-600 text-sm">PKR Amount</div>
                <div className="text-lg font-semibold">
                  {order.pkr_amount.toLocaleString()} PKR
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-purple-200">
              <div className="text-gray-600 text-sm">Exchange Rate</div>
              <div className="text-lg font-semibold">
                1 {order.token} = {rate.toFixed(2)} PKR
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
            <div>
              <div className="text-gray-600 mb-1">Payment Method</div>
              <div className="font-semibold capitalize">
                {order.payment_method}
              </div>
            </div>

            {order.type === "buy" && (
              <>
                <div className="border-t border-gray-200 pt-3">
                  <div className="text-gray-600 mb-1">Account Name</div>
                  <div className="font-semibold">
                    {order.account_name || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Account Number</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">
                      {order.account_number || "—"}
                    </span>
                    {order.account_number && (
                      <button
                        onClick={() =>
                          copyToClipboard(
                            order.account_number!,
                            "Account Number",
                          )
                        }
                        className="p-1 hover:bg-white rounded"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {order.type === "sell" && (
              <div className="border-t border-gray-200 pt-3">
                <div className="text-gray-600 mb-1">Wallet Address</div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs break-all">
                    {order.wallet_address || "—"}
                  </code>
                  {order.wallet_address && (
                    <button
                      onClick={() =>
                        copyToClipboard(order.wallet_address!, "Wallet Address")
                      }
                      className="p-1 hover:bg-white rounded flex-shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3">
              <div className="text-gray-500">
                Posted {new Date(order.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Actions */}
          {!isCreator && order.online && (
            <button
              onClick={handleInitiateTrade}
              disabled={isInitiatingTrade}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              <MessageSquare className="h-5 w-5" />
              {isInitiatingTrade ? "Initiating..." : "Message Seller"}
            </button>
          )}

          {isCreator && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              This is your order. Edit from your orders list.
            </div>
          )}

          {!order.online && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
              This seller is currently offline. Check back later.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
