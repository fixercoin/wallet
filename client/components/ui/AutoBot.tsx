import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { jupiterAPI } from "@/lib/services/jupiter";
import { TokenInfo } from "@/lib/wallet";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import { ArrowLeft, Bot, Zap, Shield, Clock, Play, Square } from "lucide-react";
import {
  Keypair,
  VersionedTransaction,
  Transaction,
  PublicKey,
} from "@solana/web3.js";

interface AutoBotProps {
  onBack: () => void;
}

type FixerPosition = {
  entryPriceUsd: number; // entry price per FIXERCOIN in USD
  qty: number; // FIXERCOIN units bought
  entrySolSpent: number; // SOL spent for entry (for monitoring)
  ts: number; // timestamp
};

const SOL_MINT = "So11111111111111111111111111111111111111112";
const FIXER_MINT = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
const STORAGE_KEY = "autobot_fixer_position";

// Internal risk controls (not user-adjustable on UI)
const INTERVAL_SEC = 60; // run every 60s
const MIN_SOL_RESERVE = 0.002; // keep small SOL for fees
const MAX_PRICE_IMPACT_PCT = 3; // skip if impact exceeds this percent
const SLIPPAGE_BPS = 50; // 0.5%
const PROFIT_TARGET_PCT = 5; // sell at +5%

