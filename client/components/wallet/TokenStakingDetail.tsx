import React, { useState, useEffect } from "react";
import { ArrowLeft, Coins, Clock, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@/contexts/WalletContext";
import { useStaking, type Stake } from "@/hooks/use-staking";
import { useToast } from "@/hooks/use-toast";
import { TokenInfo } from "@/lib/wallet";

interface TokenStakingDetailProps {
  token: TokenInfo;
  onBack: () => void;
}

// ======= MAIN VERSION KEPT =======

type StakePeriod = "10m" | "30d" | "60d" | "90d";

interface PeriodOption {
  value: StakePeriod;
  label: string;
  displayLabel: string;
  days: number;
}

const STAKE_PERIODS: PeriodOption[] = [
  {
    value: "10m",
    label: "10 MINUTES",
    displayLabel: "10 MINUTES",
    days: 10 / 1440,
  },
  { value: "30d", label: "30 DAYS", displayLabel: "30 DAYS", days: 30 },
  { value: "60d", label: "60 DAYS", displayLabel: "60 DAYS", days: 60 },
  { value: "90d", label: "90 DAYS", displayLabel: "90 DAYS", days: 90 },
];

// ==================================

const APY_RATE = 0.1;
const MIN_STAKE_AMOUNT = 1000;

function calculateReward(amount: number, periodDays: number): number {
  const yearlyReward = amount * APY_RATE;
  const dailyRate = yearlyReward / 365;
  return dailyRate * periodDays;
}

function formatTokenAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTimeRemaining(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const TokenStakingDetail: React.FC<TokenStakingDetailProps> = ({
  token,
  onBack,
}) => {
  const { wallet, tokens } = useWallet();
  const { stakes, loading, createStake, withdrawStake, refreshStakes } =
    useStaking();
  const { toast } = useToast();

  // ===== MAIN VERSION KEPT =====
  const [selectedPeriod, setSelectedPeriod] = useState<StakePeriod>("30d");
  // =============================

  const [stakeAmount, setStakeAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: string }>(
    {},
  );

  const selectedPeriodOption =
    STAKE_PERIODS.find((p) => p.value === selectedPeriod) || STAKE_PERIODS[1];

  const tokenStakes = stakes.filter(
    (stake) => stake.tokenMint === token.mint && stake.status === "active",
  );

  const completedStakes = stakes.filter(
    (stake) => stake.tokenMint === token.mint && stake.status === "completed",
  );

  const totalStaked = tokenStakes.reduce((sum, stake) => sum + stake.amount, 0);
  const availableBalance = Math.max(0, (token.balance || 0) - totalStaked);
  const calculatedReward = stakeAmount
    ? calculateReward(Number(stakeAmount), selectedPeriodOption.days)
    : 0;

  useEffect(() => {
    refreshStakes();
  }, [token.mint, refreshStakes]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeRemaining: { [key: string]: string } = {};
      tokenStakes.forEach((stake) => {
        const remaining = Math.max(0, stake.endTime - Date.now());
        newTimeRemaining[stake.id] = formatTimeRemaining(remaining);
      });
      setTimeRemaining(newTimeRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [tokenStakes]);

  const handleMaxClick = () => {
    setStakeAmount(availableBalance.toString());
  };

  const handleStartStaking = async () => {
    if (!stakeAmount || Number(stakeAmount) <= 0) {
      toast({
        title: "INVALID AMOUNT",
        description: "PLEASE ENTER A VALID AMOUNT TO STAKE",
        variant: "destructive",
      });
      return;
    }

    if (Number(stakeAmount) < MIN_STAKE_AMOUNT) {
      toast({
        title: "MINIMUM STAKE REQUIRED",
        description: `MINIMUM STAKING AMOUNT IS ${formatTokenAmount(MIN_STAKE_AMOUNT)} ${token.symbol}`,
        variant: "destructive",
      });
      return;
    }

    if (Number(stakeAmount) > availableBalance) {
      toast({
        title: "INSUFFICIENT BALANCE",
        description: `YOU ONLY HAVE ${formatTokenAmount(availableBalance)} ${token.symbol} AVAILABLE`,
        variant: "destructive",
      });
      return;
    }

    setIsStaking(true);
    try {
      await createStake(
        token.mint,
        Number(stakeAmount),
        selectedPeriodOption.days,
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
      await refreshStakes();

      toast({
        title: "STAKING STARTED",
        description: `SUCCESSFULLY STAKED ${formatTokenAmount(Number(stakeAmount))} ${token.symbol}.`,
      });
      setStakeAmount("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "STAKING FAILED",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsStaking(false);
    }
  };

  const handleWithdraw = async (stakeId: string) => {
    try {
      const result = await withdrawStake(stakeId);
      toast({
        title: "WITHDRAWAL SUCCESSFUL",
        description: `RECEIVED ${formatTokenAmount(result.totalAmount)} ${token.symbol}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "WITHDRAWAL FAILED",
        description: msg,
        variant: "destructive",
      });
    }
  };

  if (!wallet) {
    return (
      <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground p-4">
        <div className="w-full px-4 mx-auto pt-8">
          <div className="bg-transparent shadow-none rounded-lg p-6">
            <div className="p-8 text-center">
              <p className="text-[hsl(var(--muted-foreground))] uppercase">
                NO WALLET AVAILABLE. PLEASE CREATE OR IMPORT A WALLET FIRST.
              </p>
              <div className="mt-4">
                <Button
                  onClick={onBack}
                  className="w-full bg-[#2d1b47]/50 text-white uppercase"
                >
                  BACK
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="express-p2p-page dark-settings min-h-screen bg-background text-foreground p-4">
      <div className="w-full md:max-w-lg lg:max-w-lg mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-2">

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={onBack}
            size="sm"
            className="h-8 w-8 p-0 rounded-md bg-transparent hover:bg-white/10 text-white ring-0 focus-visible:ring-0 border border-transparent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-white uppercase">
            STAKE {token.symbol}
          </h1>
        </div>

        {/* TOKEN CARD */}
        <Card className="w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarImage src={token.logoURI} alt={token.symbol} />
                <AvatarFallback className="bg-gradient-to-br from-orange-500 to-yellow-600 text-white font-bold text-lg">
                  {token.symbol.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-gray-400 uppercase">{token.name}</p>
                <p className="text-2xl font-bold text-white uppercase">
                  {token.symbol}
                </p>
                <p className="text-xs text-gray-500 uppercase">
                  PRICE: ${token.price?.toFixed(8) || "N/A"}
                </p>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">AVAILABLE</span>
                <span className="text-lg font-bold text-white">
                  {formatTokenAmount(availableBalance)} {token.symbol}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* STAKING FORM */}
        <Card className="w-full bg-gray-900 rounded-lg border border-gray-700 mb-6">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-white mb-4 uppercase">
              NEW STAKE
            </h2>

            {/* AMOUNT */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 mb-2 block uppercase">
                STAKE AMOUNT ({token.symbol})
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <Button
                  onClick={handleMaxClick}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white uppercase"
                  size="sm"
                >
                  MAX
                </Button>
              </div>
            </div>

            {/* STAKE PERIOD */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 mb-3 block uppercase">
                STAKING PERIOD
              </label>

              <Select
                value={selectedPeriod}
                onValueChange={(value) =>
                  setSelectedPeriod(value as StakePeriod)
                }
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white uppercase hover:bg-gray-700">
                  <SelectValue placeholder="SELECT PERIOD" />
                </SelectTrigger>
                <SelectContent>
                  {STAKE_PERIODS.map((period) => (
                    <SelectItem
                      key={period.value}
                      value={period.value}
                      className="uppercase"
                    >
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* REWARD PREVIEW */}
            {stakeAmount && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 uppercase">
                      REWARD (10% APY)
                    </span>
                    <span className="text-green-400 font-semibold">
                      +{formatTokenAmount(calculatedReward)} {token.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 uppercase">TOTAL AT END</span>
                    <span className="text-white font-semibold">
                      {formatTokenAmount(
                        Number(stakeAmount) + calculatedReward,
                      )}{" "}
                      {token.symbol}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleStartStaking}
              disabled={
                !stakeAmount ||
                Number(stakeAmount) < MIN_STAKE_AMOUNT ||
                isStaking ||
                loading
              }
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold uppercase"
            >
              {isStaking ? "PROCESSING..." : "START STAKING"}
            </Button>

            {stakeAmount && Number(stakeAmount) < MIN_STAKE_AMOUNT && (
              <p className="text-xs text-red-400 mt-2 uppercase">
                MINIMUM STAKE REQUIRED:{" "}
                {formatTokenAmount(MIN_STAKE_AMOUNT)} {token.symbol}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ACTIVE STAKES */}
        {tokenStakes.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-sm font-semibold text-white uppercase">
              ACTIVE STAKES
            </h2>

            {tokenStakes.map((stake) => {
              const timeLeft = Math.max(0, stake.endTime - Date.now());
              const isWithdrawable = timeLeft === 0;
              const totalDurationMs =
                stake.stakePeriodDays * 24 * 60 * 60 * 1000;
              const elapsedMs = totalDurationMs - timeLeft;
              const progressPercentage = (elapsedMs / totalDurationMs) * 100;

              return (
                <Card
                  key={stake.id}
                  className="w-full bg-gray-900 rounded-lg border border-gray-700"
                >
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1 uppercase">
                          STAKED AMOUNT
                        </p>
                        <p className="text-lg font-bold text-white">
                          {formatTokenAmount(stake.amount)} {token.symbol}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400 mb-1 uppercase">
                          EXPECTED REWARD
                        </p>
                        <p className="text-lg font-bold text-green-400">
                          +{formatTokenAmount(stake.rewardAmount)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400 mb-1 uppercase">
                          PERIOD
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {stake.stakePeriodDays} days
                        </p>
                      </div>

                      <div className="flex items-end">
                        {isWithdrawable ? (
                          <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded uppercase">
                            READY TO WITHDRAW
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-yellow-500" />
                            <span className="text-xs font-semibold text-yellow-500 uppercase">
                              {timeRemaining[stake.id] || "CALCULATING..."}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isWithdrawable && (
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-gray-400 uppercase">
                            TIME PROGRESS
                          </p>
                          <p className="text-xs text-gray-400 uppercase">
                            {Math.round(progressPercentage)}%
                          </p>
                        </div>
                        <Progress
                          value={Math.min(progressPercentage, 100)}
                          className="h-2"
                        />
                      </div>
                    )}

                    <Button
                      onClick={() => handleWithdraw(stake.id)}
                      disabled={!isWithdrawable}
                      className={`w-full uppercase ${
                        isWithdrawable
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-700 text-gray-500"
                      } text-white font-semibold`}
                    >
                      {isWithdrawable ? "WITHDRAW" : "WITHDRAWAL LOCKED"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* HISTORY */}
        {completedStakes.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-sm font-semibold text-white uppercase">
              STAKE HISTORY ({completedStakes.length})
            </h2>

            {completedStakes.map((stake) => (
              <Card
                key={stake.id}
                className="w-full bg-gray-900 rounded-lg border border-gray-700"
              >
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-1 uppercase">
                        STAKED AMOUNT
                      </p>
                      <p className="text-sm font-bold text-white">
                        {formatTokenAmount(stake.amount)} {token.symbol}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-1 uppercase">
                        REWARD EARNED
                      </p>
                      <p className="text-sm font-bold text-green-400">
                        +{formatTokenAmount(stake.rewardAmount)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-1 uppercase">
                        PERIOD
                      </p>
                      <p className="text-xs font-semibold text-white">
                        {stake.stakePeriodDays} days
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-1 uppercase">
                        STATUS
                      </p>
                      <span className="text-xs font-semibold text-gray-300 bg-gray-800/50 px-2 py-1 rounded">
                        COMPLETED
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs text-gray-400 uppercase">
                        COMPLETED
                      </p>
                      <p className="text-xs text-gray-400 uppercase">100%</p>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400 uppercase">
                        TOTAL RECEIVED
                      </span>
                      <span className="text-green-400 font-semibold">
                        {formatTokenAmount(
                          stake.amount + stake.rewardAmount,
                        )}{" "}
                        {token.symbol}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};