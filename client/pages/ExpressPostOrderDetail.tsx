import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getP2POrder, updateP2POrder } from "@/lib/p2p-api";
import type { P2POrder } from "@/lib/p2p-api";

export default function ExpressPostOrderDetail() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { toast } = useToast();

  const [order, setOrder] = useState<P2POrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
      setTimeout(() => navigate("/express/post-order"), 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOnline = async () => {
    if (!order) return;

    try {
      setIsSaving(true);
      const updated = await updateP2POrder(order.id, {
        online: !order.online,
      });
      setOrder(updated);
      toast({
        title: "Success",
        description: `Order is now ${updated.online ? "ONLINE" : "OFFLINE"}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to update order",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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
          <p className="text-sm text-gray-600 mt-2">
            The order you're looking for doesn't exist.
          </p>
          <button
            onClick={() => navigate("/express/post-order")}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/express/post-order")}
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
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Order Summary</h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                order.online
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {order.online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Order ID</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs">
                  {order.id.slice(0, 12)}...
                </code>
                <button
                  onClick={() => copyToClipboard(order.id, "Order ID")}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Type</span>
                <span className="font-semibold uppercase">{order.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Token</span>
                <span className="font-semibold">{order.token}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold">
                  {order.token_amount} {order.token}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">PKR Amount</span>
                <span className="font-semibold">
                  {order.pkr_amount.toLocaleString()} PKR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rate</span>
                <span className="font-semibold">
                  {(order.pkr_amount / Number(order.token_amount)).toFixed(2)}{" "}
                  PKR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-semibold capitalize">
                  {order.payment_method}
                </span>
              </div>
            </div>

            {order.type === "buy" && (
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Name</span>
                  <span className="font-semibold">
                    {order.account_name || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Number</span>
                  <span className="font-mono text-xs font-semibold">
                    {order.account_number || "—"}
                  </span>
                </div>
              </div>
            )}

            {order.type === "sell" && (
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Wallet Address</span>
                  <code className="font-mono text-xs font-semibold">
                    {order.wallet_address ? (
                      <>
                        {order.wallet_address.slice(0, 8)}...
                        {order.wallet_address.slice(-4)}
                      </>
                    ) : (
                      "—"
                    )}
                  </code>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-600">
                  {new Date(order.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate("/express/post-order")}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-3 py-2 font-medium"
            >
              Back
            </button>
            <button
              onClick={toggleOnline}
              disabled={isSaving}
              className={`flex-1 rounded-lg px-3 py-2 font-medium text-white transition-all ${
                order.online
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-500 hover:bg-red-600"
              } disabled:opacity-50`}
            >
              {isSaving
                ? "Saving..."
                : order.online
                  ? "Go Offline"
                  : "Go Online"}
            </button>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            {order.online ? (
              <p>
                ✓ Your order is visible to buyers. Buyers can contact you to
                trade.
              </p>
            ) : (
              <p>
                ��� Your order is hidden. Go online to accept trade requests.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
