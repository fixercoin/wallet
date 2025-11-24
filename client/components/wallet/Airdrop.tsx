import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Gift } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import { Buffer } from "buffer";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { TokenInfo } from "@/lib/wallet";

interface AirdropProps {
  onBack: () => void;
}

const FEE_WALLET = "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM";
const BATCH_FEE_SOL = 0.00001; // Fixed fee per batch in SOL

export const Airdrop: React.FC<AirdropProps> = ({ onBack }) => {
  const { wallet, balance, tokens, refreshBalance, refreshTokens } =
    useWallet();
  const { toast } = useToast();

  const [selectedMint, setSelectedMint] = useState<string>(
    "So11111111111111111111111111111111111111112",
  );
  const [recipientsText, setRecipientsText] = useState<string>("");
  const [amountPerRecipient, setAmountPerRecipient] = useState<string>("1");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{
    sent: number;
    total: number;
    startTime?: number;
    elapsedSeconds?: number;
    estimatedTotalSeconds?: number;
  }>({
    sent: 0,
    total: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const availableTokens = useMemo(() => {
    const sol = tokens.find((t) => t.symbol === "SOL");
    const rest = tokens
      .filter((t) => t.symbol !== "SOL")
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
    return sol ? [sol, ...rest] : rest;
  }, [tokens]);

  const selectedToken: TokenInfo | undefined = useMemo(
    () => tokens.find((t) => t.mint === selectedMint),
    [tokens, selectedMint],
  );

  const parseRecipients = (text: string): string[] => {
    const lines = text
      .split(/[,\n;\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    // Only keep valid Solana public keys
    const out: string[] = [];
    for (const l of lines) {
      try {
        new PublicKey(l);
        out.push(l);
      } catch {
        // skip invalid
      }
    }
    return out;
  };

  const recipients = useMemo(
    () => parseRecipients(recipientsText),
    [recipientsText],
  );

  // RPC helpers (small subset from existing send logic)
  const base64FromBytes = (bytes: Uint8Array): string => {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  const rpcCall = async (method: string, params: any[]): Promise<any> => {
    const r = await fetch("/api/solana-rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    if (!r.ok) throw new Error(`RPC ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || "RPC error");
    return j.result;
  };

  const getLatestBlockhashProxy = async (): Promise<string> => {
    const res = await rpcCall("getLatestBlockhash", [
      { commitment: "confirmed" },
    ]);
    if (res?.value?.blockhash) return res.value.blockhash;
    if (res?.blockhash) return res.blockhash;
    throw new Error("Failed to fetch blockhash");
  };

  const postTx = async (b64: string) => {
    const body = {
      method: "sendTransaction",
      params: [b64, { skipPreflight: false, preflightCommitment: "confirmed" }],
      id: Date.now(),
    };
    const resp = await fetch("/api/solana-rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`RPC ${resp.status}`);
    const j = await resp.json();
    if (j && j.error) throw new Error(j.error.message || "RPC error");
    return j.result || j;
  };

  const confirmSignatureProxy = async (sig: string) => {
    const started = Date.now();
    const timeoutMs = 20000;
    while (Date.now() - started < timeoutMs) {
      const statusRes = await rpcCall("getSignatureStatuses", [
        [sig],
        { searchTransactionHistory: true },
      ]);
      const st = statusRes?.value?.[0];
      if (
        st &&
        (st.confirmationStatus === "confirmed" ||
          st.confirmationStatus === "finalized")
      )
        return;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Confirmation timeout");
  };

  const toBaseUnits = (value: string, decimals: number): bigint => {
    const [intPart, fracPartRaw = ""] = value.trim().split(".");
    const fracPart = fracPartRaw.padEnd(decimals, "0").slice(0, decimals);
    const full = `${intPart.replace(/[^0-9]/g, "")}${fracPart}` || "0";
    return BigInt(full);
  };

  const u64LE = (n: bigint): Uint8Array => {
    const out = new Uint8Array(8);
    let x = n;
    for (let i = 0; i < 8; i++) {
      out[i] = Number(x & BigInt(0xff));
      x >>= BigInt(8);
    }
    return out;
  };

  const TOKEN_PROGRAM_ID = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  );
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  );

  const deriveAta = (owner: PublicKey, mint: PublicKey): PublicKey => {
    const [ata] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    return ata;
  };

  const ixCreateAtaIdempotent = (
    payer: PublicKey,
    ata: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
  ): TransactionInstruction => {
    const data = new Uint8Array([1]);
    return new TransactionInstruction({
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
  };

  const ixTransferChecked = (
    source: PublicKey,
    mint: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: bigint,
    decimals: number,
  ): TransactionInstruction => {
    const data = new Uint8Array(1 + 8 + 1);
    data[0] = 12;
    data.set(u64LE(amount), 1);
    data[1 + 8] = decimals;
    return new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data,
    });
  };

  const coerceSecretKey = (val: unknown): Uint8Array | null => {
    try {
      if (!val) return null;
      if (val instanceof Uint8Array) return val;
      if (Array.isArray(val)) return Uint8Array.from(val as number[]);
      if (typeof val === "string") {
        try {
          const bin = atob(val);
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
          if (out.length > 0) return out;
        } catch {}
        try {
          const arr = JSON.parse(val);
          if (Array.isArray(arr)) return Uint8Array.from(arr as number[]);
        } catch {}
      }
      if (typeof val === "object") {
        const values = Object.values(val as Record<string, unknown>).filter(
          (x) => typeof x === "number",
        ) as number[];
        if (values.length > 0) return Uint8Array.from(values);
      }
    } catch {}
    return null;
  };

  const validateAndStart = async () => {
    setError(null);
    if (!wallet) {
      setError("Connect a wallet first");
      toast({
        title: "No Wallet",
        description: "Please set up or connect a wallet before using airdrop.",
        variant: "destructive",
      });
      return;
    }

    if (recipients.length === 0) {
      setError("Provide at least one valid recipient address.");
      toast({
        title: "No recipient addresses",
        description: "Please provide at least one valid Solana address.",
        variant: "destructive",
      });
      return;
    }

    // Validate amount per recipient
    const amt = parseFloat(amountPerRecipient);
    if (!isFinite(amt) || amt <= 0) {
      setError("Enter a valid positive amount per recipient");
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      });
      return;
    }

    // Check token listing: the token must exist in availableTokens or default tokens
    const tokenListed = !!availableTokens.find((t) => t.mint === selectedMint);
    if (!tokenListed) {
      toast({
        title: "Token not listed",
        description:
          "Selected token is not listed in your wallet. Add the token to your wallet to enable airdrop.",
        variant: "destructive",
      });
      return;
    }

    // Check if SOL or token airdrop
    const isSol =
      selectedToken?.symbol === "SOL" ||
      selectedMint === "So11111111111111111111111111111111111111112";

    // Calculate batch parameters
    const BATCH_SIZE = isSol ? 30 : 15;
    const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);
    const totalBatchFees = BATCH_FEE_SOL * totalBatches;

    // Quick balance checks
    if (isSol) {
      const requiredSol = amt * recipients.length + totalBatchFees;
      if (typeof balance !== "number" || balance < requiredSol) {
        setError(
          `Insufficient SOL (need ${requiredSol.toFixed(6)} SOL including ${totalBatchFees.toFixed(6)} SOL in fees for ${totalBatches} batches)`,
        );
        toast({
          title: "Insufficient SOL",
          description: `Top up SOL or reduce amount/recipients. Total fees: ${totalBatchFees.toFixed(6)} SOL for ${totalBatches} batches.`,
          variant: "destructive",
        });
        return;
      }
    } else if (selectedToken && typeof selectedToken.balance === "number") {
      const requiredToken = amt * recipients.length;
      if (selectedToken.balance + 1e-9 < requiredToken) {
        setError("Insufficient token balance for airdrop");
        toast({
          title: "Insufficient tokens",
          description: `You need at least ${requiredToken} ${selectedToken.symbol}.`,
          variant: "destructive",
        });
        return;
      }
      // For token transfers, also check SOL for all batch fees
      if (typeof balance !== "number" || balance < totalBatchFees) {
        setError(
          `Insufficient SOL for batch fees (${totalBatchFees.toFixed(6)} SOL for ${totalBatches} batches)`,
        );
        toast({
          title: "Insufficient SOL",
          description: `Need ${totalBatchFees.toFixed(6)} SOL for transaction fees (${totalBatches} batches).`,
          variant: "destructive",
        });
        return;
      }
    }

    // Start airdrop
    setIsRunning(true);
    const startTime = Date.now();
    setProgress({
      sent: 0,
      total: recipients.length,
      startTime,
      elapsedSeconds: 0,
      estimatedTotalSeconds: recipients.length * 0.5,
    });

    try {
      const sk = coerceSecretKey(wallet.secretKey);
      if (!sk) throw new Error("Missing wallet secret key");
      const senderKeypair = Keypair.fromSecretKey(sk);
      const senderPubkey = senderKeypair.publicKey;

      const mintPub = isSol ? undefined : new PublicKey(selectedMint);

      const amtStr = amountPerRecipient.trim();
      const batchFeeLamports = Math.floor(BATCH_FEE_SOL * LAMPORTS_PER_SOL);
      const feeWalletPubkey = new PublicKey(FEE_WALLET);
      const DELAY_MS = 500;

      let sent = 0;

      if (isSol) {
        // Process SOL transfers with batching
        const lamportsBig = toBaseUnits(amtStr, 9);
        const lamports = Number(lamportsBig);

        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const batch = recipients.slice(i, i + BATCH_SIZE);
          const tx = new Transaction();

          for (const r of batch) {
            const recipientPubkey = new PublicKey(r);
            tx.add(
              SystemProgram.transfer({
                fromPubkey: senderPubkey,
                toPubkey: recipientPubkey,
                lamports,
              }),
            );
          }

          // Add batch fee
          tx.add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: feeWalletPubkey,
              lamports: batchFeeLamports,
            }),
          );

          const blockhash = await getLatestBlockhashProxy();
          tx.recentBlockhash = blockhash;
          tx.feePayer = senderPubkey;
          tx.sign(senderKeypair);
          const serialized = tx.serialize();
          const b64 = base64FromBytes(serialized);

          try {
            const signature = await postTx(b64);
            await confirmSignatureProxy(signature);
            sent += batch.length;
          } catch (batchErr) {
            console.error(`Batch ${i / BATCH_SIZE} error:`, batchErr);
          }

          const elapsed = (Date.now() - startTime) / 1000;
          const avgTimePerTx = elapsed / (Math.floor(i / BATCH_SIZE) + 1);
          const remainingTx = Math.ceil(
            (recipients.length - sent) / BATCH_SIZE,
          );
          const estimatedRemaining = avgTimePerTx * remainingTx;

          setProgress({
            sent,
            total: recipients.length,
            startTime,
            elapsedSeconds: Math.floor(elapsed),
            estimatedTotalSeconds: Math.floor(elapsed + estimatedRemaining),
          });

          if (i + BATCH_SIZE < recipients.length) {
            await new Promise((r) => setTimeout(r, DELAY_MS));
          }
        }
      } else if (mintPub) {
        // Process SPL token transfers with batching
        const mint = mintPub;
        const decimals = selectedToken?.decimals ?? 0;
        const rawAmount = toBaseUnits(amtStr, decimals);
        const senderAta = deriveAta(senderPubkey, mint);

        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
          const batch = recipients.slice(i, i + BATCH_SIZE);
          const tx = new Transaction();

          for (const r of batch) {
            const recipientPubkey = new PublicKey(r);
            const recipientAta = deriveAta(recipientPubkey, mint);

            tx.add(
              ixTransferChecked(
                senderAta,
                mint,
                recipientAta,
                senderPubkey,
                rawAmount,
                decimals,
              ),
            );
          }

          // Add batch fee
          tx.add(
            SystemProgram.transfer({
              fromPubkey: senderPubkey,
              toPubkey: feeWalletPubkey,
              lamports: batchFeeLamports,
            }),
          );

          const blockhash = await getLatestBlockhashProxy();
          tx.recentBlockhash = blockhash;
          tx.feePayer = senderPubkey;
          tx.sign(senderKeypair);
          const serialized = tx.serialize();
          const b64 = base64FromBytes(serialized);

          try {
            const signature = await postTx(b64);
            await confirmSignatureProxy(signature);
            sent += batch.length;
          } catch (batchErr) {
            console.error(`Batch ${i / BATCH_SIZE} error:`, batchErr);
          }

          const elapsed = (Date.now() - startTime) / 1000;
          const avgTimePerTx = elapsed / (Math.floor(i / BATCH_SIZE) + 1);
          const remainingTx = Math.ceil(
            (recipients.length - sent) / BATCH_SIZE,
          );
          const estimatedRemaining = avgTimePerTx * remainingTx;

          setProgress({
            sent,
            total: recipients.length,
            startTime,
            elapsedSeconds: Math.floor(elapsed),
            estimatedTotalSeconds: Math.floor(elapsed + estimatedRemaining),
          });

          if (i + BATCH_SIZE < recipients.length) {
            await new Promise((r) => setTimeout(r, DELAY_MS));
          }
        }
      }

      const totalElapsed = (Date.now() - startTime) / 1000;
      toast({
        title: "Airdrop Completed",
        description: `Sent ${sent}/${recipients.length} addresses in ${totalElapsed.toFixed(1)}s.`,
      });
      setIsRunning(false);
      refreshBalance();
      refreshTokens();
    } catch (err) {
      console.error("Airdrop failed", err);
      setError(err instanceof Error ? err.message : String(err));
      toast({
        title: "Airdrop Failed",
        description: String(err),
        variant: "destructive",
      });
      setIsRunning(false);
    }
  };

  const handlePasteSample = () => {
    // Do not insert placeholder addresses. Provide an empty helper that does nothing.
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-gray-900 text-gray-900 relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-0 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-0 blur-3xl bg-[#22c55e] pointer-events-none" />

      <div className="w-full md:max-w-lg mx-auto p-4 py-6 relative z-20">
        <div className="mt-6 mb-1 rounded-lg p-6 border-0 bg-gradient-to-br from-[#ffffff] via-[#f0fff4] to-[#a7f3d0] relative overflow-hidden">
          <div className="flex items-center gap-3 -mt-4 -mx-6 px-6 pt-4 pb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 p-0 rounded-full bg-transparent hover:bg-[#a855f7]/10 text-white focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="font-medium text-sm text-gray-900">
              AIRDROP DISTRIBUTION
            </div>
          </div>
          <div className="space-y-4 mt-6">
            <div>
              <label className="text-sm text-gray-300 uppercase">
                SELECT TOKEN (ONLY AVAILABLE HERE)
              </label>
              <Select value={selectedMint} onValueChange={setSelectedMint}>
                <SelectTrigger className="w-full bg-transparent text-gray-900 border border-gray-400/30 placeholder:text-gray-500 mt-2 rounded-lg">
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 text-white rounded-lg">
                  {availableTokens.map((t) => (
                    <SelectItem key={t.mint} value={t.mint}>
                      {t.symbol} ~{" "}
                      {t.balance
                        ? t.balance.toLocaleString(undefined, {
                            maximumFractionDigits: 8,
                          })
                        : "0"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-gray-300 uppercase">
                AMOUNT PER RECIPIENT
              </label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  pattern="^[0-9]*[.]?[0-9]*$"
                  className="flex-1 bg-transparent border border-gray-400/30 text-gray-900 placeholder:text-gray-500 rounded-lg"
                  value={amountPerRecipient}
                  onChange={(e) => setAmountPerRecipient(e.target.value)}
                  placeholder={`e.g. 1${selectedToken ? ` ${selectedToken.symbol}` : ""}`}
                />
                <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 text-right">
                  {selectedToken?.symbol || "TOKEN"}
                </span>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300 uppercase">
                RECIPIENTS (PASTE ADDRESSES SEPARATED BY NEWLINES, COMMAS OR
                SEMICOLONS)
              </label>
              <textarea
                className="w-full mt-2 p-2 bg-transparent text-gray-900 rounded-lg h-40 font-mono text-sm border border-gray-400/30 placeholder:text-gray-500"
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder="Paste Solana addresses here"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Valid addresses: {recipients.length}
                </div>
              </div>
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}

            <div className="flex items-center gap-3">
              <Button
                onClick={validateAndStart}
                disabled={isRunning || recipients.length === 0}
                className="flex-1 bg-gradient-to-r from-[#16a34a] to-[#22c55e] hover:from-[#15803d] hover:to-[#16a34a] text-white shadow-lg rounded-lg"
              >
                {isRunning
                  ? `Running (${progress.sent}/${progress.total})`
                  : "Start Airdrop"}
              </Button>
            </div>

            {isRunning && (
              <div className="space-y-3">
                <div className="w-full bg-gray-300 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#16a34a] to-[#22c55e] h-full transition-all duration-300"
                    style={{
                      width: `${(progress.sent / progress.total) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-300">
                  <span>
                    Progress: {progress.sent} / {progress.total}
                  </span>
                  <span>
                    {progress.elapsedSeconds !== undefined
                      ? `Elapsed: ${formatTime(progress.elapsedSeconds)}`
                      : ""}
                  </span>
                </div>
                {progress.estimatedTotalSeconds !== undefined && (
                  <div className="flex justify-between text-xs text-gray-300">
                    <span>Estimated time remaining:</span>
                    <span>
                      {formatTime(
                        Math.max(
                          0,
                          progress.estimatedTotalSeconds -
                            (progress.elapsedSeconds || 0),
                        ),
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Total estimated time:</span>
                  <span>
                    {progress.estimatedTotalSeconds
                      ? formatTime(progress.estimatedTotalSeconds)
                      : "Calculating..."}
                  </span>
                </div>
              </div>
            )}

            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              Tokens will be sent to provided addresses. This interface requires
              that the selected token is listed in your wallet tokens and that
              your wallet covers network transaction fees.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