export const AutoBot: React.FC<AutoBotProps> = ({ onBack }) => {
  const { wallet, tokens, refreshBalance, refreshTokens } = useWallet();
  const { toast } = useToast();

  const solToken = useMemo(
    () => tokens.find((t) => t.symbol === "SOL"),
    [tokens],
  );
  const fixerToken = useMemo(
    () => tokens.find((t) => t.symbol === "FIXERCOIN" || t.mint === FIXER_MINT),
    [tokens],
  );

  const [enabled, setEnabled] = useState(true);
  const [isTicking, setIsTicking] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [lastMessage, setLastMessage] = useState<string>("Idle");
  const [pnlPct, setPnlPct] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef(false);

  const getCurrentFixerPriceUsd = useCallback(async (): Promise<
    number | null
  > => {
    const priceFromContext = fixerToken?.price;
    if (priceFromContext && priceFromContext > 0) return priceFromContext;
    try {
      const p = await jupiterAPI.getTokenPrice(FIXER_MINT);
      return p || null;
    } catch {
      return null;
    }
  }, [fixerToken?.price]);

  const loadPosition = (): FixerPosition | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const pos = JSON.parse(raw) as FixerPosition;
      if (!isFinite(pos.entryPriceUsd) || !isFinite(pos.qty) || pos.qty <= 0)
        return null;
      return pos;
    } catch {
      return null;
    }
  };

  const savePosition = (pos: FixerPosition | null) => {
    if (!pos) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  };

  const computeTradeAmountSol = (): number => {
    const bal = solToken?.balance || 0;
    const available = Math.max(0, bal - MIN_SOL_RESERVE);
    if (available <= 0) return 0;
    // Use a conservative fraction, cap to protect small wallets
    const target = Math.min(0.02, Math.max(0.001, available * 0.25));
    return Math.min(target, available);
  };

  const ensureGuards = (from: TokenInfo | undefined): string | null => {
    if (!wallet) return "No wallet";
    if (!from) return "Missing token";
    if (!isFinite(from.balance || 0) || (from.balance || 0) <= 0)
      return "Insufficient balance";
    if (from.symbol === "SOL") {
      const available = (from.balance || 0) - MIN_SOL_RESERVE;
      if (available <= 0) return "Respecting SOL reserve";
    }
    return null;
  };

  const bytesFromBase64 = (b64: string): Uint8Array => {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {
      return new Uint8Array();
    }
  };

  const base64FromBytes = (bytes: Uint8Array): string => {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  const coerceSecretKey = (val: unknown): Uint8Array | null => {
    try {
      if (!val) return null;
      if (val instanceof Uint8Array) return val;
      if (Array.isArray(val)) return Uint8Array.from(val as number[]);
      if (typeof val === "string") {
        // Try base64 first
        try {
          const bin = atob(val);
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          if (out.length > 0) return out;
        } catch {}
        // Try JSON array string
        try {
          const arr = JSON.parse(val);
          if (Array.isArray(arr)) return Uint8Array.from(arr as number[]);
        } catch {}
      }
      if (typeof val === "object") {
        // Plain object with numeric keys
        const values = Object.values(val as Record<string, unknown>).filter(
          (x) => typeof x === "number",
        ) as number[];
        if (values.length > 0) return Uint8Array.from(values);
      }
    } catch {}
    return null;
  };

  const getKeypair = (): Keypair | null => {
    try {
      const sk = coerceSecretKey(wallet?.secretKey);
      if (!sk || sk.length === 0) return null;
      return Keypair.fromSecretKey(sk);
    } catch {
      return null;
    }
  };

  const sendSignedTx = async (txBase64: string): Promise<string> => {
    const kp = getKeypair();
    if (!kp) throw new Error("Missing keypair to sign transaction");

    // Decode -> sign -> encode
    const raw = bytesFromBase64(txBase64);
    const vtx = VersionedTransaction.deserialize(raw);
    vtx.sign([kp]);
    const signed = vtx.serialize();
    const signedBase64 = base64FromBytes(signed);

    const body = {
      method: "sendTransaction",
      params: [
        signedBase64,
        { skipPreflight: false, preflightCommitment: "confirmed" },
      ],
      id: Date.now(),
    };

    // Try solana proxy first
    const tryPost = async (url: string) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`RPC ${r.status}: ${t || r.statusText}`);
      }
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || "RPC error");
      return j.result as string;
    };

    return await tryPost(resolveApiUrl("/api/solana-rpc"));
  };

  const runOnce = useCallback(async () => {
    if (!enabled) return;
    if (inFlightRef.current) return;
    if (!wallet) {
      setLastMessage("No wallet");
      return;
    }

    try {
      inFlightRef.current = true;
      setIsTicking(true);

      const pos = loadPosition();
      const fixerBal = fixerToken?.balance || 0;
      const solBal = solToken?.balance || 0;

      // Compute live PnL if in position
      if (pos) {
        const price = await getCurrentFixerPriceUsd();
        if (price && pos.entryPriceUsd > 0) {
          const pct = ((price - pos.entryPriceUsd) / pos.entryPriceUsd) * 100;
          setPnlPct(pct);
        } else {
          setPnlPct(null);
        }
      } else {
        setPnlPct(null);
      }

      // SELL logic: if in position and profit >= 5%, sell all FIXERCOIN to SOL
      if (pos && fixerBal > 0) {
        const currentPrice = await getCurrentFixerPriceUsd();
        if (!currentPrice || currentPrice <= 0) {
          setLastMessage("Price unavailable");
        } else {
          const profit =
            ((currentPrice - pos.entryPriceUsd) / pos.entryPriceUsd) * 100;
          if (profit >= PROFIT_TARGET_PCT) {
            setLastMessage(`Target hit +${profit.toFixed(2)}%, selling...`);

            const guard = ensureGuards(fixerToken);
            if (guard) {
              setLastMessage(guard);
            } else {
              // Sell entire FIXERCOIN balance
              const sellAmount = fixerBal;
              const rawAmount = jupiterAPI.formatSwapAmount(
                sellAmount,
                fixerToken!.decimals,
              );
              const quote = await jupiterAPI.getQuote(
                FIXER_MINT,
                SOL_MINT,
                rawAmount as unknown as number,
                SLIPPAGE_BPS,
              );

              if (!quote) {
                setLastMessage("Quote failed");
              } else {
                const impact =
                  Math.abs(parseFloat(quote.priceImpactPct || "0")) * 100;
                if (isFinite(impact) && impact > MAX_PRICE_IMPACT_PCT) {
                  setLastMessage(`High impact ${impact.toFixed(2)}%`);
                } else {
                  const swap = await jupiterAPI.getSwapTransaction({
                    quoteResponse: quote,
                    userPublicKey: wallet.publicKey,
                    wrapAndUnwrapSol: true,
                  });

                  // Helper to send generic base64 transaction (versioned or legacy)
                  const sendSignedTxGeneric = async (
                    txBase64: string,
                  ): Promise<string> => {
                    // Try versioned tx signing first
                    try {
                      // Versioned
                      const buf = bytesFromBase64(txBase64);
                      const vtx = VersionedTransaction.deserialize(buf);
                      const kp = getKeypair();
                      if (!kp)
                        throw new Error("Missing keypair to sign transaction");
                      vtx.sign([kp]);
                      const signed = vtx.serialize();
                      const signedBase64 = base64FromBytes(signed);
                      // Send
                      const body = {
                        method: "sendTransaction",
                        params: [
                          signedBase64,
                          {
                            skipPreflight: false,
                            preflightCommitment: "confirmed",
                          },
                        ],
                        id: Date.now(),
                      };
                      const r = await fetch(resolveApiUrl("/api/solana-rpc"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      if (!r.ok) {
                        const t = await r.text().catch(() => "");
                        throw new Error(
                          `RPC ${r.status}: ${t || r.statusText}`,
                        );
                      }
                      const j = await r.json();
                      if (j.error)
                        throw new Error(j.error.message || "RPC error");
                      return j.result as string;
                    } catch (e) {
                      // Fallback to legacy Transaction signing
                      try {
                        const buf = bytesFromBase64(txBase64);
                        const tx = Transaction.from(buf);
                        const kp = getKeypair();
                        if (!kp)
                          throw new Error(
                            "Missing keypair to sign transaction",
                          );
                        tx.feePayer = kp.publicKey;
                        tx.sign(kp);
                        const signed = tx.serialize();
                        // convert to base64
                        let bin = "";
                        for (let i = 0; i < signed.length; i++)
                          bin += String.fromCharCode(signed[i]);
                        const signedBase64 = btoa(bin);
                        const body = {
                          method: "sendTransaction",
                          params: [
                            signedBase64,
                            {
                              skipPreflight: false,
                              preflightCommitment: "confirmed",
                            },
                          ],
                          id: Date.now(),
                        };
                        const r = await fetch(
                          resolveApiUrl("/api/solana-rpc"),
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body),
                          },
                        );
                        if (!r.ok) {
                          const t = await r.text().catch(() => "");
                          throw new Error(
                            `RPC ${r.status}: ${t || r.statusText}`,
                          );
                        }
                        const j = await r.json();
                        if (j.error)
                          throw new Error(j.error.message || "RPC error");
                        return j.result as string;
                      } catch (e2) {
                        throw e2;
                      }
                    }
                  };

                  if (!swap || !swap.swapTransaction) {
                    // Try unified /api/swap fallback (Meteora preferred)
                    try {
                      const buildResp = await fetch(
                        resolveApiUrl("/api/swap"),
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            provider: "meteora",
                            inputMint: FIXER_MINT,
                            outputMint: SOL_MINT,
                            amount: rawAmount,
                            wallet: wallet.publicKey,
                            sign: false,
                          }),
                        },
                      );
                      if (buildResp.ok) {
                        const jb = await buildResp.json();
                        const swapData = jb?.swap || jb;
                        const txBase64 =
                          swapData?.transaction ||
                          swapData?.swapTransaction ||
                          swapData?.transactionBase64 ||
                          swapData?.base64 ||
                          null;
                        if (!txBase64) {
                          setLastMessage("Swap tx missing (meteora fallback)");
                        } else {
                          const sig = await sendSignedTxGeneric(txBase64);
                          setLastMessage(`Sold ✔ ${sig.slice(0, 8)}...`);
                          setLastRunAt(Date.now());
                          toast({
                            title: "Sold FIXERCOIN",
                            description: `+${profit.toFixed(2)}% to SOL`,
                          });

                          // Clear position after selling
                          savePosition(null);

                          setTimeout(() => {
                            refreshBalance();
                            refreshTokens();
                          }, 2000);
                        }
                      } else {
                        const txt = await buildResp.text().catch(() => "");
                        setLastMessage(
                          `Swap build failed: ${buildResp.status}`,
                        );
                        console.warn("Meteora fallback failed:", txt);
                      }
                    } catch (e) {
                      console.warn("Fallback swap error:", e);
                      setLastMessage("Swap tx missing");
                    }
                  } else {
                    const sig = await sendSignedTx(swap.swapTransaction);
                    setLastMessage(`Sold ✔ ${sig.slice(0, 8)}...`);
                    setLastRunAt(Date.now());
                    toast({
                      title: "Sold FIXERCOIN",
                      description: `+${profit.toFixed(2)}% to SOL`,
                    });

                    // Clear position after selling
                    savePosition(null);

                    // Refresh balances
                    setTimeout(() => {
                      refreshBalance();
                      refreshTokens();
                    }, 2000);
                  }
                }
              }
            }
            return; // end SELL path
          }
        }
      }

      // BUY logic: if not in position and have SOL above reserve, buy FIXERCOIN
      if (!pos) {
        const guard = ensureGuards(solToken);
        if (guard) {
          setLastMessage(guard);
        } else {
          const tradeAmount = computeTradeAmountSol();
          if (tradeAmount <= 0 || solBal <= MIN_SOL_RESERVE) {
            setLastMessage("No SOL to buy");
          } else {
            setLastMessage(
              `Buying FIXERCOIN with ${tradeAmount.toFixed(6)} SOL...`,
            );
            const rawAmount = jupiterAPI.formatSwapAmount(
              tradeAmount,
              solToken!.decimals,
            );
            const quote = await jupiterAPI.getQuote(
              SOL_MINT,
              FIXER_MINT,
              rawAmount as unknown as number,
              SLIPPAGE_BPS,
            );
            if (!quote) {
              setLastMessage("Quote failed");
            } else {
              const impact =
                Math.abs(parseFloat(quote.priceImpactPct || "0")) * 100;
              if (isFinite(impact) && impact > MAX_PRICE_IMPACT_PCT) {
                setLastMessage(`High impact ${impact.toFixed(2)}%`);
              } else {
                const swap = await jupiterAPI.getSwapTransaction({
                  quoteResponse: quote,
                  userPublicKey: wallet.publicKey,
                  wrapAndUnwrapSol: true,
                });

                // Try meteora fallback if Jupiter doesn't return swapTransaction
                if (!swap || !swap.swapTransaction) {
                  try {
                    const buildResp = await fetch(resolveApiUrl("/api/swap"), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        provider: "meteora",
                        inputMint: SOL_MINT,
                        outputMint: FIXER_MINT,
                        amount: rawAmount,
                        wallet: wallet.publicKey,
                        sign: false,
                      }),
                    });
                    if (buildResp.ok) {
                      const jb = await buildResp.json();
                      const swapData = jb?.swap || jb;
                      const txBase64 =
                        swapData?.transaction ||
                        swapData?.swapTransaction ||
                        swapData?.transactionBase64 ||
                        swapData?.base64 ||
                        null;
                      if (!txBase64) {
                        setLastMessage("Swap tx missing (meteora fallback)");
                      } else {
                        const sig = await sendSignedTxGeneric(txBase64);

                        const qty = jupiterAPI.parseSwapAmount(
                          quote.outAmount,
                          fixerToken?.decimals || 6,
                        );
                        const entryPrice = await getCurrentFixerPriceUsd();

                        if (entryPrice && entryPrice > 0 && qty > 0) {
                          savePosition({
                            entryPriceUsd: entryPrice,
                            qty,
                            entrySolSpent: tradeAmount,
                            ts: Date.now(),
                          });
                        }

                        setLastMessage(`Bought ✔ ${sig.slice(0, 8)}...`);
                        setLastRunAt(Date.now());
                        toast({
                          title: "Bought FIXERCOIN",
                          description: `${qty.toFixed(6)} FIXERCOIN`,
                        });

                        setTimeout(() => {
                          refreshBalance();
                          refreshTokens();
                        }, 2000);
                      }
                    } else {
                      const txt = await buildResp.text().catch(() => "");
                      console.warn("Meteora fallback failed:", txt);
                      setLastMessage(`Swap build failed: ${buildResp.status}`);
                    }
                  } catch (e) {
                    console.warn("Fallback swap error:", e);
                    setLastMessage("Swap tx missing");
                  }
                } else {
                  const sig = await sendSignedTx(swap.swapTransaction);

                  const qty = jupiterAPI.parseSwapAmount(
                    quote.outAmount,
                    fixerToken?.decimals || 6,
                  );
                  const entryPrice = await getCurrentFixerPriceUsd();

                  if (entryPrice && entryPrice > 0 && qty > 0) {
                    savePosition({
                      entryPriceUsd: entryPrice,
                      qty,
                      entrySolSpent: tradeAmount,
                      ts: Date.now(),
                    });
                  }
                  setLastMessage(`Bought ✔ ${sig.slice(0, 8)}...`);
                  setLastRunAt(Date.now());
                  toast({
                    title: "Bought FIXERCOIN",
                    description: `${qty.toFixed(6)} FIXERCOIN`,
                  });

                  setTimeout(() => {
                    refreshBalance();
                    refreshTokens();
                  }, 2000);
                }
              }
            }
          }
        }
      } else {
        setLastMessage("Holding position");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastMessage(`Error: ${msg}`);
    } finally {
      inFlightRef.current = false;
      setIsTicking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    wallet,
    tokens,
    fixerToken?.balance,
    solToken?.balance,
    fixerToken?.price,
  ]);

  // Timer
  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    timerRef.current = setInterval(
      () => {
        runOnce();
      },
      Math.max(15, INTERVAL_SEC) * 1000,
    );
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, runOnce]);

  const canRun = !!wallet && !!solToken && !!fixerToken;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-white">AI Trading</h1>
        </div>

        <div className="space-y-6">
          {/* Status */}
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center ring-2 ring-orange-400/30">
                    <Bot className="h-5 w-5 text-orange-300" />
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {enabled ? (isTicking ? "Running" : "Armed") : "Paused"}
                    </div>
                    <div className="text-xs text-gray-300">{lastMessage}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Last Run</div>
                  <div className="text-sm text-white">
                    {lastRunAt ? new Date(lastRunAt).toLocaleTimeString() : "—"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-black/30 border-white/3">
                  <CardContent className="p-3 text-center">
                    <Zap className="h-5 w-5 text-cream mx-auto mb-1" />
                    <div className="text-xs text-gray-400">SOL</div>
                    <div className="text-sm text-white">
                      {(solToken?.balance || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-black/30 border-white/3">
                  <CardContent className="p-3 text-center">
                    <Shield className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                    <div className="text-xs text-gray-400">FIXERCOIN</div>
                    <div className="text-sm text-white">
                      {(fixerToken?.balance || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-black/30 border-white/3">
                  <CardContent className="p-3 text-center">
                    <Clock className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                    <div className="text-xs text-gray-400">PnL</div>
                    <div className="text-sm text-white">
                      {pnlPct === null ? "—" : `${pnlPct.toFixed(2)}%`}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => runOnce()}
                  disabled={!canRun || isTicking}
                  className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white"
                >
                  <Play className="h-4 w-4 mr-2" /> Run Now
                </Button>
                <Button
                  onClick={() => setEnabled((e) => !e)}
                  variant="outline"
                  className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                >
                  <Square className="h-4 w-4 mr-2" />{" "}
                  {enabled ? "Pause" : "Resume"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
