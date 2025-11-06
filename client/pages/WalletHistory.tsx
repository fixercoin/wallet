import React, { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { heliusAPI } from "@/lib/services/helius";

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

    // Fetch blockchain transactions
    fetchBlockchainTransactions();
  }, [wallet?.publicKey]);

  const fetchBlockchainTransactions = async () => {
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
    } catch (error) {
      console.error("Error fetching blockchain transactions:", error);
      setBlockchainTxs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      <div className="w-full max-w-md mx-auto px-4 py-6 relative z-20">
        <div className="mt-6 mb-1 rounded-lg p-6 border border-[#e6f6ec]/20 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden text-gray-900">
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">History</h1>
          </div>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium">Transactions</h2>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>

            {/* Combine blockchain txs + completed + pending orders */}
            {(() => {
              const appOrders = [
                ...(completedOrders || []).map((o: any) => ({
                  ...o,
                  __status: "completed",
                  __source: "app",
                })),
                ...(pendingOrders || []).map((o: any) => ({
                  ...o,
                  __status: "pending",
                  __source: "app",
                })),
              ];

              const allTxs = [
                ...blockchainTxs.map((t) => ({
                  ...t,
                  __status: "confirmed",
                  __source: "blockchain",
                })),
                ...appOrders,
              ];

              // Filter and sort by date (newest first)
              const filteredTxs = allTxs
                .filter((item: any) => {
                  const s = JSON.stringify(item).toLowerCase();
                  return (
                    /\b(buy|sell|send|receive|received|sent)\b/.test(s) ||
                    item.__source === "blockchain"
                  );
                })
                .sort((a: any, b: any) => {
                  const timeA =
                    a.blockTime ||
                    new Date(a.createdAt || a.timestamp || 0).getTime() / 1000;
                  const timeB =
                    b.blockTime ||
                    new Date(b.createdAt || b.timestamp || 0).getTime() / 1000;
                  return timeB - timeA;
                });

              if (filteredTxs.length === 0) {
                return (
                  <div className="text-sm text-gray-600">
                    {loading
                      ? "Loading transactions..."
                      : "No transactions found."}
                  </div>
                );
              }

              return (
                <ul className="space-y-3">
                  {filteredTxs.map((t: any, idx: number) => {
                    const sigs = findSignaturesInObject(t);
                    // infer type
                    let kind = "TX";
                    if (t.__source === "blockchain") {
                      kind =
                        t.type === "send"
                          ? "SEND"
                          : t.type === "receive"
                            ? "RECEIVE"
                            : "TX";
                    } else {
                      const text = (
                        t.type ||
                        t.description ||
                        JSON.stringify(t) ||
                        ""
                      )
                        .toString()
                        .toLowerCase();
                      if (/buy/.test(text)) kind = "BUY";
                      else if (/sell/.test(text)) kind = "SELL";
                      else if (/receive|received/.test(text)) kind = "RECEIVE";
                      else if (/send|sent/.test(text)) kind = "SEND";
                    }

                    const when =
                      t.createdAt ||
                      t.timestamp ||
                      t.time ||
                      t.date ||
                      t.txTime ||
                      (t.blockTime ? t.blockTime * 1000 : null);
                    const whenStr = when ? new Date(when).toLocaleString() : "";

                    // Get amount and token for blockchain transactions
                    let description = t.description || "";
                    if (t.__source === "blockchain" && !description) {
                      const tokenSymbol =
                        KNOWN_TOKENS[t.token]?.symbol || t.token.slice(0, 6);
                      const amount = t.amount / Math.pow(10, t.decimals || 6);
                      description = `${kind} ${amount.toFixed(6)} ${tokenSymbol}`;
                    }

                    const allSigs = [
                      ...(t.signature ? [t.signature] : []),
                      ...sigs,
                    ];
                    const uniqueSigs = Array.from(new Set(allSigs));

                    return (
                      <li
                        key={t.id || t.txid || t.signature || idx}
                        className="p-3 rounded-md border border-[#e6f6ec]/20 bg-white/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 uppercase">
                                {kind}
                              </span>
                              <span className="text-xs text-gray-500">
                                {t.__status}
                              </span>
                              {t.__source === "blockchain" && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  On-chain
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-sm text-gray-700">
                              {description || JSON.stringify(t).slice(0, 100)}
                            </div>
                            {whenStr ? (
                              <div className="text-xs text-gray-500 mt-1">
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
                                  Open transaction
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
