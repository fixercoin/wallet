import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import { jupiterAPI } from "@/lib/services/jupiter";
import { bytesFromBase64, base64FromBytes } from "@/lib/bytes";
import { VersionedTransaction, Keypair } from "@solana/web3.js";
import { rpcCall } from "@/lib/rpc-utils";
import {
  PublicKey,
  SystemProgram,
  Transaction as SolanaTransaction,
} from "@solana/web3.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, Zap, X } from "lucide-react";

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
  errorMessage?: string;
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
const CREATION_FEE_SOL = 0.01; // Fixed 0.01 SOL fee
const SWAP_FEE_PERCENTAGE = 0.01; // 1% fee on each swap
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_ACCOUNT_RENT = 0.002;
const STORAGE_KEY = "market_maker_sessions";
const FIXED_TOKEN_ADDRESS = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
const FIXED_DELAY_SECONDS = 60; // 1 minute
const FIXED_PROFIT_PERCENT = 5;

// Helper function to calculate entry price (SOL per token)
const getEntryPrice = (solAmount: number, tokenAmount: number): number => {
  if (tokenAmount === 0) return 0;
  return solAmount / tokenAmount;
};

// Helper function to calculate exit price (SOL per token)
const getExitPrice = (solAmount: number, tokenAmount: number): number => {
  if (tokenAmount === 0) return 0;
  return solAmount / tokenAmount;
};

// Helper function to get trade pairs (buy + corresponding sell)
const getTradePairs = (
  buyTransactions: Transaction[],
  sellTransactions: Transaction[],
): Array<{
  buyTx: Transaction;
  sellTx?: Transaction;
  entryPrice: number;
  exitPrice?: number;
  profitSOL?: number;
  profitPercent?: number;
}> => {
  return buyTransactions.map((buyTx, index) => {
    const sellTx = sellTransactions[index];
    const entryPrice = getEntryPrice(buyTx.solAmount, buyTx.tokenAmount);
    const exitPrice = sellTx
      ? getExitPrice(sellTx.solAmount, sellTx.tokenAmount)
      : undefined;
    const profitSOL = sellTx ? sellTx.solAmount - buyTx.solAmount : undefined;
    const profitPercent =
      exitPrice && entryPrice > 0
        ? ((exitPrice - entryPrice) / entryPrice) * 100
        : undefined;

    return {
      buyTx,
      sellTx,
      entryPrice,
      exitPrice,
      profitSOL,
      profitPercent,
    };
  });
};

// Helper function to format error messages for display
const formatErrorMessage = (error: string): string => {
  if (!error) return "Unknown error occurred";

  // Handle "already been processed" error
  if (error.includes("already been processed")) {
    return "Transaction already submitted. Please wait for it to confirm on-chain.";
  }

  // Handle RPC timeout
  if (error.includes("timeout") || error.includes("abort")) {
    return "Network timeout. The RPC endpoints are slow or unreachable.";
  }

  // Handle rate limiting
  if (error.includes("429") || error.includes("rate limit")) {
    return "Rate limited by RPC provider. Please wait before retrying.";
  }

  // Handle insufficient balance
  if (error.includes("insufficient") || error.includes("not enough")) {
    return "Insufficient balance to complete this transaction.";
  }

  // Handle invalid token
  if (error.includes("No route found")) {
    return "Token swap route not available. The token may not be tradeable.";
  }

  // Handle price impact
  if (error.includes("Price impact")) {
    return "Price impact too high. Token may be illiquid or price changed significantly.";
  }

  // Handle simulation failures
  if (error.includes("Transaction simulation failed")) {
    return "Transaction would fail on-chain. Check your balance and token availability.";
  }

  // Handle RPC call failed
  if (error.includes("RPC call failed")) {
    // Extract the underlying error message if available
    const match = error.match(/:\s*(.+)$/);
    if (match && match[1] && match[1].length > 5) {
      return `Network error: ${match[1]}`;
    }
    return "Network error. Please check your connection and try again.";
  }

  // Truncate very long error messages
  if (error.length > 150) {
    return error.substring(0, 150) + "...";
  }

  return error;
};

