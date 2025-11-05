import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, Zap } from "lucide-react";

interface MarketMakerProps {
  onBack: () => void;
}

interface MakerAccount {
  id: string;
  address: string;
  initialSOLAmount: number;
  buyTransactions: Transaction[];
  sellTransactions: Transaction[];
  currentTokenBalance: number;
  profitUSD: number;
  status: "active" | "completed" | "error";
}

interface Transaction {
  type: "buy" | "sell";
  timestamp: number;
  solAmount: number;
  tokenAmount: number;
  feeAmount: number;
  signature?: string;
  status: "pending" | "confirmed" | "failed";
}

interface MarketMakerSession {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  numberOfMakers: number;
  minOrderSOL: number;
  maxOrderSOL: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  sellStrategy: "hold" | "auto-profit" | "manual-target" | "gradually";
  profitTargetPercent?: number;
  manualPriceTarget?: number;
  gradualSellPercent?: number;
  estimatedTotalFees: number;
  makers: MakerAccount[];
  createdAt: number;
  status: "setup" | "running" | "completed";
}

const FEE_WALLET = "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM";
const FEE_PERCENTAGE = 0.01;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_ACCOUNT_RENT = 0.002;
const STORAGE_KEY = "market_maker_sessions";

export const MarketMaker: React.FC<MarketMakerProps> = ({ onBack }) => {
  const { wallet, tokens } = useWallet();
  const { toast } = useToast();

  const [tokenAddress, setTokenAddress] = useState("");
  const [numberOfMakers, setNumberOfMakers] = useState("5");
  const [minOrderSOL, setMinOrderSOL] = useState("0.001");
  const [maxOrderSOL, setMaxOrderSOL] = useState("0.002");
  const [minDelaySeconds, setMinDelaySeconds] = useState("10");
  const [maxDelaySeconds, setMaxDelaySeconds] = useState("20");
  const [sellStrategy, setSellStrategy] = useState<
    "hold" | "auto-profit" | "manual-target" | "gradually"
  >("auto-profit");
  const [profitTargetPercent, setProfitTargetPercent] = useState("5");
  const [manualPriceTarget, setManualPriceTarget] = useState("");
  const [gradualSellPercent, setGradualSellPercent] = useState("20");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<MarketMakerSession | null>(
    null,
  );
  const [sessions, setSessions] = useState<MarketMakerSession[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const solToken = useMemo(
    () => tokens.find((t) => t.symbol === "SOL"),
    [tokens],
  );

  const solBalance = solToken?.balance || 0;

  const validateInputs = useCallback((): string | null => {
    if (!tokenAddress.trim()) return "Token address is required";
    if (tokenAddress.length < 32) return "Invalid token address format";

    const numMakers = parseInt(numberOfMakers);
    if (isNaN(numMakers) || numMakers < 1 || numMakers > 1000)
      return "Number of makers must be between 1 and 1000";

    const minSol = parseFloat(minOrderSOL);
    const maxSol = parseFloat(maxOrderSOL);

    if (isNaN(minSol) || minSol <= 0) return "Min order amount must be > 0";
    if (isNaN(maxSol) || maxSol <= 0) return "Max order amount must be > 0";
    if (minSol >= maxSol) return "Min order must be less than max order";

    const minDelay = parseInt(minDelaySeconds);
    const maxDelay = parseInt(maxDelaySeconds);

    if (isNaN(minDelay) || minDelay < 0) return "Min delay must be >= 0";
    if (isNaN(maxDelay) || maxDelay < 0) return "Max delay must be >= 0";
    if (minDelay > maxDelay) return "Min delay must be <= max delay";

    if (sellStrategy === "auto-profit") {
      const profitTarget = parseFloat(profitTargetPercent);
      if (isNaN(profitTarget) || profitTarget < 0.1)
        return "Profit target must be >= 0.1%";
    }

    if (sellStrategy === "manual-target") {
      if (!manualPriceTarget) return "Manual price target is required";
      const target = parseFloat(manualPriceTarget);
      if (isNaN(target) || target <= 0)
        return "Price target must be a positive number";
    }

    if (sellStrategy === "gradually") {
      const gradual = parseFloat(gradualSellPercent);
      if (isNaN(gradual) || gradual <= 0 || gradual > 100)
        return "Gradually sell percent must be between 0 and 100";
    }

    return null;
  }, [
    tokenAddress,
    numberOfMakers,
    minOrderSOL,
    maxOrderSOL,
    minDelaySeconds,
    maxDelaySeconds,
    sellStrategy,
    profitTargetPercent,
    manualPriceTarget,
    gradualSellPercent,
  ]);

  const calculateEstimatedCost = useCallback((): {
    totalSOLNeeded: number;
    totalFees: number;
  } => {
    const numMakers = parseInt(numberOfMakers);
    const minSol = parseFloat(minOrderSOL);
    const maxSol = parseFloat(maxOrderSOL);

    const avgOrderSOL = (minSol + maxSol) / 2;
    const totalBuySol = numMakers * avgOrderSOL;

    const buyFees = totalBuySol * FEE_PERCENTAGE;
    const tokenAccountFees = numMakers * TOKEN_ACCOUNT_RENT;
    const sellFees = totalBuySol * FEE_PERCENTAGE;
    const totalFees = buyFees + sellFees + tokenAccountFees;

    return {
      totalSOLNeeded: totalBuySol + totalFees,
      totalFees,
    };
  }, [numberOfMakers, minOrderSOL, maxOrderSOL]);

  const { totalSOLNeeded, totalFees } = calculateEstimatedCost();
  const canAfford = solBalance >= totalSOLNeeded;

  const handleStartMarketMaking = async () => {
    const validationError = validateInputs();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    if (!canAfford) {
      toast({
        title: "Insufficient SOL",
        description: `You need ${totalSOLNeeded.toFixed(4)} SOL but only have ${solBalance.toFixed(4)} SOL`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const numMakers = parseInt(numberOfMakers);
      const newSession: MarketMakerSession = {
        id: `mm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tokenAddress: tokenAddress.trim(),
        tokenSymbol: "",
        numberOfMakers: numMakers,
        minOrderSOL: parseFloat(minOrderSOL),
        maxOrderSOL: parseFloat(maxOrderSOL),
        minDelaySeconds: parseInt(minDelaySeconds),
        maxDelaySeconds: parseInt(maxDelaySeconds),
        sellStrategy,
        profitTargetPercent:
          sellStrategy === "auto-profit"
            ? parseFloat(profitTargetPercent)
            : undefined,
        manualPriceTarget:
          sellStrategy === "manual-target"
            ? parseFloat(manualPriceTarget)
            : undefined,
        gradualSellPercent:
          sellStrategy === "gradually"
            ? parseFloat(gradualSellPercent)
            : undefined,
        estimatedTotalFees: totalFees,
        makers: Array.from({ length: numMakers }, (_, i) => ({
          id: `maker_${i + 1}`,
          address: "",
          initialSOLAmount: (parseFloat(minOrderSOL) + parseFloat(maxOrderSOL)) / 2,
          buyTransactions: [],
          sellTransactions: [],
          currentTokenBalance: 0,
          profitUSD: 0,
          status: "active" as const,
        })),
        createdAt: Date.now(),
        status: "setup",
      };

      setCurrentSession(newSession);
      setSessions([newSession, ...sessions]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newSession, ...sessions]));

      toast({
        title: "Market Maker Session Created",
        description: `${numMakers} maker accounts configured. Ready to start.`,
      });
    } catch (error) {
      console.error("Error creating market maker session:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create session",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!currentSession) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        "https://fixorium-proxy.khanbabusargodha.workers.dev/api/market-maker/start",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: currentSession.id,
            tokenAddress: currentSession.tokenAddress,
            numberOfMakers: currentSession.numberOfMakers,
            minOrderSOL: currentSession.minOrderSOL,
            maxOrderSOL: currentSession.maxOrderSOL,
            minDelaySeconds: currentSession.minDelaySeconds,
            maxDelaySeconds: currentSession.maxDelaySeconds,
            sellStrategy: currentSession.sellStrategy,
            profitTargetPercent: currentSession.profitTargetPercent,
            manualPriceTarget: currentSession.manualPriceTarget,
            gradualSellPercent: currentSession.gradualSellPercent,
            userWallet: wallet?.publicKey,
            feeWallet: FEE_WALLET,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();

      const updatedSession = {
        ...currentSession,
        makers: data.makers || currentSession.makers,
        status: "running" as const,
      };

      setCurrentSession(updatedSession);

      const updatedSessions = sessions.map((s) =>
        s.id === updatedSession.id ? updatedSession : s,
      );
      setSessions(updatedSessions);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));

      toast({
        title: "Market Making Started",
        description: `Bot is now executing trades for ${updatedSession.numberOfMakers} makers`,
      });
    } catch (error) {
      console.error("Error starting market maker:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to start market maker",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!wallet) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <div className="text-sm text-red-800">Wallet not connected</div>
        </div>
      </div>
    );
  }

  if (currentSession) {
    return (
      <div className="w-full max-w-md mx-auto px-4 relative z-0 pt-8">
        <div className="rounded-2xl border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0]">
          <div className="space-y-6 p-6 relative">
            <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentSession(null)}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-sm text-gray-900 uppercase">
                Session Details
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-600 uppercase font-semibold">
                    Number of Makers
                  </Label>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {currentSession.numberOfMakers}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 uppercase font-semibold">
                    Sell Strategy
                  </Label>
                  <p className="text-sm text-gray-900 mt-1 capitalize">
                    {currentSession.sellStrategy}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 uppercase font-semibold">
                    Order Range
                  </Label>
                  <p className="text-sm text-gray-900 mt-1">
                    ◎ {currentSession.minOrderSOL.toFixed(4)} -{" "}
                    {currentSession.maxOrderSOL.toFixed(4)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 uppercase font-semibold">
                    Status
                  </Label>
                  <p className="text-sm text-gray-900 mt-1 capitalize font-semibold">
                    {currentSession.status}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#f0fff4]/60 border border-[#a7f3d0]/30 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Estimated Fees (1%):</span>
                  <span className="font-bold text-gray-900">
                    ◎ {currentSession.estimatedTotalFees.toFixed(4)}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-xs text-gray-600 uppercase font-semibold mb-3 block">
                  Token Address
                </Label>
                <p className="text-xs font-mono break-all text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                  {currentSession.tokenAddress}
                </p>
              </div>

              <div className="border-t pt-4">
                <Label className="text-xs text-gray-600 uppercase font-semibold mb-3 block">
                  Maker Accounts ({currentSession.makers.length})
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {currentSession.makers.map((maker) => (
                    <div
                      key={maker.id}
                      className="text-xs p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-gray-900">
                          {maker.id}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            maker.status === "active"
                              ? "bg-green-100 text-green-700"
                              : maker.status === "completed"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {maker.status}
                        </span>
                      </div>
                      <div className="text-gray-600 mt-2 text-xs">
                        Buys: {maker.buyTransactions.length} | Sells:{" "}
                        {maker.sellTransactions.length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 flex gap-2">
                {currentSession.status === "setup" && (
                  <Button
                    onClick={handleStartSession}
                    disabled={isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white uppercase"
                  >
                    {isLoading ? "Starting..." : "Start Bot"}
                  </Button>
                )}
                {currentSession.status === "running" && (
                  <div className="flex-1 py-3 px-4 bg-green-50 border border-green-200 rounded text-xs text-green-800 font-bold flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />
                    Running
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => setCurrentSession(null)}
                  className="border border-gray-700 text-gray-900 uppercase"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 relative z-0 pt-8">
      <div className="rounded-2xl border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0]">
        <div className="space-y-6 p-6 relative">
          <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold text-sm text-gray-900 uppercase">
              Fixorium Market Maker
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Token Address
            </Label>
            <Input
              placeholder="Enter Token Address"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Number of Makers
            </Label>
            <Input
              type="number"
              min="1"
              max="1000"
              value={numberOfMakers}
              onChange={(e) => setNumberOfMakers(e.target.value)}
              className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Order Amount (SOL)
            </Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-gray-600 font-semibold">
                  Minimum Amount
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    step="0.001"
                    value={minOrderSOL}
                    onChange={(e) => setMinOrderSOL(e.target.value)}
                    className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
                  />
                  <span className="text-sm text-gray-600">◎</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600 font-semibold">
                  Maximum Amount
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    step="0.001"
                    value={maxOrderSOL}
                    onChange={(e) => setMaxOrderSOL(e.target.value)}
                    className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
                  />
                  <span className="text-sm text-gray-600">◎</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Delay Between Buys (seconds)
            </Label>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-gray-600 font-semibold">
                  Minimum Delay
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={minDelaySeconds}
                  onChange={(e) => setMinDelaySeconds(e.target.value)}
                  className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 font-semibold">
                  Maximum Delay
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={maxDelaySeconds}
                  onChange={(e) => setMaxDelaySeconds(e.target.value)}
                  className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900 mt-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              What to do with tokens?
            </Label>
            <Select value={sellStrategy} onValueChange={(value: any) => setSellStrategy(value)}>
              <SelectTrigger className="w-full bg-transparent border border-gray-700 text-gray-900 rounded-lg focus:outline-none focus:border-[#a7f3d0] focus:ring-0 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border border-gray-700 z-50">
                <SelectItem value="hold">Hold (Manual Sell Later)</SelectItem>
                <SelectItem value="auto-profit">Auto-Sell at Profit %</SelectItem>
                <SelectItem value="manual-target">Manual Price Target</SelectItem>
                <SelectItem value="gradually">Gradually Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sellStrategy === "auto-profit" && (
            <div className="space-y-2">
              <Label className="text-gray-700 uppercase text-xs font-semibold">
                Profit Target (%)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={profitTargetPercent}
                onChange={(e) => setProfitTargetPercent(e.target.value)}
                className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
              />
            </div>
          )}

          {sellStrategy === "manual-target" && (
            <div className="space-y-2">
              <Label className="text-gray-700 uppercase text-xs font-semibold">
                Manual Price Target
              </Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="Enter target price in USD"
                value={manualPriceTarget}
                onChange={(e) => setManualPriceTarget(e.target.value)}
                className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
              />
            </div>
          )}

          {sellStrategy === "gradually" && (
            <div className="space-y-2">
              <Label className="text-gray-700 uppercase text-xs font-semibold">
                Gradually Sell (%)
              </Label>
              <Input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={gradualSellPercent}
                onChange={(e) => setGradualSellPercent(e.target.value)}
                className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
              />
            </div>
          )}

          <div className="p-4 bg-[#f0fff4]/60 border border-[#a7f3d0]/30 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Total SOL Needed:</span>
              <span className="font-bold text-gray-900">
                ◎ {totalSOLNeeded.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Estimated Fees (1%):</span>
              <span className="font-bold text-gray-900">
                ◎ {totalFees.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#a7f3d0]/30">
              <span className="text-gray-700">Your SOL Balance:</span>
              <span
                className={`font-bold ${
                  canAfford ? "text-green-600" : "text-red-600"
                }`}
              >
                ◎ {solBalance.toFixed(4)}
              </span>
            </div>
            {!canAfford && (
              <div className="text-xs text-red-600 font-semibold pt-2">
                Need {(totalSOLNeeded - solBalance).toFixed(4)} more SOL
              </div>
            )}
          </div>

          <Button
            onClick={handleStartMarketMaking}
            disabled={isLoading || !canAfford}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold uppercase py-3"
          >
            {isLoading ? "Creating..." : "Create Market Maker Bot"}
          </Button>

          {sessions.length > 0 && (
            <div className="border-t pt-4">
              <Label className="text-xs text-gray-600 uppercase font-semibold mb-3 block">
                Previous Sessions
              </Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 border border-gray-200 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setCurrentSession(session)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-xs font-mono text-gray-900">
                          {session.id}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {session.numberOfMakers} makers • {session.sellStrategy}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ${
                          session.status === "running"
                            ? "bg-green-100 text-green-700"
                            : session.status === "completed"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
