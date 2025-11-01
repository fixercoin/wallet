import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, AlertCircle, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { useExpressP2P } from "@/contexts/ExpressP2PContext";
import { listOrders, ADMIN_WALLET, API_BASE } from "@/lib/p2p";
import type { P2POrder } from "@/lib/p2p-api";
import { p2pPriceService } from "@/lib/services/p2p-price";
import { broadcastNotification, type ChatNotification } from "@/lib/p2p-chat";
import { useDurableRoom } from "@/hooks/useDurableRoom";

type TabType = "buy" | "sell";
type PaymentMethod = "easypaisa" | "jazzcash" | "bank";

interface Order {
  id: string;
  type: "buy" | "sell";
  token: string;
  pricePkr: number;
  minToken: number;
  maxToken: number;
  paymentMethod: string;
  amountPKR?: number;
  quoteAsset?: string;
  pricePKRPerQuote?: number;
  paymentDetails?: {
    accountName: string;
    accountNumber: string;
  };
}

export default function ExpressPay() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet, tokens } = useWallet();

  const [activeTab, setActiveTab] = useState<TabType>("buy");
  const [spendAmount, setSpendAmount] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USDC");
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentMethod>("easypaisa");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [showBuyConfirmation, setShowBuyConfirmation] = useState(false);
  const [showSellConfirmation, setShowSellConfirmation] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { exchangeRate, setExchangeRate, isAdmin, setIsAdmin } =
    useExpressP2P();

  const { events, send } = useDurableRoom("global", API_BASE);

  // Online/Offline status (visible to all users; toggle only by admin)
  const [isBuyOnline, setIsBuyOnline] = useState<boolean>(false);
  const [isSellOnline, setIsSellOnline] = useState<boolean>(false);

  // Token-specific PKR rate (USDC uses exchangeRate; SOL/FIXERCOIN fetched via service)
  const [selectedRate, setSelectedRate] = useState<number>(exchangeRate);

  useEffect(() => {
    let cancelled = false;
    const loadRate = async () => {
      try {
        if (selectedCurrency === "USDC") {
          if (!cancelled) setSelectedRate(exchangeRate);
          return;
        }
        const rate = await p2pPriceService.getTokenPrice(
          selectedCurrency as "USDC" | "SOL" | "FIXERCOIN",
        );
        if (!cancelled && typeof rate === "number" && rate > 0) {
          setSelectedRate(rate);
        }
      } catch {
        if (!cancelled) setSelectedRate(exchangeRate);
      }
    };
    loadRate();
    return () => {
      cancelled = true;
    };
  }, [selectedCurrency, exchangeRate]);

  const currencies = ["USDC", "SOL", "FIXERCOIN"];
  const paymentMethods = [
    { id: "easypaisa", label: "EasyPaisa" },
    { id: "jazzcash", label: "JazzCash" },
    { id: "bank", label: "Bank Account" },
  ] as const;

  // Check if user is admin
  useEffect(() => {
    const userWalletAddress = wallet?.publicKey || wallet?.address || "";
    setIsAdmin(userWalletAddress === ADMIN_WALLET);
  }, [wallet, setIsAdmin]);

  // Handle sell confirmation when user clicks button
  const handleSellClick = () => {
    if (!wallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!spendAmount || Number(spendAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid token amount",
        variant: "destructive",
      });
      return;
    }

    const tokenAmount = Number(spendAmount);
    if (walletBalance < tokenAmount) {
      toast({
        title: "Insufficient balance",
        description: `You have ${walletBalance} ${selectedCurrency} but need ${tokenAmount.toFixed(6)}`,
        variant: "destructive",
      });
      return;
    }

    setShowSellConfirmation(true);
  };

  const receivedAmount = useMemo(() => {
    const amt = Number(spendAmount);
    if (!isFinite(amt) || amt <= 0) return 0;
    if (!isFinite(selectedRate) || selectedRate <= 0) return 0;
    return activeTab === "sell" ? amt * selectedRate : amt / selectedRate;
  }, [spendAmount, selectedRate, activeTab]);

  // Get wallet balance for selected currency (in sell mode)
  const walletBalance = useMemo(() => {
    if (activeTab !== "sell" || !tokens) return 0;
    const token = tokens.find(
      (t) => t.symbol?.toUpperCase() === selectedCurrency.toUpperCase(),
    );
    return token?.balance || 0;
  }, [activeTab, selectedCurrency, tokens]);

  // Load available buy orders when in buy tab
  useEffect(() => {
    if (activeTab === "buy") {
      loadOrders();
    }
  }, [activeTab]);

  // Listen for admin status via snapshot and chat; also auto-open chat on payment events
  useEffect(() => {
    const last = events[events.length - 1];
    if (!last) return;

    if (last.kind === "snapshot") {
      const s: any = last.data;
      const st = s?.admin_status;
      if (st) {
        if (typeof st.buyOnline === "boolean") setIsBuyOnline(!!st.buyOnline);
        if (typeof st.sellOnline === "boolean")
          setIsSellOnline(!!st.sellOnline);
      }
      return;
    }

    if (last.kind !== "chat") return;
    const txt = last.data?.text || "";
    try {
      const payload = JSON.parse(txt);
      if (payload && payload.type === "admin_status") {
        if (payload.scope === "buy" && typeof payload.online === "boolean") {
          setIsBuyOnline(!!payload.online);
        } else if (
          payload.scope === "sell" &&
          typeof payload.online === "boolean"
        ) {
          setIsSellOnline(!!payload.online);
        } else {
          if (typeof payload.buyOnline === "boolean")
            setIsBuyOnline(!!payload.buyOnline);
          if (typeof payload.sellOnline === "boolean")
            setIsSellOnline(!!payload.sellOnline);
        }
      }

      // Auto-open chat on payment events for involved parties (buyer/seller)
      const userWalletAddress =
        wallet?.publicKey || (wallet as any)?.address || "";
      if (
        payload?.type === "buyer_paid" &&
        (isAdmin ||
          (!!payload?.buyer_wallet &&
            payload.buyer_wallet === userWalletAddress))
      ) {
        const orderObj: any = {
          id: payload.orderId || `order-${Date.now()}`,
          type: "sell",
          token: payload.token,
          amountPKR: Number(payload.amountPKR || 0),
          pricePKRPerQuote: selectedRate,
          quoteAsset: payload.token,
          paymentMethod: payload.paymentMethod || "easypaisa",
        };
        navigate("/express/buy-trade", {
          state: {
            order: orderObj,
            openChat: true,
            initialPhase: "awaiting_seller_approval",
          },
        });
        return;
      }
      if (
        (payload?.type === "seller_transferred" ||
          payload?.type === "seller_sent") &&
        (isAdmin ||
          (!!payload?.seller_wallet &&
            payload.seller_wallet === userWalletAddress))
      ) {
        const orderObj: any = {
          id: payload.orderId || `sell-${Date.now()}`,
          type: "sell",
          token: payload.token,
          amountPKR: Number(payload.amountPKR || 0),
          pricePKRPerQuote: selectedRate,
          quoteAsset: payload.token,
          paymentMethod: "easypaisa",
        };
        navigate("/express/buy-trade", {
          state: {
            order: orderObj,
            openChat: true,
            initialPhase: "seller_transferred",
          },
        });
        return;
      }
    } catch {}
  }, [events, isAdmin, navigate, selectedRate, wallet]);

  const setBuyStatus = (online: boolean) => {
    setIsBuyOnline(online);
    try {
      send?.({
        type: "chat",
        text: JSON.stringify({ type: "admin_status", scope: "buy", online }),
      });
    } catch {}
  };
  const setSellStatus = (online: boolean) => {
    setIsSellOnline(online);
    try {
      send?.({
        type: "chat",
        text: JSON.stringify({ type: "admin_status", scope: "sell", online }),
      });
    } catch {}
  };

  const loadOrders = async () => {
    try {
      setIsLoadingOrders(true);
      const res = await listOrders("global");
      // Filter for sell orders (sellers listing their tokens)
      const sellOrders = (res.orders || []).filter(
        (o: any) => o.type === "sell",
      );
      setOrders(sellOrders as Order[]);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleBuyClick = () => {
    if (!wallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!spendAmount || Number(spendAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid PKR amount",
        variant: "destructive",
      });
      return;
    }

    // For buy, show confirmation with seller details
    if (activeTab === "buy") {
      // Use admin as default seller for now
      const seller: Order = {
        id: `seller-${Date.now()}`,
        type: "sell",
        token: selectedCurrency,
        pricePkr: selectedRate,
        minToken: 0,
        maxToken: 10000,
        paymentMethod: "easypaisa",
        amountPKR: Number(spendAmount),
        quoteAsset: selectedCurrency,
        pricePKRPerQuote: selectedRate,
        paymentDetails: {
          accountName: "ameer nawaz khan",
          accountNumber: "03107044833",
        },
      };
      setSelectedSeller(seller);
      setShowBuyConfirmation(true);
      return;
    }

    // For sell, show sell confirmation
    handleSellClick();
  };

  const handleBuyApprove = async () => {
    try {
      if (!wallet || !selectedSeller) {
        toast({
          title: "Error",
          variant: "destructive",
        });
        return;
      }

      setIsProcessing(true);

      toast({
        title: "Payment confirmed",
        description: "Waiting for seller to verify payment...",
      });

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send prompt message to seller feed
      try {
        send?.({
          type: "chat",
          text: JSON.stringify({
            type: "buyer_paid",
            orderId: selectedSeller.id,
            amountPKR: Number(spendAmount),
            token: selectedCurrency,
            paymentMethod: "easypaisa",
            buyer_wallet: wallet?.publicKey || (wallet as any)?.address || "",
          }),
        });
        const notif: ChatNotification = {
          type: "status_change",
          roomId: selectedSeller.id,
          initiatorWallet:
            (wallet?.publicKey as string) ||
            ((wallet as any)?.address as string) ||
            "",
          initiatorRole: "buyer",
          message: `Buyer marked payment paid: PKR ${Number(spendAmount).toFixed(2)} (${selectedCurrency})`,
          data: {
            orderId: selectedSeller.id,
            amountPKR: Number(spendAmount),
            token: selectedCurrency,
            paymentMethod: "easypaisa",
          },
          timestamp: Date.now(),
        };
        broadcastNotification(send, notif);
      } catch {}

      setShowBuyConfirmation(false);

      // Navigate to chat window (BuyTrade page) and open chat
      navigate("/express/buy-trade", {
        state: {
          order: selectedSeller,
          openChat: true,
          initialPhase: "awaiting_seller_approval",
        },
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSellApprove = async () => {
    try {
      if (!wallet) {
        toast({
          title: "Wallet not connected",
          variant: "destructive",
        });
        return;
      }

      setIsProcessing(true);

      // Validate sell amount
      if (!spendAmount || Number(spendAmount) <= 0) {
        toast({
          title: "Invalid amount",
          variant: "destructive",
        });
        return;
      }

      // Validate user has sufficient balance
      const tokenAmount = Number(spendAmount);
      if (walletBalance < tokenAmount) {
        toast({
          title: "Insufficient balance",
          description: `You have ${walletBalance} ${selectedCurrency} but need ${tokenAmount.toFixed(6)}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Transfer initiated",
        description: `Send ${tokenAmount.toFixed(6)} ${selectedCurrency} to ${ADMIN_WALLET}`,
      });

      // Simulate delay for transaction
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: "Transfer marked paid",
        description: `${Number(spendAmount).toFixed(6)} ${selectedCurrency} marked as transferred`,
      });

      try {
        const roomId = `sell-${Date.now()}`;
        send?.({
          type: "chat",
          text: JSON.stringify({
            type: "seller_sent",
            orderId: roomId,
            to: ADMIN_WALLET,
            token: selectedCurrency,
            amountToken: tokenAmount,
            amountPKR: tokenAmount * selectedRate,
            seller_wallet: wallet?.publicKey || (wallet as any)?.address || "",
          }),
        });
        const notif: ChatNotification = {
          type: "status_change",
          roomId,
          initiatorWallet:
            (wallet?.publicKey as string) ||
            ((wallet as any)?.address as string) ||
            "",
          initiatorRole: "seller",
          message: `Seller sent ${tokenAmount.toFixed(6)} ${selectedCurrency} to ${ADMIN_WALLET}`,
          data: {
            orderId: roomId,
            token: selectedCurrency,
            amountToken: tokenAmount,
            amountPKR: tokenAmount * selectedRate,
          },
          timestamp: Date.now(),
        };
        broadcastNotification(send, notif);

        setShowSellConfirmation(false);

        // Navigate to chat window (BuyTrade page) and open chat for seller
        navigate("/express/buy-trade", {
          state: {
            order: {
              id: roomId,
              type: "sell",
              token: selectedCurrency,
              amountPKR: Number(spendAmount) * selectedRate,
              pricePKRPerQuote: selectedRate,
              quoteAsset: selectedCurrency,
              paymentMethod: "easypaisa",
            },
            openChat: true,
            initialPhase: "seller_transferred",
          },
        });
      } catch {}
    } catch (error: any) {
      toast({
        title: "Transfer failed",
        description: error?.message || "Failed to send tokens",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdminPanel = () => {
    navigate("/express/orderbook");
  };

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-[#FF7A5C]/10 text-white focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 text-center font-medium text-sm">
            EXPRESS P2P SERVICE
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <div className="bg-transparent p-6 space-y-5 text-white">
          {/* Tab Selection */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#0f1520]/50 rounded-xl">
            <button
              onClick={() => setActiveTab("buy")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === "buy"
                  ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white shadow-lg"
                  : "text-white hover:text-white"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setActiveTab("sell")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === "sell"
                  ? "bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] text-white shadow-lg"
                  : "text-white hover:text-white"
              }`}
            >
              Sell
            </button>
          </div>

          {activeTab === "sell" && (
            <>
              {/* Wallet Balance Info (Sell Mode) */}
              <div className="p-3 rounded-lg bg-[#1a2540]/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white mb-1">
                      Your {selectedCurrency} Balance
                    </div>
                    <div className="text-lg font-bold text-white">
                      {walletBalance.toFixed(6)}
                    </div>
                  </div>
                  {walletBalance > 0 && (
                    <Check className="h-6 w-6 text-[#FF7A5C]" />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Spend Section (Buy) */}
          {activeTab !== "sell" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs mb-1 text-white">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">Status:</span>
                  <span className={isBuyOnline ? "text-white" : "text-white"}>
                    {isBuyOnline ? "Online" : "Offline"}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/50 text-white hover:bg-white/20"
                      onClick={() => setBuyStatus(true)}
                    >
                      Online
                    </Button>
                    <Button
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/50 text-white hover:bg-white/10"
                      onClick={() => setBuyStatus(false)}
                    >
                      Offline
                    </Button>
                  </div>
                )}
              </div>
              <label className="text-xs text-white font-medium">Spend</label>
              <div className="relative rounded-xl border border-[#FF7A5C]/30 bg-[#1a2540]/50 overflow-hidden focus-within:border-[#FF7A5C]/60 transition-colors">
                <div className="flex items-center">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent px-4 py-3 text-sm font-medium outline-none text-white placeholder-gray-500"
                  />
                  <div className="px-4 py-3 bg-gradient-to-r from-[#FF7A5C]/20 to-[#FF5A8C]/20 text-xs font-bold text-white">
                    PKR
                  </div>
                </div>
              </div>
              <div className="text-xs text-white">Minimum: 1,000 PKR</div>
            </div>
          )}

          {/* Token Selection / Receive Section */}
          <div className="space-y-2">
            <label className="text-xs text-white font-medium">
              {activeTab === "sell" ? "Sell Token" : "Receive"}
            </label>
            <div className="rounded-xl border border-[#FF7A5C]/30 bg-[#1a2540]/50 overflow-hidden focus-within:border-[#FF7A5C]/60 transition-colors">
              <div className="flex items-center h-11">
                <div className="flex-1 px-4 py-3 text-sm font-medium text-white">
                  {activeTab === "sell"
                    ? ""
                    : receivedAmount > 0
                      ? receivedAmount.toFixed(6)
                      : "0"}
                </div>
                <div className="relative">
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="appearance-none bg-gradient-to-r from-[#FF7A5C]/20 to-[#FF5A8C]/20 px-3 py-3 pr-7 text-xs font-bold text-white outline-none cursor-pointer"
                    style={{ color: "white" }}
                  >
                    {currencies.map((cur) => (
                      <option key={cur} value={cur} style={{ color: "black" }}>
                        {cur}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-white">
                1 {selectedCurrency} ={" "}
                {isFinite(selectedRate) && selectedRate > 0
                  ? selectedRate.toFixed(2)
                  : "-"}{" "}
                PKR
              </span>
            </div>
          </div>

          {activeTab === "sell" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs mb-1 text-white">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">Status:</span>
                  <span className={isSellOnline ? "text-white" : "text-white"}>
                    {isSellOnline ? "Online" : "Offline"}
                  </span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/50 text-white hover:bg-white/20"
                      onClick={() => setSellStatus(true)}
                    >
                      Online
                    </Button>
                    <Button
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/50 text-white hover:bg-white/10"
                      onClick={() => setSellStatus(false)}
                    >
                      Offline
                    </Button>
                  </div>
                )}
              </div>
              <label className="text-xs text-white font-medium">
                Sell Amount {selectedCurrency}
              </label>
              <div className="relative rounded-xl border border-[#FF7A5C]/30 bg-[#1a2540]/50 overflow-hidden focus-within:border-[#FF7A5C]/60 transition-colors">
                <div className="flex items-center">
                  <input
                    type="number"
                    min={0}
                    step={0.000001}
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent px-4 py-3 text-sm font-medium outline-none text-white placeholder-gray-500"
                  />
                  <div className="px-4 py-3 bg-gradient-to-r from-[#FF7A5C]/20 to-[#FF5A8C]/20 text-xs font-bold text-white">
                    {selectedCurrency}
                  </div>
                </div>
              </div>
              <div className="text-xs text-white">
                {walletBalance > 0 &&
                  `Available: ${walletBalance.toFixed(6)} ${selectedCurrency}`}
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <Button
            onClick={() => {
              if (activeTab === "buy") {
                handleBuyClick();
              } else {
                handleSellClick();
              }
            }}
            disabled={isProcessing}
            className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] transition-all shadow-lg hover:shadow-2xl disabled:opacity-50"
          >
            {isProcessing
              ? "Processing..."
              : activeTab === "buy"
                ? "Buy with PKR"
                : "Sell for PKR"}
          </Button>

          {/* Footer Link */}
          <div className="text-center">
            <button className="text-xs text-white hover:text-[#FF7A5C] underline transition-colors">
              Login to post offers
            </button>
          </div>
        </div>
      </div>

      {/* Buy Confirmation Modal */}
      {showBuyConfirmation && selectedSeller && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#1f2d48]/95 to-[#1a2540]/95 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#FF7A5C]/30">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Seller Details
              </h2>
              <button
                onClick={() => setShowBuyConfirmation(false)}
                className="text-white hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Transaction Summary */}
              <div className="space-y-2 pb-4 border-b border-[#FF7A5C]/30 text-white">
                <div className="flex justify-between items-center p-2 text-white">
                  <span className="text-sm text-white">You Pay</span>
                  <span className="font-bold text-white">
                    {Number(spendAmount).toLocaleString()} PKR
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 text-white">
                  <span className="text-sm text-white">You Receive</span>
                  <span className="font-bold text-white">
                    {receivedAmount.toFixed(6)} {selectedCurrency}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 text-white">
                  <span className="text-sm text-white">Rate</span>
                  <span className="font-bold text-white">
                    1 {selectedCurrency} ={" "}
                    {isFinite(selectedRate) && selectedRate > 0
                      ? selectedRate
                      : "-"}{" "}
                    PKR
                  </span>
                </div>
              </div>

              {/* Seller Details */}
              <div className="space-y-3 text-white">
                <h3 className="font-semibold text-sm text-white">
                  Seller Information
                </h3>

                <div className="p-3 rounded-lg bg-[#1a2540]/50">
                  <div className="text-xs text-white mb-1">Account Name</div>
                  <div className="font-semibold text-white">
                    {selectedSeller.paymentDetails?.accountName ||
                      "Not provided"}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#1a2540]/50">
                  <div className="text-xs text-white mb-1">Account Number</div>
                  <div className="font-semibold text-white font-mono">
                    {selectedSeller.paymentDetails?.accountNumber ||
                      "Not provided"}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#1a2540]/50">
                  <div className="text-xs text-white mb-1">Payment Method</div>
                  <div className="font-semibold text-white capitalize">
                    {selectedSeller.paymentMethod || "easypaisa"}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FF7A5C]/10 text-white">
                <p className="text-xs text-white">
                  ✓ After payment, chat window will open to confirm with seller.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-[#1a2540]/50 flex gap-3 flex-shrink-0">
              <Button
                onClick={() => setShowBuyConfirmation(false)}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-lg bg-gray-700/40 hover:bg-gray-700/60 text-white font-medium text-sm transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBuyApprove}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white font-medium text-sm transition-all"
              >
                {isProcessing ? "Processing..." : "I Have Paid"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sell Confirmation Modal */}
      {showSellConfirmation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#1f2d48]/95 to-[#1a2540]/95 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#FF7A5C]/30">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] px-6 py-4 flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Confirm Sell Transaction
              </h2>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-3 text-white">
                <div className="flex justify-between items-center p-3 bg-[#1a2540]/50 rounded-lg border border-[#FF7A5C]/20 text-white">
                  <span className="text-sm text-white">Token to Send</span>
                  <span className="font-bold text-white">
                    {selectedCurrency}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-[#1a2540]/50 rounded-lg border border-[#FF7A5C]/20 text-white">
                  <span className="text-sm text-white">Amount</span>
                  <span className="font-bold text-white">
                    {Number(spendAmount || 0).toFixed(6)}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-[#1a2540]/50 rounded-lg border border-[#FF7A5C]/20 text-white">
                  <span className="text-sm text-white">PKR Amount</span>
                  <span className="font-bold text-white">
                    {receivedAmount.toLocaleString()} PKR
                  </span>
                </div>

                <div className="p-3 bg-[#1a2540]/50 rounded-lg border border-[#FF7A5C]/20 text-white">
                  <div className="text-xs text-white mb-1">
                    Transfer To Address
                  </div>
                  <div className="font-mono text-sm break-all text-white">
                    {ADMIN_WALLET}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#FF7A5C]/10 text-white">
                <p className="text-xs text-white">
                  ✓ Tokens will be transferred to buyer. Chat window will open
                  after confirmation.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-[#1a2540]/50 flex gap-3 flex-shrink-0">
              <Button
                onClick={() => setShowSellConfirmation(false)}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-lg bg-gray-700/40 hover:bg-gray-700/60 text-white font-medium text-sm transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSellApprove}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-lg bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white font-medium text-sm transition-all"
              >
                {isProcessing ? "Processing..." : "I Have Sent"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
