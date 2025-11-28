import React, { useState, useEffect } from "react";
import { ArrowLeft, Coins, Clock, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { useStaking, type Stake } from "@/hooks/use-staking";
import { useToast } from "@/hooks/use-toast";
import { TokenInfo } from "@/lib/wallet";

interface TokenStakingDetailProps {
  token: TokenInfo;
  onBack: () => void;
}

const STAKE_PERIODS = [30, 60, 90] as const;
const APY_RATE = 0.1; // 10%
const MIN_STAKE_AMOUNT = 10000000; // Minimum 10 million tokens

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

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

export const TokenStakingDetail: React.FC<TokenStakingDetailProps> = ({
  token,
  onBack,
}) => {
  const { wallet, tokens } = useWallet();
  const { stakes, loading, createStake, withdrawStake } = useStaking();
  const { toast } = useToast();

  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(30);
  const [stakeAmount, setStakeAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: string }>(
    {},
  );

  // Get available balance for this token
  const availableBalance = token.balance || 0;
  const calculatedReward = stakeAmount
    ? calculateReward(Number(stakeAmount), selectedPeriod)
    : 0;

  // Filter stakes for this token
  const tokenStakes = stakes.filter(
    (stake) => stake.tokenMint === token.mint && stake.status === "active",
  );

  // Update timer for active stakes
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
        title: "Invalid Amount",
        description: "Please enter a valid amount to stake",
        variant: "destructive",
      });
      return;
    }

    if (Number(stakeAmount) < MIN_STAKE_AMOUNT) {
      toast({
        title: "Minimum Stake Required",
        description: `Minimum staking amount is ${formatTokenAmount(MIN_STAKE_AMOUNT)} ${token.symbol}`,
        variant: "destructive",
      });
      return;
    }

    if (Number(stakeAmount) > availableBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${availableBalance} ${token.symbol} available`,
        variant: "destructive",
      });
      return;
    }

    setIsStaking(true);
    try {
      await createStake(token.mint, Number(stakeAmount), selectedPeriod);
      toast({
        title: "Staking Started",
        description: `Successfully staked ${stakeAmount} ${token.symbol}`,
      });
      setStakeAmount("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Staking Failed",
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
        title: "Withdrawal Successful",
        description: `Received ${result.totalAmount} ${token.symbol} including rewards`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Withdrawal Failed",
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
              <p className="text-[hsl(var(--muted-foreground))]">
                No wallet available. Please create or import a wallet first.
              </p>
              <div className="mt-4">
                <Button
                  onClick={onBack}
                  className="w-full bg-[#2d1b47]/50 text-white"
                >
                  Back
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
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            onClick={onBack}
            size="sm"
            className="h-8 w-8 p-0 rounded-md bg-transparent hover:bg-white/10 text-white ring-0 focus-visible:ring-0 border border-transparent"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-white">
            Stake {token.symbol}
          </h1>
        </div>

        {/* Token Card */}
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
                <p className="text-sm text-gray-400">{token.name}</p>
                <p className="text-2xl font-bold text-white">{token.symbol}</p>
                <p className="text-xs text-gray-500">
                  Price: ${token.price?.toFixed(8) || "N/A"}
                </p>
              </div>
            </div>

            {/* Available Balance */}
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

        {/* Staking Form */}
        <Card className="w-full bg-gray-900 rounded-lg border border-gray-700 mb-6">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold text-white mb-4">New Stake</h2>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 mb-2 block">
                Stake Amount ({token.symbol})
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-gray-800 border-gray-700 text-white"
                  min="0"
                  step="0.01"
                />
                <Button
                  onClick={handleMaxClick}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  size="sm"
                >
                  Max
                </Button>
              </div>
            </div>

            {/* Staking Period Selection */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 mb-3 block">
                Staking Period
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STAKE_PERIODS.map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                      selectedPeriod === period
                        ? "bg-yellow-500 text-gray-900"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {period} days
                  </button>
                ))}
              </div>
            </div>

            {/* Reward Preview */}
            {stakeAmount && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Reward (10% APY)</span>
                    <span className="text-green-400 font-semibold">
                      +{formatTokenAmount(calculatedReward)} {token.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Total at End</span>
                    <span className="text-white font-semibold">
                      {formatTokenAmount(Number(stakeAmount) + calculatedReward)} {token.symbol}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Start Staking Button */}
            <Button
              onClick={handleStartStaking}
              disabled={!stakeAmount || Number(stakeAmount) < MIN_STAKE_AMOUNT || isStaking || loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStaking ? "Processing..." : "Start Staking"}
            </Button>
            {stakeAmount && Number(stakeAmount) < MIN_STAKE_AMOUNT && (
              <p className="text-xs text-red-400 mt-2">
                Minimum stake required: {formatTokenAmount(MIN_STAKE_AMOUNT)} {token.symbol}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active Stakes */}
        {tokenStakes.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-sm font-semibold text-white">Active Stakes</h2>
            {tokenStakes.map((stake) => {
              const timeLeft = Math.max(0, stake.endTime - Date.now());
              const isWithdrawable = timeLeft === 0;

              return (
                <Card
                  key={stake.id}
                  className="w-full bg-gray-900 rounded-lg border border-gray-700"
                >
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">
                          Staked Amount
                        </p>
                        <p className="text-lg font-bold text-white">
                          {formatTokenAmount(stake.amount)} {token.symbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">
                          Expected Reward
                        </p>
                        <p className="text-lg font-bold text-green-400">
                          +{formatTokenAmount(stake.rewardAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Period</p>
                        <p className="text-sm font-semibold text-white">
                          {stake.stakePeriodDays} days
                        </p>
                      </div>
                      <div className="flex items-end">
                        {isWithdrawable ? (
                          <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded">
                            Ready to Withdraw
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-yellow-500" />
                            <span className="text-xs font-semibold text-yellow-500">
                              {timeRemaining[stake.id] || "Calculating..."}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => handleWithdraw(stake.id)}
                      disabled={!isWithdrawable}
                      className={`w-full ${
                        isWithdrawable
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-700 text-gray-500"
                      } text-white font-semibold`}
                    >
                      {isWithdrawable ? "Withdraw" : "Withdrawal Locked"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Back Button */}
        <Button
          onClick={onBack}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white"
        >
          Back to Tokens
        </Button>
      </div>
    </div>
  );
};
