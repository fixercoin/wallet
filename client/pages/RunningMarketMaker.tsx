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
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { wallet, tokens } = useWallet();

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
    const loadSession = () => {
      const allSessions = botOrdersStorage.getAllSessions();
      const found = allSessions.find((s) => s.id === sessionId);
      if (found) {
        setSession(found);
        setLoading(false);
      } else {
        toast({
          title: "Session Not Found",
          variant: "destructive",
        });
        navigate("/");
      }
    };

    loadSession();
  }, [sessionId, navigate, toast]);

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

  const executeFeeDedcution = useCallback(
    async (order: BotOrder): Promise<string | null> => {
      if (!wallet || !wallet.secretKey || !wallet.publicKey) {
        toast({
          title: "Error",
          description: "Wallet not available for fee transfer",
          variant: "destructive",
        });
        return null;
      }

      if (!feeTransfer.hasEnoughSolForFee(solBalance, order.solAmount)) {
        toast({
          title: "Insufficient SOL",
          description: `Need ${feeTransfer.getTotalSolNeeded(order.solAmount).toFixed(4)} SOL for trade + fee, but only have ${solBalance.toFixed(4)} SOL`,
          variant: "destructive",
        });
        return null;
      }

      try {
        setExecutingFee(order.id);

        const tx = feeTransfer.createFeeTransferTx(wallet);
        if (!tx) {
          throw new Error("Failed to create fee transfer transaction");
        }

        try {
          const keypair = Keypair.fromSecretKey(wallet.secretKey);
          tx.sign(keypair);
        } catch (signError) {
          console.error("Error signing transaction:", signError);
          throw new Error("Failed to sign fee transfer transaction");
        }

        const serialized = tx.serialize();
        const encoded = Buffer.from(serialized).toString("base64");

        const apiUrl =
          (process.env.REACT_APP_API_URL || "").replace(/\/$/, "") + "/api/rpc";
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendTransaction",
            params: [encoded, { encoding: "base64" }],
          }),
        });

        const result = await response.json();
        if (result.error) {
          throw new Error(result.error.message || "Fee transfer failed");
        }

        const signature = result.result;
        if (!signature) {
          throw new Error("No transaction signature returned");
        }

        setExecutingFee(null);

        toast({
          title: "Fee Deducted",
          description: `0.0007 SOL transferred for trade execution`,
        });

        botOrdersStorage.markFeeDeducted(sessionId, order.id, signature);

        const updatedSession = botOrdersStorage.getCurrentSession();
        if (updatedSession) {
          setSession(updatedSession);
        }

        return signature;
      } catch (error) {
        setExecutingFee(null);
        const msg = error instanceof Error ? error.message : String(error);
        toast({
          title: "Fee Transfer Failed",
          description: msg,
          variant: "destructive",
        });
        return null;
      }
    },
    [wallet, solBalance, sessionId, toast],
  );

  const checkAndConvertPendingOrders = useCallback(() => {
    if (!session || !currentPrice) return;

    const allSessions = botOrdersStorage.getAllSessions();
    const currentSession = allSessions.find((s) => s.id === sessionId);
    if (!currentSession) return;

    let modified = false;

    for (const buyOrder of currentSession.buyOrders) {
      if (
        buyOrder.status === "completed" &&
        buyOrder.tokenAmount &&
        buyOrder.tokenAmount > 0
      ) {
        const hasSellOrder = currentSession.sellOrders.some(
          (s) =>
            s.type === "sell" &&
            s.buyPrice === buyOrder.buyPrice &&
            Math.abs(s.timestamp - buyOrder.timestamp) < 1000,
        );

        if (!hasSellOrder && currentPrice >= buyOrder.targetSellPrice) {
          botOrdersStorage.addSellOrder(
            sessionId,
            buyOrder.id,
            currentPrice,
            buyOrder.tokenAmount,
          );
          modified = true;

          toast({
            title: "Sell Order Auto-Converted",
            description: `Buy order converted to sell at ${currentPrice.toFixed(8)}`,
          });
        }
      }
    }

    if (modified) {
      const updatedSession = botOrdersStorage.getCurrentSession();
      if (updatedSession) {
        setSession(updatedSession);
      }
    }
  }, [sessionId, currentPrice, toast]);

  const handlePauseResume = () => {
    if (!session) return;

    const updatedSession = { ...session };
    updatedSession.status =
      updatedSession.status === "running" ? "paused" : "running";
    botOrdersStorage.saveSession(updatedSession);
    setSession(updatedSession);

    toast({
      title: updatedSession.status === "running" ? "Bot Resumed" : "Bot Paused",
    });
  };

  const handleStopBot = () => {
    if (!session) return;

    if (
      window.confirm(
        "Are you sure you want to stop this bot? This action cannot be undone.",
      )
    ) {
      botOrdersStorage.deleteSession(sessionId);
      toast({
        title: "Bot Stopped",
        description: "The market maker bot has been stopped",
      });
      navigate(-1);
    }
  };

  if (loading || !session) {
    return (
      <div className="w-full md:max-w-lg mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-48 h-48 mx-auto mb-4 flex items-center justify-center">
            <div className="w-48 h-48 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin" />
          </div>
          <p className="text-gray-400">Loading bot...</p>
        </div>
      </div>
    );
  }

  const tokenConfig = TOKEN_CONFIGS[session.token] || {
    symbol: session.token,
    decimals: 9,
  };
  const pendingBuyOrders = session.buyOrders.filter(
    (o) => o.status === "pending",
  );
  const completedBuyOrders = session.buyOrders.filter(
    (o) => o.status === "completed",
  );

  return (
    <div className="w-full md:max-w-lg mx-auto px-4 py-6 min-h-screen bg-gray-900">
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

      <div className="grid grid-cols-1 gap-4 mb-8">
        <Card className="border border-gray-700/40 bg-gradient-to-br from-gray-800 via-gray-800 to-gray-700">
          <CardContent className="p-4">
            <div className="text-xs text-gray-400 uppercase mb-2">
              Order Buy Price
            </div>
            <div className="text-2xl font-bold text-white">
              {currentPrice ? currentPrice.toFixed(8) : "Loading..."}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {tokenConfig.symbol} Price
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-700/40 bg-gradient-to-br from-gray-800 via-gray-800 to-gray-700">
          <CardContent className="p-4">
            <div className="text-xs text-gray-400 uppercase mb-2">
              Target Sell Price
            </div>
            <div className="text-2xl font-bold text-green-400">
              {currentPrice
                ? (session.token === "FIXERCOIN"
                    ? currentPrice + 0.000002
                    : currentPrice + 2
                  ).toFixed(8)
                : "Loading..."}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Spread: {session.token === "FIXERCOIN" ? "+0.00000200" : "+2"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">
            Pending Buy Orders ({pendingBuyOrders.length})
          </h3>
          {pendingBuyOrders.length === 0 ? (
            <p className="text-xs text-gray-500">No pending orders</p>
          ) : (
            <div className="space-y-2">
              {pendingBuyOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-2">
            Completed Buy Orders ({completedBuyOrders.length})
          </h3>
          {completedBuyOrders.length === 0 ? (
            <p className="text-xs text-gray-500">No completed orders</p>
          ) : (
            <div className="space-y-2">
              {completedBuyOrders.map((order) => {
                const correspondingSell = session.sellOrders.find((s) =>
                  s.id.includes(order.id),
                );
                return (
                  <OrderDetailCard
                    key={order.id}
                    buyOrder={order}
                    sellOrder={correspondingSell}
                    executingFee={executingFee}
                    onDeductFee={executeFeeDedcution}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: BotOrder }) {
  return (
    <div className="p-3 border border-gray-700/40 rounded-lg bg-gray-800/30">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 text-xs">
          <div className="text-gray-300 font-mono">#{order.id.slice(0, 8)}</div>
          <div className="text-gray-500 mt-1">
            Buy @ {order.buyPrice.toFixed(8)}
          </div>
          <div className="text-gray-500">
            Amount: {order.solAmount.toFixed(4)} SOL
          </div>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 whitespace-nowrap">
          Pending
        </span>
      </div>
    </div>
  );
}

function OrderDetailCard({
  buyOrder,
  sellOrder,
  executingFee,
  onDeductFee,
}: {
  buyOrder: BotOrder;
  sellOrder?: BotOrder;
  executingFee?: string | null;
  onDeductFee?: (order: BotOrder) => void;
}) {
  return (
    <div className="p-3 border border-gray-700/40 rounded-lg bg-gray-800/30">
      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Buy Order:</span>
          <span className="text-gray-300 font-mono">
            #{buyOrder.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Status:</span>
          <span
            className={`font-semibold ${
              buyOrder.status === "completed"
                ? "text-green-400"
                : "text-yellow-400"
            }`}
          >
            {buyOrder.status}
          </span>
        </div>
        <div className="flex justify-between items-center border-t border-gray-700/20 pt-1 mt-1">
          <span className="text-gray-400">Fee (0.0007 SOL):</span>
          <div className="flex items-center gap-2">
            {buyOrder.feeDeducted ? (
              <div className="flex items-center gap-1 text-green-400">
                <CheckCircle className="h-3 w-3" />
                <span>Deducted</span>
              </div>
            ) : (
              <button
                onClick={() => onDeductFee?.(buyOrder)}
                disabled={executingFee === buyOrder.id}
                className="text-xs bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
              >
                {executingFee === buyOrder.id ? "Deducting..." : "Deduct Fee"}
              </button>
            )}
          </div>
        </div>
        {sellOrder && (
          <>
            <div className="flex justify-between border-t border-gray-700/20 pt-1 mt-1">
              <span className="text-gray-400">Sell Order:</span>
              <span className="text-gray-300 font-mono">
                #{sellOrder.id.slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span
                className={`font-semibold ${
                  sellOrder.status === "completed"
                    ? "text-green-400"
                    : "text-yellow-400"
                }`}
              >
                {sellOrder.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Fee (0.0007 SOL):</span>
              <div className="flex items-center gap-2">
                {sellOrder.feeDeducted ? (
                  <div className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    <span>Deducted</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onDeductFee?.(sellOrder)}
                    disabled={executingFee === sellOrder.id}
                    className="text-xs bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
                  >
                    {executingFee === sellOrder.id
                      ? "Deducting..."
                      : "Deduct Fee"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