export const MarketMaker: React.FC<MarketMakerProps> = ({ onBack }) => {
  const { wallet, tokens } = useWallet();
  const { toast } = useToast();

  const [tokenAddress] = useState(FIXED_TOKEN_ADDRESS);
  const [numberOfMakers, setNumberOfMakers] = useState("5");
  const [orderAmount, setOrderAmount] = useState("0.01");
  const [minDelaySeconds] = useState(String(FIXED_DELAY_SECONDS));
  const [maxDelaySeconds] = useState(String(FIXED_DELAY_SECONDS));
  const [sellStrategy] = useState<
    "hold" | "auto-profit" | "manual-target" | "gradually"
  >("auto-profit");
  const [profitTargetPercent, setProfitTargetPercent] = useState(
    String(FIXED_PROFIT_PERCENT),
  );
  const [manualPriceTarget, setManualPriceTarget] = useState("");
  const [gradualSellPercent] = useState("20");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] =
    useState<MarketMakerSession | null>(null);
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
    const numMakers = parseInt(numberOfMakers);
    if (isNaN(numMakers) || numMakers < 1 || numMakers > 1000)
      return "Number of makers must be between 1 and 1000";

    const amount = parseFloat(orderAmount);

    if (isNaN(amount) || amount < 0.01)
      return "Order amount must be at least 0.01 SOL";

    const profitTarget = parseFloat(profitTargetPercent);
    if (isNaN(profitTarget) || profitTarget < 0.1)
      return "Profit target must be >= 0.1%";

    return null;
  }, [numberOfMakers, orderAmount, profitTargetPercent]);

  const calculateEstimatedCost = useCallback((): {
    totalSOLNeeded: number;
    totalFees: number;
  } => {
    const numMakers = parseInt(numberOfMakers);
    const amount = parseFloat(orderAmount);

    const totalBuySol = numMakers * amount;

    const tokenAccountFees = numMakers * TOKEN_ACCOUNT_RENT;
    const creationFee = CREATION_FEE_SOL;
    const totalFees = tokenAccountFees + creationFee;

    return {
      totalSOLNeeded: totalBuySol + totalFees,
      totalFees,
    };
  }, [numberOfMakers, orderAmount]);

  const { totalSOLNeeded, totalFees } = calculateEstimatedCost();
  const canAfford = solBalance >= totalSOLNeeded;

  const handleRemoveSession = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updatedSessions = sessions.filter((s) => s.id !== sessionId);
      setSessions(updatedSessions);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
      toast({
        title: "Session Removed",
        description: "The session has been deleted",
      });
    },
    [sessions, toast],
  );

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

      // Transfer 2 SOL creation fee
      if (!wallet || !wallet.secretKey) {
        throw new Error("Wallet secret key required to create bot");
      }

      const feeTransferred = await transferFeeToWallet(
        CREATION_FEE_SOL,
        "creation",
      );
      if (!feeTransferred) {
        throw new Error("Failed to transfer creation fee");
      }

      const amount = parseFloat(orderAmount);
      const newSession: MarketMakerSession = {
        id: `mm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tokenAddress: tokenAddress.trim(),
        tokenSymbol: "",
        numberOfMakers: numMakers,
        minOrderSOL: amount,
        maxOrderSOL: amount,
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
          initialSOLAmount: amount,
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
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([newSession, ...sessions]),
      );

      toast({
        title: "Market Maker Session Created",
        description: `${numMakers} maker accounts configured. ◎${CREATION_FEE_SOL} fee transferred. Ready to start.`,
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

  // Helper function to transfer fees to fee wallet
  const transferFeeToWallet = async (
    feeAmount: number,
    makerId: string,
  ): Promise<boolean> => {
    try {
      if (!wallet || !wallet.secretKey || feeAmount <= 0) return false;

      const feeWalletPubkey = new PublicKey(FEE_WALLET);
      const userPubkey = new PublicKey(wallet.publicKey);

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: feeWalletPubkey,
        lamports: Math.floor(feeAmount * 1e9), // Convert SOL to lamports
      });

      // Create and sign transaction
      const latestBlockhash = await rpcCall("getLatestBlockhash", []);
      const blockHash = (latestBlockhash as any).blockhash;

      const transaction = new SolanaTransaction({
        recentBlockhash: blockHash,
        feePayer: userPubkey,
      });

      transaction.add(transferInstruction);

      // Sign transaction
      const getKeypair = (): Keypair | null => {
        try {
          const sk = wallet.secretKey as any as Uint8Array | number[] | string;
          if (!sk) return null;
          if (typeof sk === "string") {
            const arr = bytesFromBase64(sk);
            return Keypair.fromSecretKey(arr);
          }
          if (Array.isArray(sk))
            return Keypair.fromSecretKey(Uint8Array.from(sk));
          return Keypair.fromSecretKey(sk as Uint8Array);
        } catch (e) {
          console.error("Error creating keypair:", e);
          return null;
        }
      };

      const keypair = getKeypair();
      if (!keypair)
        throw new Error("Failed to create keypair for fee transfer");

      transaction.sign(keypair);

      // Send transaction
      const serialized = transaction.serialize();
      const txBase64 = base64FromBytes(serialized);

      const result = await rpcCall("sendTransaction", [
        txBase64,
        { skipPreflight: false, preflightCommitment: "confirmed" },
      ]);

      console.log(
        `✅ Fee transfer successful for ${makerId}: ◎${feeAmount.toFixed(4)} to ${FEE_WALLET} (${result})`,
      );
      return true;
    } catch (error) {
      console.error(
        `❌ Fee transfer failed for ${makerId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  };

  const handleStartSession = async () => {
    if (!currentSession) {
      toast({
        title: "Error",
        description: "No active session found",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Client-side execution: perform repeated buys using Jupiter and sign/send locally
      if (!wallet || !wallet.secretKey) {
        throw new Error("Wallet secret key required for client-side execution");
      }

      const solDecimals = 9;
      const numMakers = currentSession.numberOfMakers;
      const makers = currentSession.makers.map((m) => ({
        ...m,
        status: "active" as const,
        errorMessage: undefined,
      }));

      const updatedSession = {
        ...currentSession,
        status: "running" as const,
        makers,
      };
      setCurrentSession(updatedSession);
      const updatedSessions = sessions.map((s) =>
        s.id === updatedSession.id ? updatedSession : s,
      );
      setSessions(updatedSessions);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));

      toast({
        title: "Market Making Started",
        description: `Executing ${numMakers} buys. This may take a few moments...`,
      });

      // Helper to sign and send base64 versioned tx
      const getKeypair = (): Keypair | null => {
        try {
          const sk = wallet.secretKey as any as Uint8Array | number[] | string;
          if (!sk) return null;
          if (typeof sk === "string") {
            const arr = bytesFromBase64(sk);
            return Keypair.fromSecretKey(arr);
          }
          if (Array.isArray(sk))
            return Keypair.fromSecretKey(Uint8Array.from(sk));
          return Keypair.fromSecretKey(sk as Uint8Array);
        } catch (e) {
          console.error("Error creating keypair:", e);
          return null;
        }
      };

      const sendSignedTxGeneric = async (txBase64: string): Promise<string> => {
        const buf = bytesFromBase64(txBase64);
        const vtx = VersionedTransaction.deserialize(buf);
        const kp = getKeypair();
        if (!kp) throw new Error("Missing keypair to sign transaction");
        vtx.sign([kp]);
        const signed = vtx.serialize();
        const signedBase64 = base64FromBytes(signed);
        const res = await rpcCall("sendTransaction", [
          signedBase64,
          { skipPreflight: false, preflightCommitment: "confirmed" },
        ]);
        return res as string;
      };

      // Track successful trades
      let successCount = 0;
      let errorCount = 0;

      // Execute sequential buys with delays
      for (let i = 0; i < numMakers; i++) {
        const amountSol = parseFloat(currentSession.minOrderSOL);

        try {
          const rawAmount = jupiterAPI.formatSwapAmount(amountSol, solDecimals);
          const quote = await jupiterAPI.getQuote(
            SOL_MINT,
            currentSession.tokenAddress,
            Number(rawAmount),
            120,
          );

          if (!quote) {
            const m = updatedSession.makers[i];
            if (m) {
              const error = "No route found for token swap";
              m.status = "error" as const;
              m.errorMessage = error;
              m.buyTransactions.push({
                type: "buy",
                timestamp: Date.now(),
                solAmount: amountSol,
                tokenAmount: 0,
                feeAmount: 0,
                status: "failed",
              });
              console.error(`Maker ${m.id}: ${error}`);
            }
            errorCount++;
            continue;
          }

          const impact =
            Math.abs(parseFloat(quote.priceImpactPct || "0")) * 100;
          if (isFinite(impact) && impact > 20) {
            const m = updatedSession.makers[i];
            if (m) {
              const error = `Price impact too high: ${impact.toFixed(2)}%`;
              m.status = "error" as const;
              m.errorMessage = error;
              m.buyTransactions.push({
                type: "buy",
                timestamp: Date.now(),
                solAmount: amountSol,
                tokenAmount: 0,
                feeAmount: 0,
                status: "failed",
              });
              console.error(`Maker ${m.id}: ${error}`);
            }
            errorCount++;
            continue;
          }

          const swap = await jupiterAPI.getSwapTransaction({
            quoteResponse: quote,
            userPublicKey: wallet.publicKey,
            wrapAndUnwrapSol: true,
          });

          if (!swap || !swap.swapTransaction) {
            const m = updatedSession.makers[i];
            if (m) {
              const error = "Failed to build swap transaction";
              m.status = "error" as const;
              m.errorMessage = error;
              m.buyTransactions.push({
                type: "buy",
                timestamp: Date.now(),
                solAmount: amountSol,
                tokenAmount: 0,
                feeAmount: 0,
                status: "failed",
              });
              console.error(`Maker ${m.id}: ${error}`);
            }
            errorCount++;
            continue;
          }

          try {
            const sig = await sendSignedTxGeneric(swap.swapTransaction);
            const m = updatedSession.makers[i];
            if (m) {
              const tokenAmount =
                jupiterAPI.parseSwapAmount(
                  quote.outAmount,
                  quote.routePlan?.[0]?.swapInfo?.outAmount ? 0 : 0,
                ) || 0;

              m.buyTransactions.push({
                type: "buy",
                timestamp: Date.now(),
                solAmount: amountSol,
                tokenAmount: tokenAmount,
                feeAmount: 0,
                signature: sig,
                status: "confirmed",
              });
              m.currentTokenBalance = tokenAmount;
              m.status = "completed" as const;

              console.log(
                `�� Maker ${m.id}: Buy transaction confirmed (${sig}) | Tokens: ${tokenAmount}`,
              );

              successCount++;

              // Trigger auto-sell if profit target is set
              if (currentSession.sellStrategy === "auto-profit") {
                const profitTarget = currentSession.profitTargetPercent || 5;
                const buyPrice = amountSol / tokenAmount;

                // Polling mechanism to check for profit target
                const checkAndSellInterval = setInterval(async () => {
                  try {
                    const priceQuote = await jupiterAPI.getQuote(
                      currentSession.tokenAddress,
                      SOL_MINT,
                      jupiterAPI.formatSwapAmount(tokenAmount, 6),
                      120,
                    );

                    if (priceQuote) {
                      const soldSOL =
                        jupiterAPI.parseSwapAmount(priceQuote.outAmount, 9) ||
                        0;
                      const sellPrice = soldSOL / tokenAmount;
                      const profitPercent =
                        ((sellPrice - buyPrice) / buyPrice) * 100;

                      console.log(
                        `📊 Maker ${m.id}: Current profit: ${profitPercent.toFixed(2)}% (Target: ${profitTarget}%)`,
                      );

                      if (profitPercent >= profitTarget) {
                        clearInterval(checkAndSellInterval);
                        // Execute sell
                        const sellSwap = await jupiterAPI.getSwapTransaction({
                          quoteResponse: priceQuote,
                          userPublicKey: wallet.publicKey,
                          wrapAndUnwrapSol: true,
                        });

                        if (sellSwap && sellSwap.swapTransaction) {
                          try {
                            const sellSig = await sendSignedTxGeneric(
                              sellSwap.swapTransaction,
                            );

                            m.sellTransactions.push({
                              type: "sell",
                              timestamp: Date.now(),
                              solAmount: soldSOL,
                              tokenAmount: tokenAmount,
                              feeAmount: 0,
                              signature: sellSig,
                              status: "confirmed",
                            });

                            const profit = soldSOL - amountSol;
                            m.profitUSD = profit;

                            console.log(
                              `✅ Maker ${m.id}: Auto-sell executed (${sellSig}) | Profit: ${profit.toFixed(4)} SOL (${profitPercent.toFixed(2)}%)`,
                            );

                            setCurrentSession({
                              ...updatedSession,
                              makers: updatedSession.makers,
                            });
                          } catch (txError) {
                            console.error(
                              `Failed to send sell transaction for Maker ${m.id}:`,
                              txError,
                            );
                          }
                        }
                      }
                    }
                  } catch (autoSellError) {
                    console.error(
                      `Auto-sell error for Maker ${m.id}:`,
                      autoSellError,
                    );
                  }
                }, 3000); // Check every 3 seconds for profit target

                // Stop checking after 5 minutes if profit target not reached
                setTimeout(
                  () => {
                    clearInterval(checkAndSellInterval);
                    console.log(
                      `⏱️ Maker ${m.id}: Auto-sell timeout (5 minutes). Stopping profit check.`,
                    );
                  },
                  5 * 60 * 1000,
                );
              }
            }

            setCurrentSession({
              ...updatedSession,
              makers: updatedSession.makers,
            });
          } catch (txError) {
            const errorMsg =
              txError instanceof Error ? txError.message : String(txError);
            console.error(`Error sending transaction for maker ${i}:`, txError);
            const m = updatedSession.makers[i];
            if (m) {
              m.status = "error" as const;
              m.errorMessage = errorMsg;
              m.buyTransactions.push({
                type: "buy",
                timestamp: Date.now(),
                solAmount: amountSol,
                tokenAmount: 0,
                feeAmount: 0,
                status: "failed",
              });
            }
            errorCount++;
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.error(`Error processing maker ${i}:`, e);
          const m = updatedSession.makers[i];
          if (m) {
            m.status = "error" as const;
            m.errorMessage = errorMsg;
            m.buyTransactions.push({
              type: "buy",
              timestamp: Date.now(),
              solAmount: amountSol,
              tokenAmount: 0,
              feeAmount: 0,
              status: "failed",
            });
          }
          errorCount++;
        }

        // random delay between minDelay and maxDelay
        const minD = parseInt(currentSession.minDelaySeconds) * 1000;
        const maxD = parseInt(currentSession.maxDelaySeconds) * 1000;
        const delay = minD + Math.random() * (maxD - minD);
        await new Promise((r) => setTimeout(r, Math.max(0, delay)));
      }

      // finalize session
      const final = { ...updatedSession, status: "completed" as const };
      setCurrentSession(final);
      const finalSessions = sessions.map((s) =>
        s.id === final.id ? final : s,
      );
      setSessions(finalSessions);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalSessions));

      if (successCount > 0) {
        toast({
          title: "Market Maker Completed",
          description: `${successCount} buy(s) executed${errorCount > 0 ? ` | ${errorCount} failed` : ""}. View session details for more info.`,
        });
      } else {
        toast({
          title: "Market Maker Failed",
          description: `All ${errorCount} attempts failed. Check error messages in session details.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting market maker:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start market maker",
        variant: "destructive",
      });

      setCurrentSession(currentSession);
    } finally {
      setIsLoading(false);
    }
  };

  if (!wallet) {
    return (
      <div className="w-full md:max-w-lg mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <div className="text-sm text-red-800">Wallet not connected</div>
        </div>
      </div>
    );
  }

  if (currentSession) {
    return (
      <div className="w-full md:max-w-lg mx-auto px-4 relative z-0 pt-8">
        <div className="rounded-2xl border border-gray-700/50 bg-transparent backdrop-blur-sm">
          <div className="space-y-6 p-6 relative">
            <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentSession(null)}
                className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-gray-700/30 text-white focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-sm text-white uppercase">
                Session Details
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-400 uppercase font-semibold">
                    Number of Makers
                  </Label>
                  <p className="text-lg font-bold text-white mt-1">
                    {currentSession.numberOfMakers}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-400 uppercase font-semibold">
                    Sell Strategy
                  </Label>
                  <p className="text-sm text-white mt-1 capitalize">
                    {currentSession.sellStrategy}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-400 uppercase font-semibold">
                    Order Range
                  </Label>
                  <p className="text-sm text-white mt-1">
                    ◎ {currentSession.minOrderSOL.toFixed(4)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-400 uppercase font-semibold">
                    Status
                  </Label>
                  <p className="text-sm text-white mt-1 capitalize font-semibold">
                    {currentSession.status}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-700/50 pt-4">
                <Label className="text-xs text-gray-400 uppercase font-semibold mb-3 block">
                  Token Address
                </Label>
                <p className="text-xs font-mono break-all text-gray-300 bg-transparent p-3 rounded border border-gray-700/50">
                  {currentSession.tokenAddress}
                </p>
              </div>

              <div className="border-t border-gray-700/50 pt-4">
                <Label className="text-xs text-gray-400 uppercase font-semibold mb-3 block">
                  Fee Information
                </Label>
                <div className="text-xs text-gray-400 bg-transparent p-3 rounded border border-gray-700/50 space-y-1">
                  <p>
                    • Buy Fee (1%): Transferred to {FEE_WALLET.slice(0, 8)}...
                  </p>
                  <p>• Sell Fee (1%): Transferred to fee wallet on auto-sell</p>
                  <p>• All fees are deducted from transaction amounts</p>
                </div>
              </div>

              <div className="border-t border-gray-700/50 pt-4">
                <Label className="text-xs text-gray-400 uppercase font-semibold mb-3 block">
                  Session Summary
                </Label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800/30 border border-gray-700/50 rounded p-3">
                    <div className="text-[10px] text-gray-500 uppercase">
                      Total Trades
                    </div>
                    <div className="text-lg font-bold text-white mt-1">
                      {currentSession.makers.reduce(
                        (sum, m) => sum + m.buyTransactions.length,
                        0,
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 border border-gray-700/50 rounded p-3">
                    <div className="text-[10px] text-gray-500 uppercase">
                      Completed Sells
                    </div>
                    <div className="text-lg font-bold text-white mt-1">
                      {currentSession.makers.reduce(
                        (sum, m) => sum + m.sellTransactions.length,
                        0,
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 border border-gray-700/50 rounded p-3">
                    <div className="text-[10px] text-gray-500 uppercase">
                      Total Profit
                    </div>
                    <div
                      className={`text-lg font-bold mt-1 ${
                        currentSession.makers.reduce(
                          (sum, m) => sum + m.profitUSD,
                          0,
                        ) >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {currentSession.makers.reduce(
                        (sum, m) => sum + m.profitUSD,
                        0,
                      ) >= 0
                        ? "+"
                        : ""}
                      {currentSession.makers
                        .reduce((sum, m) => sum + m.profitUSD, 0)
                        .toFixed(4)}{" "}
                      ◎
                    </div>
                  </div>
                  <div className="bg-gray-800/30 border border-gray-700/50 rounded p-3">
                    <div className="text-[10px] text-gray-500 uppercase">
                      Win Rate
                    </div>
                    <div className="text-lg font-bold text-white mt-1">
                      {(() => {
                        const completedTrades = currentSession.makers.reduce(
                          (sum, m) => sum + m.sellTransactions.length,
                          0,
                        );
                        const profitableTrades = currentSession.makers.reduce(
                          (sum, m) =>
                            sum +
                            m.sellTransactions.filter(
                              (_, idx) =>
                                idx < m.buyTransactions.length &&
                                m.buyTransactions[idx].solAmount <
                                  m.buyTransactions[idx].solAmount,
                            ).length,
                          0,
                        );
                        return completedTrades > 0
                          ? (
                              (profitableTrades / completedTrades) *
                              100
                            ).toFixed(1)
                          : "0";
                      })()}
                      %
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-700/50 pt-4">
                <Label className="text-xs text-gray-400 uppercase font-semibold mb-3 block">
                  Maker Accounts ({currentSession.makers.length})
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {currentSession.makers.map((maker) => (
                    <div
                      key={maker.id}
                      className="text-xs p-3 bg-transparent rounded border border-gray-700/50"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-white">{maker.id}</span>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            maker.status === "active"
                              ? "bg-green-500/20 text-green-400"
                              : maker.status === "completed"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {maker.status}
                        </span>
                      </div>
                      <div className="text-gray-400 mt-2 text-xs space-y-1">
                        <div>
                          Buys: {maker.buyTransactions.length} | Sells:{" "}
                          {maker.sellTransactions.length}
                        </div>
                        {maker.buyTransactions.length > 0 && (
                          <div className="text-green-400">
                            Buy Fees: ◎{" "}
                            {maker.buyTransactions
                              .reduce((sum, tx) => sum + tx.feeAmount, 0)
                              .toFixed(4)}
                          </div>
                        )}
                        {maker.sellTransactions.length > 0 && (
                          <div className="text-blue-400">
                            Sell Fees: ◎{" "}
                            {maker.sellTransactions
                              .reduce((sum, tx) => sum + tx.feeAmount, 0)
                              .toFixed(4)}{" "}
                            | Profit: ◎ {maker.profitUSD.toFixed(4)}
                          </div>
                        )}
                      </div>
                      {maker.errorMessage && (
                        <div className="text-red-400 mt-2 text-xs bg-red-500/10 p-3 rounded border border-red-500/30 space-y-1">
                          <div className="font-semibold">Error:</div>
                          <div className="text-red-300">
                            {formatErrorMessage(maker.errorMessage)}
                          </div>
                          <div className="text-red-500/60 text-[10px] mt-1 font-mono break-all">
                            {maker.errorMessage.substring(0, 80)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-700/50 pt-4">
                <Label className="text-xs text-gray-400 uppercase font-semibold mb-3 block">
                  Trade History
                </Label>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {currentSession.makers.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">
                      No trades yet
                    </p>
                  ) : (
                    currentSession.makers
                      .filter(
                        (m) =>
                          m.buyTransactions.length > 0 ||
                          m.sellTransactions.length > 0,
                      )
                      .map((maker) => {
                        const trades = getTradePairs(
                          maker.buyTransactions,
                          maker.sellTransactions,
                        );
                        return (
                          <div key={maker.id} className="space-y-2">
                            {trades.map((trade, idx) => (
                              <div
                                key={`${maker.id}-trade-${idx}`}
                                className="text-xs bg-gray-800/30 border border-gray-700/50 rounded p-3 space-y-2"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-mono text-gray-300">
                                    {maker.id} - Trade {idx + 1}
                                  </span>
                                  {trade.profitSOL !== undefined && (
                                    <span
                                      className={`font-bold px-2 py-1 rounded text-[10px] ${
                                        trade.profitSOL >= 0
                                          ? "bg-green-500/20 text-green-400"
                                          : "bg-red-500/20 text-red-400"
                                      }`}
                                    >
                                      {trade.profitSOL >= 0 ? "+" : ""}
                                      {trade.profitSOL.toFixed(4)} ◎
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-gray-400">
                                  <div>
                                    <div className="text-gray-500 text-[10px]">
                                      BUY ENTRY
                                    </div>
                                    <div className="text-white font-semibold">
                                      {trade.entryPrice.toFixed(8)} ◎/token
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                      {trade.buyTx.tokenAmount.toFixed(2)}{" "}
                                      tokens
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                      @ {trade.buyTx.solAmount.toFixed(4)} ◎
                                    </div>
                                    <div className="text-[10px] text-gray-600 mt-1">
                                      {new Date(
                                        trade.buyTx.timestamp,
                                      ).toLocaleTimeString()}
                                    </div>
                                  </div>

                                  {trade.sellTx ? (
                                    <div>
                                      <div className="text-gray-500 text-[10px]">
                                        SELL EXIT
                                      </div>
                                      <div className="text-white font-semibold">
                                        {trade.exitPrice?.toFixed(8) || "N/A"}{" "}
                                        ◎/token
                                      </div>
                                      <div className="text-[10px] text-gray-500">
                                        {trade.sellTx.tokenAmount.toFixed(2)}{" "}
                                        tokens
                                      </div>
                                      <div className="text-[10px] text-gray-500">
                                        @ {trade.sellTx.solAmount.toFixed(4)} ◎
                                      </div>
                                      <div className="text-[10px] text-gray-600 mt-1">
                                        {new Date(
                                          trade.sellTx.timestamp,
                                        ).toLocaleTimeString()}
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="text-gray-500 text-[10px]">
                                        SELL EXIT
                                      </div>
                                      <div className="text-yellow-400 font-semibold text-[11px]">
                                        Pending/Held
                                      </div>
                                      <div className="text-[10px] text-gray-500 mt-2">
                                        Waiting for sell signal
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {trade.profitSOL !== undefined &&
                                  trade.profitPercent !== undefined && (
                                    <div className="border-t border-gray-700/30 pt-2 flex justify-between">
                                      <span className="text-gray-500">
                                        Profit:
                                      </span>
                                      <span className="text-white font-semibold">
                                        {trade.profitSOL >= 0 ? "+" : ""}
                                        {trade.profitSOL.toFixed(4)} ◎ (
                                        {trade.profitPercent.toFixed(2)}%)
                                      </span>
                                    </div>
                                  )}

                                {trade.buyTx.status === "failed" && (
                                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-red-400 text-[10px]">
                                    Buy transaction failed
                                  </div>
                                )}
                                {trade.sellTx &&
                                  trade.sellTx.status === "failed" && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-red-400 text-[10px]">
                                      Sell transaction failed
                                    </div>
                                  )}
                              </div>
                            ))}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="border-t border-gray-700/50 pt-4 flex gap-2">
                {currentSession.status === "setup" && (
                  <Button
                    onClick={handleStartSession}
                    disabled={isLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white uppercase rounded-[2px]"
                  >
                    {isLoading ? "Starting..." : "Start Bot"}
                  </Button>
                )}
                {currentSession.status === "running" && (
                  <div className="flex-1 py-3 px-4 bg-green-500/20 border border-green-500/50 rounded text-xs text-green-400 font-bold flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4" />
                    Running
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => setCurrentSession(null)}
                  className="border border-gray-700 text-white hover:bg-gray-700/30 uppercase rounded-[2px]"
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
    <div className="w-full md:max-w-lg mx-auto px-4 relative z-0 pt-8">
      <div className="rounded-none border-0 bg-transparent">
        <div className="space-y-6 p-6 relative">
          <div className="flex items-center gap-3 -mt-6 -mx-6 px-6 pt-4 pb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 p-0 rounded-[2px] bg-transparent hover:bg-gray-100 text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold text-sm text-white uppercase">
              Fixorium Market Maker
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Token Address
            </Label>
            <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-gray-400 font-mono text-xs">
              {tokenAddress.length > 10
                ? `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`
                : tokenAddress}
            </div>
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
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.001"
                min="0.01"
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                className="flex-1 bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
                placeholder="Minimum 0.01 SOL"
              />
              <span className="text-sm text-gray-600">◎</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Minimum: 0.01 SOL • Unlimited maximum
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Delay Between Buys
            </Label>
            <div className="bg-transparent border border-gray-700 rounded-lg px-4 py-3 text-gray-400 text-sm">
              {FIXED_DELAY_SECONDS} seconds (fixed)
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700 uppercase text-xs font-semibold">
              Profit Target (%) - Auto-Sell at Profit
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={profitTargetPercent}
              onChange={(e) => setProfitTargetPercent(e.target.value)}
              className="bg-transparent border border-gray-700 text-gray-900 rounded-lg px-4 py-3 font-medium focus:outline-none focus:border-[#a7f3d0] transition-colors placeholder:text-gray-400 caret-gray-900"
            />
            <p className="text-xs text-gray-500">Default: 5% profit target</p>
          </div>

          <div className="p-4 bg-transparent border border-gray-700 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">Available SOL:</span>
              <span
                className={`font-bold ${
                  canAfford ? "text-green-400" : "text-red-400"
                }`}
              >
                ◎ {solBalance.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
              <span className="text-gray-300">Required SOL:</span>
              <span className="font-bold text-white">
                ◎ {totalSOLNeeded.toFixed(4)}
              </span>
            </div>
            {!canAfford && (
              <div className="text-xs text-red-400 font-semibold pt-2">
                Need {(totalSOLNeeded - solBalance).toFixed(4)} more SOL
              </div>
            )}
          </div>

          <Button
            onClick={handleStartMarketMaking}
            disabled={isLoading || !canAfford}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold uppercase py-3 rounded-lg"
          >
            {isLoading ? "Creating..." : "Create Market Maker Bot"}
          </Button>

          {sessions.length > 0 && (
            <div className="border-t border-gray-700/50 pt-4">
              <Label className="text-xs text-gray-400 uppercase font-semibold mb-3 block">
                Previous Sessions
              </Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 border border-gray-700/50 rounded-lg bg-transparent cursor-pointer hover:bg-gray-700/20 transition-colors"
                    onClick={() => setCurrentSession(session)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-mono text-white">
                          {session.id}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {session.numberOfMakers} makers •{" "}
                          {session.sellStrategy}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded whitespace-nowrap ${
                            session.status === "running"
                              ? "bg-green-500/20 text-green-400"
                              : session.status === "completed"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-gray-500/20 text-gray-300"
                          }`}
                        >
                          {session.status}
                        </span>
                        <button
                          onClick={(e) => handleRemoveSession(session.id, e)}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Remove session"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
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
