import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Save, Edit2, Lock, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listOrders, updateOrder, deleteOrder, createOrder } from "@/lib/p2p";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";

interface Order {
  id: string;
  type: "buy" | "sell";
  amountPKR: number;
  quoteAsset: string;
  pricePKRPerQuote: number;
  paymentMethod?: string;
  accountName?: string;
  accountNumber?: string;
  walletAddress?: string;
}

const ADMIN_PASSWORD = "Pakistan##123";

export default function OrderBook() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet } = useWallet();

  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newOrder, setNewOrder] = useState({
    type: "buy" as "buy" | "sell",
    amountPKR: "",
    quoteAsset: "USDT",
    pricePKRPerQuote: "",
    paymentMethod: "easypaisa",
    accountName: "",
    accountNumber: "",
    walletAddress: "",
  });

  const load = async () => {
    try {
      setIsLoading(true);
      const res = await listOrders("global");
      setOrders((res.orders || []) as Order[]);
    } catch (e: any) {
      toast({
        title: "Failed to load orders",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAuthCheck = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      toast({
        title: "Authentication successful",
        description: "Admin access granted",
      });
    } else {
      toast({
        title: "Invalid credentials",
        description: "Please enter the correct admin password",
        variant: "destructive",
      });
    }
  };

  const handleCreateOrder = async () => {
    try {
      if (
        !newOrder.amountPKR ||
        !newOrder.pricePKRPerQuote ||
        Number(newOrder.amountPKR) <= 0 ||
        Number(newOrder.pricePKRPerQuote) <= 0
      ) {
        toast({
          title: "Invalid input",
          description: "Please fill all fields with valid values",
          variant: "destructive",
        });
        return;
      }

      if (
        newOrder.type === "sell" &&
        (!newOrder.accountName || !newOrder.accountNumber)
      ) {
        toast({
          title: "Invalid input",
          description:
            "Please fill account name and account number for sell orders",
          variant: "destructive",
        });
        return;
      }

      if (newOrder.type === "buy" && !newOrder.walletAddress) {
        toast({
          title: "Invalid input",
          description: "Please fill wallet address for buy orders",
          variant: "destructive",
        });
        return;
      }

      // Use the admin password as the token for creating orders
      const orderData: any = {
        side: newOrder.type,
        amountPKR: Number(newOrder.amountPKR),
        quoteAsset: newOrder.quoteAsset,
        pricePKRPerQuote: Number(newOrder.pricePKRPerQuote),
        paymentMethod: newOrder.paymentMethod,
        roomId: "global",
        createdBy: wallet?.publicKey || wallet?.address || "admin",
      };

      if (newOrder.type === "sell") {
        orderData.accountName = newOrder.accountName;
        orderData.accountNumber = newOrder.accountNumber;
      } else if (newOrder.type === "buy") {
        orderData.walletAddress = newOrder.walletAddress;
      }

      await createOrder(orderData, adminPassword);

      toast({
        title: "Success",
        description: "Order created successfully",
      });

      setNewOrder({
        type: "buy",
        amountPKR: "",
        quoteAsset: "USDC",
        pricePKRPerQuote: "",
        paymentMethod: "easypaisa",
        accountName: "",
        accountNumber: "",
        walletAddress: "",
      });
      setShowCreateForm(false);
      await load();
    } catch (e: any) {
      toast({
        title: "Failed to create order",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  const handleEditOrder = (orderId: string) => {
    setEditingId(orderId);
  };

  const handleSaveOrder = async (order: Order) => {
    try {
      const updateData: any = {
        amountPKR: Number(order.amountPKR),
        quoteAsset: String(order.quoteAsset),
        pricePKRPerQuote: Number(order.pricePKRPerQuote),
      };

      if (order.type === "sell") {
        updateData.accountName = order.accountName;
        updateData.accountNumber = order.accountNumber;
      } else if (order.type === "buy") {
        updateData.walletAddress = order.walletAddress;
      }

      await updateOrder(order.id, updateData, adminPassword);
      toast({
        title: "Success",
        description: "Order updated successfully",
      });
      setEditingId(null);
      await load();
    } catch (e: any) {
      toast({
        title: "Failed to save",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteOrder(orderId, adminPassword);
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e: any) {
      toast({
        title: "Failed to delete",
        description: String(e?.message || e),
        variant: "destructive",
      });
    }
  };

  const updateOrderField = (
    orderId: string,
    field: keyof Order,
    value: any,
  ) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, [field]: value } : o)),
    );
  };

  const filteredOrders = orders.filter((o) => o.type === activeTab);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
          <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/express/pay")}
              className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 text-center font-medium text-sm">
              Admin Access
            </div>

            <div className="h-9 w-9" />
          </div>
        </div>

        {/* Authentication Card */}
        <div className="w-full px-4 py-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="text-center">
              <Lock className="h-12 w-12 text-[hsl(var(--primary))] mx-auto mb-2" />
              <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">
                Admin Authentication
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Enter admin password to manage orders
              </p>
            </div>

            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleAuthCheck();
                }}
                placeholder="Enter admin password"
                className="w-full border border-[hsl(var(--border))] rounded-xl px-4 py-3 bg-[hsl(var(--input))] text-sm text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
              />
            </div>

            <Button
              onClick={handleAuthCheck}
              className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[hsl(var(--primary))] to-blue-600 hover:from-[hsl(var(--primary))]/90 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
            >
              Unlock Admin Panel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/express/pay")}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center font-medium text-sm">
            Order Management
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsAuthenticated(false)}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-transparent text-[hsl(var(--foreground))] focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent"
            aria-label="Logout"
          >
            <Lock className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Buy/Sell Tabs */}
        <div className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 gap-0 p-1 bg-[hsl(var(--secondary))]">
            <button
              onClick={() => setActiveTab("buy")}
              className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                activeTab === "buy"
                  ? "bg-white text-[hsl(var(--foreground))] shadow-md"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              Buy Orders
            </button>
            <button
              onClick={() => setActiveTab("sell")}
              className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                activeTab === "sell"
                  ? "bg-white text-[hsl(var(--foreground))] shadow-md"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              Sell Orders
            </button>
          </div>

          {/* Add New Order Button */}
          <div className="px-4 py-3 border-t border-[hsl(var(--border))]">
            <Button
              onClick={() => {
                setNewOrder({
                  type: activeTab,
                  amountPKR: "",
                  quoteAsset: "USDC",
                  pricePKRPerQuote: "",
                  paymentMethod: "easypaisa",
                  accountName: "",
                  accountNumber: "",
                  walletAddress: "",
                });
                setShowCreateForm(true);
              }}
              className="w-full h-10 rounded-lg bg-gradient-to-r from-[hsl(var(--primary))] to-blue-600 hover:from-[hsl(var(--primary))]/90 hover:to-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add{" "}
              {activeTab === "buy" ? "Buy" : "Sell"} Order
            </Button>
          </div>
        </div>

        {/* Create Order Form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Create New Order</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                  Type
                </label>
                <select
                  value={newOrder.type}
                  onChange={(e) =>
                    setNewOrder({
                      ...newOrder,
                      type: e.target.value as "buy" | "sell",
                    })
                  }
                  className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                >
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                  Token
                </label>
                <select
                  value={newOrder.quoteAsset}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, quoteAsset: e.target.value })
                  }
                  className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                >
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                  <option value="FIXERCOIN">FIXERCOIN</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                  Amount (PKR)
                </label>
                <input
                  type="number"
                  value={newOrder.amountPKR}
                  onChange={(e) =>
                    setNewOrder({ ...newOrder, amountPKR: e.target.value })
                  }
                  placeholder="0"
                  className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                />
              </div>
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                  Price/Unit
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newOrder.pricePKRPerQuote}
                  onChange={(e) =>
                    setNewOrder({
                      ...newOrder,
                      pricePKRPerQuote: e.target.value,
                    })
                  }
                  placeholder="0.00"
                  className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                />
              </div>

              {newOrder.type === "sell" ? (
                <>
                  <div>
                    <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={newOrder.accountName}
                      onChange={(e) =>
                        setNewOrder({
                          ...newOrder,
                          accountName: e.target.value,
                        })
                      }
                      placeholder="Account holder name"
                      className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={newOrder.accountNumber}
                      onChange={(e) =>
                        setNewOrder({
                          ...newOrder,
                          accountNumber: e.target.value,
                        })
                      }
                      placeholder="Account number"
                      className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                      Payment Method
                    </label>
                    <select
                      value={newOrder.paymentMethod}
                      onChange={(e) =>
                        setNewOrder({
                          ...newOrder,
                          paymentMethod: e.target.value,
                        })
                      }
                      className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                    >
                      <option value="easypaisa">EasyPaisa</option>
                      <option value="jazzcash">JazzCash</option>
                      <option value="bank">Bank Account</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                    Wallet Address
                  </label>
                  <input
                    type="text"
                    value={newOrder.walletAddress}
                    onChange={(e) =>
                      setNewOrder({
                        ...newOrder,
                        walletAddress: e.target.value,
                      })
                    }
                    placeholder="Wallet address"
                    className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCreateOrder}
                className="flex-1 h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm"
              >
                Create Order
              </Button>
              <Button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 h-9 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Orders List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              Loading orders...
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm p-6 text-center">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
              No {activeTab} orders available
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden transition-all hover:shadow-md"
              >
                {/* Order Header */}
                <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                        Order ID
                      </div>
                      <div className="font-mono text-sm font-semibold text-[hsl(var(--foreground))]">
                        {order.id.slice(0, 12)}...
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        order.type === "buy"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {order.type === "buy" ? "BUY" : "SELL"}
                    </div>
                  </div>
                </div>

                {/* Order Content */}
                <div className="p-4 space-y-3">
                  {editingId === order.id ? (
                    // Edit Mode
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                            Amount (PKR)
                          </label>
                          <input
                            type="number"
                            value={order.amountPKR}
                            onChange={(e) =>
                              updateOrderField(
                                order.id,
                                "amountPKR",
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                            Token
                          </label>
                          <select
                            value={order.quoteAsset}
                            onChange={(e) =>
                              updateOrderField(
                                order.id,
                                "quoteAsset",
                                e.target.value,
                              )
                            }
                            className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                          >
                            <option value="USDC">USDC</option>
                            <option value="SOL">SOL</option>
                            <option value="FIXERCOIN">FIXERCOIN</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                            Price (PKR/{order.quoteAsset})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={order.pricePKRPerQuote}
                            onChange={(e) =>
                              updateOrderField(
                                order.id,
                                "pricePKRPerQuote",
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                          />
                        </div>
                        {order.type === "sell" ? (
                          <>
                            <div>
                              <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                                Account Name
                              </label>
                              <input
                                type="text"
                                value={order.accountName || ""}
                                onChange={(e) =>
                                  updateOrderField(
                                    order.id,
                                    "accountName",
                                    e.target.value,
                                  )
                                }
                                placeholder="Account holder name"
                                className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                                Account Number
                              </label>
                              <input
                                type="text"
                                value={order.accountNumber || ""}
                                onChange={(e) =>
                                  updateOrderField(
                                    order.id,
                                    "accountNumber",
                                    e.target.value,
                                  )
                                }
                                placeholder="Account number"
                                className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                                Payment Method
                              </label>
                              <select
                                value={order.paymentMethod || "easypaisa"}
                                onChange={(e) =>
                                  updateOrderField(
                                    order.id,
                                    "paymentMethod",
                                    e.target.value,
                                  )
                                }
                                className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                              >
                                <option value="easypaisa">EasyPaisa</option>
                                <option value="jazzcash">JazzCash</option>
                                <option value="bank">Bank Account</option>
                              </select>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2">
                            <label className="text-xs text-[hsl(var(--muted-foreground))] font-medium block mb-1">
                              Wallet Address
                            </label>
                            <input
                              type="text"
                              value={order.walletAddress || ""}
                              onChange={(e) =>
                                updateOrderField(
                                  order.id,
                                  "walletAddress",
                                  e.target.value,
                                )
                              }
                              placeholder="Wallet address"
                              className="w-full border border-[hsl(var(--border))] rounded-lg px-3 py-2 bg-[hsl(var(--input))] text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/20"
                            />
                          </div>
                        )}
                      </div>

                      {/* Action Buttons - Edit Mode */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleSaveOrder(order)}
                          className="flex-1 h-9 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm flex items-center justify-center gap-1"
                        >
                          <Save className="h-4 w-4" /> Save
                        </Button>
                        <Button
                          onClick={() => setEditingId(null)}
                          className="flex-1 h-9 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium text-sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                            Amount
                          </div>
                          <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                            {Number(order.amountPKR).toLocaleString()} PKR
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                            Token
                          </div>
                          <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                            {order.quoteAsset}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                            Rate
                          </div>
                          <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                            {Number(order.pricePKRPerQuote).toFixed(2)}
                          </div>
                        </div>
                        {order.type === "sell" ? (
                          <>
                            <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                Account Name
                              </div>
                              <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                                {order.accountName || "N/A"}
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-[hsl(var(--secondary))]">
                              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                Account Number
                              </div>
                              <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                                {order.accountNumber || "N/A"}
                              </div>
                            </div>
                            <div className="col-span-2 p-2 rounded-lg bg-[hsl(var(--secondary))]">
                              <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                Payment Method
                              </div>
                              <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                                {order.paymentMethod || "N/A"}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2 p-2 rounded-lg bg-[hsl(var(--secondary))]">
                            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                              Wallet Address
                            </div>
                            <div className="font-semibold text-sm text-[hsl(var(--foreground))] break-all">
                              {order.walletAddress || "N/A"}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons - View Mode */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleEditOrder(order.id)}
                          className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-1"
                        >
                          <Edit2 className="h-4 w-4" /> Edit
                        </Button>
                        <Button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center justify-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
