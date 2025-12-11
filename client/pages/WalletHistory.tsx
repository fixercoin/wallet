import React, { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { heliusAPI } from "@/lib/services/helius";
import { jupiterAPI } from "@/lib/services/jupiter";

const BASE_SOLSCAN_TX = (sig: string) => `https://solscan.io/tx/${sig}`;

const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  So11111111111111111111111111111111111111112: {
    symbol: "SOL",
    decimals: 9,
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: "USDC",
    decimals: 6,
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns: {
    symbol: "USDT",
    decimals: 6,
  },
  H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump: {
    symbol: "FIXERCOIN",
    decimals: 6,
  },
  EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump: {
    symbol: "LOCKER",
    decimals: 6,
  },
};

function findSignaturesInObject(obj: any): string[] {
  const results: string[] = [];
  const base58Regex = /^[A-HJ-NP-Za-km-z1-9]{40,90}$/;

  function recurse(value: any) {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(recurse);
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => {
        const key = k.toLowerCase();
        if (typeof v === "string") {
          const str = v.trim();
          if (
            key.includes("signature") ||
            key.includes("tx") ||
            key.includes("transaction") ||
            key.includes("txid") ||
            base58Regex.test(str)
          ) {
            if (!results.includes(str) && base58Regex.test(str))
              results.push(str);
            // also accept short-ish signatures if key signals transaction
            else if (
              !results.includes(str) &&
              (key.includes("signature") ||
                key.includes("tx") ||
                key.includes("transaction") ||
                key.includes("txid"))
            )
              results.push(str);
          }
        } else {
          recurse(v);
        }
      });
    }
  }

  recurse(obj);
  return results;
}

interface BlockchainTransaction {
  type: "send" | "receive";
  signature: string;
  blockTime: number | null;
  token: string;
  amount: number;
  decimals: number;
  __source: "blockchain";
}

