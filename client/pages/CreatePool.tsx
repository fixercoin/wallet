import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/ui/Loader";
import { ArrowRightLeft, ArrowLeft, Copy, Check } from "lucide-react";

interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  price?: number;
}

const COMMON_TOKENS: TokenInfo[] = [
  {
    mint: "So11111111111111111111111111111111111111112",
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEsl",
    name: "Tether USD",
    symbol: "USDT",
    decimals: 6,
    logoURI:
      "https://cdn.builder.io/api/v1/image/assets%2F559a5e19be114c9d8427d6683b845144%2Fc2ea69828dbc4a90b2deed99c2291802?format=webp&width=800",
  },
];

const POOL_FEES = [0.01, 0.05, 0.25, 1.0];
const DEFAULT_FEE = 0.01;

export default function CreatePool() {
  const { wallet, balance, tokens } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [tokenA, setTokenA] = useState<TokenInfo | null>(null);
  const [tokenB, setTokenB] = useState<TokenInfo | null>(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [fee, setFee] = useState(DEFAULT_FEE);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>(
    {},
  );
  const [pools, setPools] = useState<any[]>([]);
  const [walletTokens, setWalletTokens] = useState<TokenInfo[]>([]);
  const [copiedPoolId, setCopiedPoolId] = useState<string | null>(null);
  const [userEditedAmountB, setUserEditedAmountB] = useState(false);

  const handleCopyPoolId = (poolId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(poolId);
    setCopiedPoolId(poolId);
    toast({
      title: "Copied",
      description: "Pool ID copied to clipboard",
    });
    setTimeout(() => setCopiedPoolId(null), 2000);
  };

  // Initialize with wallet tokens, fallback to common tokens
  useEffect(() => {
    if (tokens && tokens.length > 0) {
      setWalletTokens(tokens);
      if (!tokenA) {
        setTokenA(tokens[0]);
      }
    } else {
      // Fallback to common tokens if wallet tokens not available
      setWalletTokens(COMMON_TOKENS);
      if (!tokenA) {
        setTokenA(COMMON_TOKENS[0]);
      }
    }
  }, [tokens, tokenA]);

  // Fetch token prices and balances
  useEffect(() => {
    const fetchPricesAndBalances = async () => {
      try {
        const prices: Record<string, number> = {};
        const balances: Record<string, number> = {};
        const tokensToFetch =
          walletTokens.length > 0 ? walletTokens : COMMON_TOKENS;

        for (const token of tokensToFetch) {
          try {
            // Fetch price
            const priceResponse = await fetch(
              `/api/token-price?mint=${token.mint}`,
            );
            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              prices[token.mint] = priceData.price || 0;
            }

            // Fetch balance from wallet
            if (token.balance !== undefined) {
              balances[token.mint] = token.balance;
            }
          } catch (err) {
            console.error(`Error fetching data for ${token.mint}:`, err);
          }
        }
        setTokenPrices(prices);
        setTokenBalances(balances);
      } catch (error) {
        console.error("Error fetching prices and balances:", error);
      }
    };

    if (walletTokens.length > 0) {
      fetchPricesAndBalances();
    }
  }, [walletTokens]);

  // Auto-adjust amount B based on real price (only if user hasn't manually edited it)
  useEffect(() => {
    if (!userEditedAmountB && tokenA && tokenB && amountA && tokenPrices[tokenA.mint]) {
      const priceA = tokenPrices[tokenA.mint] || 0;
      const priceB = tokenPrices[tokenB.mint] || 0;

      if (priceA > 0 && priceB > 0) {
        const valueA = parseFloat(amountA) * priceA;
        const calculatedAmountB = valueA / priceB;
        setAmountB(calculatedAmountB.toFixed(tokenB.decimals));
      }
    }
  }, [tokenA, tokenB, amountA, tokenPrices, userEditedAmountB]);

  if (!wallet) {
    return (
      <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />
        <div className="relative z-20 w-[90%] max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-[#0f1520]/30 border border-white/10">
          <h2 className="text-xl font-bold mb-4">Wallet Required</h2>
          <p className="text-sm text-gray-300 mb-6">
            Please set up or import a wallet first.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleCreatePool = async () => {
    if (!tokenA || !tokenB) {
      toast({
        title: "Select tokens",
        description: "Please select both token A and token B.",
        variant: "destructive",
      });
      return;
    }

    if (!amountA || !amountB) {
      toast({
        title: "Enter amounts",
        description: "Please enter amounts for both tokens.",
        variant: "destructive",
      });
      return;
    }

    if (tokenA.mint === tokenB.mint) {
      toast({
        title: "Invalid tokens",
        description: "Token A and Token B must be different.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/create-pool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tokenA: tokenA.mint,
          tokenB: tokenB.mint,
          amountA: amountA,
          amountB: amountB,
          fee: fee,
          walletAddress: wallet.publicKey.toString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Pool creation failed");
      }

      const poolData = await response.json();

      setPools([poolData, ...pools]);

      toast({
        title: "Pool created successfully!",
        description: `Pool ID: ${poolData.poolId}`,
      });

      setAmountA("");
      setAmountB("");
    } catch (error) {
      console.error("Pool creation error:", error);
      toast({
        title: "Pool creation failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const swapTokens = () => {
    setTokenA(tokenB);
    setTokenB(tokenA);
    const temp = amountA;
    setAmountA(amountB);
    setAmountB(temp);
    setUserEditedAmountB(false);
  };

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute top-0 right-0 w-56 h-56 sm:w-72 sm:h-72 lg:w-96 lg:h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="relative z-20 w-full max-w-sm sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-[#0f1520]/30 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/5"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Create Pool</h1>
        </div>

        <div className="space-y-6">
          {/* Token A Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-300">
              Token A
            </Label>
            <Select
              value={tokenA?.mint || ""}
              onValueChange={(value) => {
                const selected = walletTokens.find((t) => t.mint === value);
                setTokenA(selected || null);
              }}
            >
              <SelectTrigger className="w-full bg-[#1a2540]/50 border-[#FF7A5C]/30 text-white">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {walletTokens.length > 0 ? (
                  walletTokens.map((token) => (
                    <SelectItem key={token.mint} value={token.mint}>
                      <span className="flex items-center gap-2">
                        {token.logoURI && (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-4 h-4"
                          />
                        )}
                        {token.symbol}
                        {tokenBalances[token.mint] !== undefined && (
                          <span className="text-xs text-gray-500">
                            ({tokenBalances[token.mint].toFixed(4)})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    No tokens available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Amount A */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-300">
              Amount {tokenA?.symbol || "A"}
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              className="bg-[#1a2540]/50 border-[#FF7A5C]/30 text-white placeholder-gray-500"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>
                {tokenA && tokenPrices[tokenA.mint] && (
                  <>Price: ${tokenPrices[tokenA.mint].toFixed(4)}</>
                )}
              </span>
              {tokenA && tokenBalances[tokenA.mint] !== undefined && (
                <span>Balance: {tokenBalances[tokenA.mint].toFixed(4)}</span>
              )}
            </div>
          </div>

          {/* Swap Tokens Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={swapTokens}
              className="rounded-full p-2 bg-[#1a2540]/50 hover:bg-[#FF7A5C]/20 border border-[#ffffff66]"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Token B Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-300">
              Token B
            </Label>
            <Select
              value={tokenB?.mint || ""}
              onValueChange={(value) => {
                const selected = walletTokens.find((t) => t.mint === value);
                setTokenB(selected || null);
              }}
            >
              <SelectTrigger className="w-full bg-[#1a2540]/50 border-[#FF7A5C]/30 text-white">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {walletTokens.length > 0 ? (
                  walletTokens.map((token) => (
                    <SelectItem key={token.mint} value={token.mint}>
                      <span className="flex items-center gap-2">
                        {token.logoURI && (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-4 h-4"
                          />
                        )}
                        {token.symbol}
                        {tokenBalances[token.mint] !== undefined && (
                          <span className="text-xs text-gray-500">
                            ({tokenBalances[token.mint].toFixed(4)})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    No tokens available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Amount B */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-300">
              Amount {tokenB?.symbol || "B"}
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amountB}
              onChange={(e) => {
                setAmountB(e.target.value);
                setUserEditedAmountB(true);
              }}
              className="bg-[#1a2540]/50 border-[#FF7A5C]/30 text-white placeholder-gray-500"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>
                {tokenB && tokenPrices[tokenB.mint] && (
                  <>Price: ${tokenPrices[tokenB.mint].toFixed(4)}</>
                )}
              </span>
              {tokenB && tokenBalances[tokenB.mint] !== undefined && (
                <span>Balance: {tokenBalances[tokenB.mint].toFixed(4)}</span>
              )}
            </div>
          </div>

          {/* Fee Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-300">
              Pool Fee %
            </Label>
            <Select
              value={fee.toString()}
              onValueChange={(value) => setFee(parseFloat(value))}
            >
              <SelectTrigger className="w-full bg-[#1a2540]/50 border-[#FF7A5C]/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POOL_FEES.map((feeValue) => (
                  <SelectItem key={feeValue} value={feeValue.toString()}>
                    {feeValue}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Create Pool Button */}
          <Button
            onClick={handleCreatePool}
            disabled={isLoading}
            className="w-full h-12 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white font-semibold rounded-xl border-0 shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 mr-2" />
                Creating Pool...
              </>
            ) : (
              "Create Standard Pool"
            )}
          </Button>
        </div>

        {/* Created Pools Display */}
        {pools.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h2 className="text-lg font-semibold mb-4">Created Pools</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pools.map((pool, index) => (
                <Card
                  key={index}
                  className="bg-gradient-to-br from-[#1f2d48]/60 to-[#1a2540]/60 backdrop-blur-xl border border-[#FF7A5C]/30 rounded-xl overflow-hidden hover:border-[#FF7A5C]/50 transition-colors"
                >
                  <div className="p-3">
                    <div className="space-y-3">
                      {/* Pool Pair Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] font-semibold">
                            {pool.tokenASymbol}/{pool.tokenBSymbol}
                          </div>
                          <span className="text-[9px] text-green-400">✓</span>
                        </div>
                        <div className="text-[9px] text-gray-400">
                          Fee: {pool.fee}%
                        </div>
                      </div>

                      {/* Amounts */}
                      <div className="grid grid-cols-2 gap-2 text-[9px]">
                        <div className="p-2 rounded bg-[#0f1520]/40 border border-white/5">
                          <div className="text-gray-400 mb-0.5">Amount A</div>
                          <div className="font-semibold">
                            {pool.amountA} {pool.tokenASymbol}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-[#0f1520]/40 border border-white/5">
                          <div className="text-gray-400 mb-0.5">Amount B</div>
                          <div className="font-semibold">
                            {pool.amountB} {pool.tokenBSymbol}
                          </div>
                        </div>
                      </div>

                      {/* Pool ID with Copy */}
                      {pool.poolId && (
                        <div className="flex items-center justify-between p-2 rounded bg-[#0f1520]/40 border border-white/5">
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="text-[9px] text-gray-400">
                              Pool ID
                            </div>
                            <div className="text-[9px] font-mono text-[#38bdf8] truncate">
                              {pool.poolId}
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleCopyPoolId(pool.poolId, e)}
                            className="ml-2 p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                            title="Copy pool ID"
                          >
                            {copiedPoolId === pool.poolId ? (
                              <Check className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-gray-400 hover:text-white" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
