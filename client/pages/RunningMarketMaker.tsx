import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Pause,
  Play,
  X,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import {
  botOrdersStorage,
  BotSession,
  BotOrder,
} from "@/lib/bot-orders-storage";
import { dexscreenerAPI } from "@/lib/services/dexscreener";
import { feeTransfer } from "@/lib/fee-transfer";
import { Keypair, PublicKey } from "@solana/web3.js";

export default function RunningMarketMaker() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const walletContext = useWallet();
  const wallet = walletContext?.wallet || null;
  const tokens = walletContext?.tokens || [];

  const [session, setSession] = useState<BotSession | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [executingFee, setExecutingFee] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const solToken = tokens.find((t) => t.symbol === "SOL");
  const solBalance = solToken?.balance || 0;

  const TOKEN_CONFIGS: Record<string, { symbol: string; decimals: number }> = {
    FIXERCOIN: { symbol: "FIXERCOIN", decimals: 6 },
    SOL: { symbol: "SOL", decimals: 9 },
  };

  useEffect(() => {
    console.log(
      "[RunningMarketMaker] Component mounted. SessionID:",
      sessionId,
    );

    if (!sessionId) {
      console.error("[RunningMarketMaker] No sessionId in URL");
      toast({
        title: "Invalid Session",
        description: "No session ID provided",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const allSessions = botOrdersStorage.getAllSessions();
    console.log("[RunningMarketMaker] All sessions in storage:", allSessions);
    console.log("[RunningMarketMaker] Looking for sessionId:", sessionId);

    const found = allSessions.find((s) => s.id === sessionId);

    if (found) {
      console.log("[RunningMarketMaker] Session found:", found);
      setSession(found);
      setLoading(false);
    } else {
      console.log("[RunningMarketMaker] Session NOT found!");
      console.log(
        "[RunningMarketMaker] Available IDs:",
        allSessions.map((s) => s.id),
      );
      setLoading(false);
      toast({
        title: "Session Not Found",
        description: `Could not find session: ${sessionId}`,
        variant: "destructive",
      });
      setTimeout(() => navigate("/"), 2000);
    }
  }, [sessionId, navigate, toast]);

  const checkAndConvertPendingOrders = useCallback(() => {
    if (!session || !currentPrice) return;
  }, [session, currentPrice]);

  useEffect(() => {
    if (!session) return;

    const fetchPrice = async () => {
      try {
        const token = await dexscreenerAPI.getTokenByMint(session.tokenMint);
        if (token && token.priceUsd) {
          const price = parseFloat(token.priceUsd);
          setCurrentPrice(price);
        }
      } catch (error) {
        console.error("Error fetching price:", error);
      }
    };

    fetchPrice();
    checkAndConvertPendingOrders();

    refreshIntervalRef.current = setInterval(() => {
      fetchPrice();
      checkAndConvertPendingOrders();
    }, 30000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [session, checkAndConvertPendingOrders]);

  const handlePauseResume = () => {
    if (!session) return;
    if (session.status === "running") {
      session.status = "paused";
    } else {
      session.status = "running";
    }
    botOrdersStorage.saveSession(session);
    setSession({ ...session });
  };

  const handleStopBot = () => {
    if (!session) return;
    session.status = "stopped";
    botOrdersStorage.saveSession(session);
    toast({
      title: "Bot Stopped",
      description: "Market maker bot has been stopped",
    });
    navigate("/");
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(2);
  };

  const formatAmount = (amount: number, decimals: number = 2): string => {
    return amount.toFixed(decimals);
  };

  console.log(
    "[RunningMarketMaker] Rendering. Session:",
    !!session,
    "Loading:",
    loading,
  );

  if (loading) {
    return (
      <div className="w-full md:max-w-lg mx-auto px-4 py-6 min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-lg font-semibold mb-2">
            Loading bot session...
          </div>
          <div className="text-sm text-gray-400">Session ID: {sessionId}</div>
          <div className="text-sm text-gray-400">Please wait</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full md:max-w-lg mx-auto px-4 py-6 min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <div className="text-lg font-semibold mb-2 text-red-400">
            Session Not Found
          </div>
          <div className="text-sm text-gray-400">
            The bot session could not be loaded
          </div>
          <div className="text-sm text-gray-400 mt-4">
            Redirecting to home...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:max-w-lg mx-auto px-4 py-6 min-h-screen bg-gray-900">
      <div className="pt-4 pb-4" />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 p-0 rounded-[2px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold text-sm text-white uppercase">
            Market Maker Bot
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePauseResume}
            className="h-8 w-8 p-0 rounded-[2px]"
          >
            {session.status === "running" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={handleStopBot}
            className="h-8 w-8 p-0 rounded-[2px]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center mb-8">
        <div className="w-48 h-48 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin" />
      </div>

      <Card className="mb-6 bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Token</span>
              <span className="font-semibold text-white">{session.token}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Number of Makers</span>
              <span className="font-semibold text-white">
                {session.numberOfMakers}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Order Amount</span>
              <span className="font-semibold text-white">
                {formatAmount(session.orderAmount, 4)} SOL
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Status</span>
              <span
                className={`font-semibold uppercase text-sm ${
                  session.status === "running"
                    ? "text-green-400"
                    : "text-yellow-400"
                }`}
              >
                {session.status}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/30">
        <CardContent className="pt-6">
          <div className="space-y-4 text-center">
            <div>
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">
                Current Price
              </div>
              <div className="text-3xl font-bold text-green-400">
                {currentPrice ? `$${formatPrice(currentPrice)}` : "Loading..."}
              </div>
            </div>
            {currentPrice && (
              <div className="border-t border-green-500/20 pt-3">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider">
                  Target Price
                </div>
                <div className="text-2xl font-semibold text-emerald-300">
                  ${formatPrice(currentPrice + session.priceSpread)}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Spread: ${formatPrice(session.priceSpread)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {session.buyOrders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm uppercase">
              Buy Orders
            </h3>
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
              {session.buyOrders.length}
            </span>
          </div>
          <div className="space-y-2">
            {session.buyOrders.map((order) => (
              <Card
                key={order.id}
                className="bg-transparent border-blue-500/20 hover:border-blue-500/50 transition-colors"
              >
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-blue-400" />
                        <span className="text-gray-300 font-medium">
                          Order #{order.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                          order.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400 mb-0.5">Buy Price</div>
                        <div className="text-white font-semibold">
                          ${formatPrice(order.buyPrice)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-0.5">Amount</div>
                        <div className="text-white font-semibold">
                          {formatAmount(order.solAmount, 4)} SOL
                        </div>
                      </div>
                    </div>
                    {order.tokenAmount && (
                      <div>
                        <div className="text-gray-400 text-xs mb-0.5">
                          Tokens Received
                        </div>
                        <div className="text-white font-semibold text-xs">
                          {formatAmount(order.tokenAmount, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {session.sellOrders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm uppercase">
              Sell Orders
            </h3>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
              {session.sellOrders.length}
            </span>
          </div>
          <div className="space-y-2">
            {session.sellOrders.map((order) => (
              <Card
                key={order.id}
                className="bg-transparent border-green-500/20 hover:border-green-500/50 transition-colors"
              >
                <CardContent className="pt-4 pb-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-400" />
                        <span className="text-gray-300 font-medium">
                          Order #{order.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                          order.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400 mb-0.5">Buy Price</div>
                        <div className="text-white font-semibold">
                          ${formatPrice(order.buyPrice)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-0.5">Target Sell</div>
                        <div className="text-white font-semibold">
                          ${formatPrice(order.targetSellPrice)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400 mb-0.5">
                          {order.actualSellPrice
                            ? "Actual Sell"
                            : "Target Sell"}
                        </div>
                        <div className="text-white font-semibold">
                          $
                          {formatPrice(
                            order.actualSellPrice || order.targetSellPrice,
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 mb-0.5">Tokens</div>
                        <div className="text-white font-semibold">
                          {formatAmount(order.tokenAmount || 0, 2)}
                        </div>
                      </div>
                    </div>
                    {order.solAmount && (
                      <div>
                        <div className="text-gray-400 text-xs mb-0.5">
                          SOL Received
                        </div>
                        <div className="text-white font-semibold text-xs">
                          {formatAmount(order.solAmount, 4)} SOL
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {session.buyOrders.length === 0 && session.sellOrders.length === 0 && (
        <Card className="bg-transparent border-gray-700/50">
          <CardContent className="pt-6 pb-6">
            <div className="text-center text-gray-400 text-sm">
              Waiting for orders to be placed...
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