export default function WalletHistory() {
  const { wallet } = useWallet();
  const navigate = useNavigate();
  const [locks, setLocks] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [blockchainTxs, setBlockchainTxs] = useState<BlockchainTransaction[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [tokenMap, setTokenMap] = useState<
    Record<string, { symbol: string; decimals: number }>
  >({});

  useEffect(() => {
    if (!wallet?.publicKey) return;
    try {
      const raw =
        localStorage.getItem(`spl_token_locks_${wallet.publicKey}`) || "[]";
      const parsed = JSON.parse(raw);
      setLocks(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      setLocks([]);
    }

    try {
      const rawC = localStorage.getItem("orders_completed") || "[]";
      setCompletedOrders(JSON.parse(rawC));
    } catch (e) {
      setCompletedOrders([]);
    }

    try {
      const rawP = localStorage.getItem("orders_pending") || "[]";
      setPendingOrders(JSON.parse(rawP));
    } catch (e) {
      setPendingOrders([]);
    }

    // Load persisted transactions (if any)
    try {
      const rawTx =
        localStorage.getItem(`wallet_transactions_${wallet.publicKey}`) || "[]";
      const parsedTx = JSON.parse(rawTx);
      if (Array.isArray(parsedTx))
        setBlockchainTxs(parsedTx as BlockchainTransaction[]);
    } catch (e) {
      // ignore
    }

    // Init token map (Jupiter + known) and then fetch transactions
    let isMounted = true;
    (async () => {
      try {
        const known: Record<string, { symbol: string; decimals: number }> = {
          ...KNOWN_TOKENS,
        };
        try {
          const jupTokens = await jupiterAPI.getStrictTokenList();
          if (Array.isArray(jupTokens) && jupTokens.length > 0) {
            for (const t of jupTokens) {
              if (!t?.address) continue;
              known[t.address] = {
                symbol: t.symbol || t.address.slice(0, 6),
                decimals: t.decimals ?? 6,
              };
            }
          }
        } catch (jupError) {
          console.warn("Failed to fetch Jupiter token list:", jupError);
        }

        if (isMounted) {
          // Set token map state first
          setTokenMap(known);
          // Then fetch blockchain transactions
          await fetchBlockchainTransactions(known);
        }
      } catch (e) {
        console.error("Error initializing token map:", e);
        if (isMounted) {
          setTokenMap({ ...KNOWN_TOKENS });
          await fetchBlockchainTransactions({ ...KNOWN_TOKENS });
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [wallet?.publicKey]);

  const handleRefresh = async () => {
    await fetchBlockchainTransactions(tokenMap);
  };

  const handleClearHistory = () => {
    if (!wallet?.publicKey) return;
    try {
      localStorage.removeItem(`wallet_transactions_${wallet.publicKey}`);
      setBlockchainTxs([]);
      // Also clear any orders/locks persisted if desired
      toast({
        title: "History cleared",
        description: "Transaction history was removed from local storage.",
      });
    } catch (e) {
      console.error("Failed to clear history", e);
      toast({
        title: "Clear failed",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const fetchBlockchainTransactions = async (
    resolvedTokenMap?: Record<string, { symbol: string; decimals: number }>,
  ) => {
    if (!wallet?.publicKey) return;

    setLoading(true);
    try {
      console.log(`Fetching blockchain transactions for ${wallet.publicKey}`);

      // Get last 20 transaction signatures
      const signatures = await heliusAPI.getSignaturesForAddress(
        wallet.publicKey,
        20,
      );

      if (!signatures || !Array.isArray(signatures)) {
        console.log("No signatures returned");
        setLoading(false);
        return;
      }

      console.log(`Found ${signatures.length} signatures, fetching details...`);

      const txMap = new Map<
        string,
        BlockchainTransaction & { transfers: any[] }
      >();

      // Fetch and parse each transaction
      for (const sig of signatures) {
        if (!sig.signature) continue;

        try {
          const tx = await heliusAPI.getParsedTransaction(sig.signature);
          if (!tx) continue;

          // Extract token transfers
          const transfers = heliusAPI.parseTransactionForTokenTransfers(
            tx,
            wallet.publicKey,
          );

          // Group all transfers by signature (one entry per transaction, not per transfer)
          if (transfers.length > 0) {
            const txKey = sig.signature;
            if (!txMap.has(txKey)) {
              // Use the first transfer to initialize, but store all transfers
              txMap.set(txKey, {
                type: transfers[0].type,
                signature: sig.signature,
                blockTime: sig.blockTime,
                token: transfers[0].mint || transfers[0].token,
                amount: transfers[0].amount,
                decimals: transfers[0].decimals,
                __source: "blockchain",
                transfers: transfers,
              });
            }
          }
        } catch (e) {
          console.warn(`Error parsing transaction ${sig.signature}:`, e);
        }
      }

      const txs: BlockchainTransaction[] = Array.from(txMap.values()).map(
        (tx) => {
          const { transfers, ...rest } = tx;
          return rest;
        },
      );

      console.log(`Extracted ${txs.length} token transfers`);
      setBlockchainTxs(txs);
      try {
        localStorage.setItem(
          `wallet_transactions_${wallet.publicKey}`,
          JSON.stringify(txs),
        );
      } catch (e) {
        console.warn("Failed to persist transactions to localStorage", e);
      }
    } catch (error) {
      console.error("Error fetching blockchain transactions:", error);
      setBlockchainTxs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-gray-900 text-gray-900 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-0 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-0 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full md:max-w-lg mx-auto px-4 py-6 relative z-20">
        <div className="mt-6 mb-1 rounded-lg p-6 border-0 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden text-gray-900">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="BACK"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold uppercase">HISTORY</h1>
          </div>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium uppercase">TRANSACTIONS</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="p-1 hover:bg-gray-200 rounded-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="REFRESH TRANSACTIONS"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleClearHistory}
                  className="p-1 px-2 bg-red-50 text-red-600 rounded-none text-xs hover:bg-red-100"
                >
                  CLEAR
                </button>
              </div>
            </div>

            {/* Show only confirmed on-chain transactions */}
            {(() => {
              // Filter to only confirmed on-chain blockchain transactions
              const confirmedOnChainTxs = blockchainTxs
                .map((t) => ({
                  ...t,
                  __status: "confirmed",
                  __source: "blockchain",
                }))
                .sort((a: any, b: any) => {
                  const timeA = a.blockTime || 0;
                  const timeB = b.blockTime || 0;
                  return timeB - timeA;
                });

              if (confirmedOnChainTxs.length === 0) {
                return (
                  <div className="text-sm text-gray-600 uppercase">
                    {loading
                      ? "LOADING TRANSACTIONS..."
                      : "NO TRANSACTIONS FOUND."}
                  </div>
                );
              }

              return (
                <ul className="space-y-3">
                  {confirmedOnChainTxs.map((t: any, idx: number) => {
                    const sigs = findSignaturesInObject(t);
                    // Determine transaction type
                    const kind =
                      t.type === "send"
                        ? "SEND"
                        : t.type === "receive"
                          ? "RECEIVE"
                          : "TX";

                    // Format date
                    const when = t.blockTime ? t.blockTime * 1000 : null;
                    const whenStr = when ? new Date(when).toLocaleString() : "";

                    const allSigs = [
                      ...(t.signature ? [t.signature] : []),
                      ...sigs,
                    ];
                    const uniqueSigs = Array.from(new Set(allSigs));

                    return (
                      <li
                        key={t.id || t.txid || t.signature || idx}
                        className="p-3 rounded-lg border border-gray-300/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 uppercase">
                                {kind}
                              </span>
                              <span className="text-xs bg-transparent text-blue-700 px-2 py-0.5 rounded uppercase">
                                ON-CHAIN
                              </span>
                            </div>
                            {whenStr ? (
                              <div className="text-xs text-gray-500">
                                {whenStr}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {uniqueSigs.map((s: string) => (
                              <a
                                key={s}
                                href={BASE_SOLSCAN_TX(s)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span className="sr-only">
                                  OPEN TRANSACTION
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </section>
        </div>
      </div>
    </div>
  );
}
