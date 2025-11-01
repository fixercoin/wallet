import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Lock as LockIcon,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import { shortenAddress } from "@/lib/wallet";
import type { TokenInfo } from "@/lib/wallet";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import bs58 from "bs58";

interface TokenLockProps {
  onBack: () => void;
}

type LockStatus = "locked" | "withdrawing" | "withdrawn";

interface TokenLockRecord {
  id: string;
  mint: string;
  symbol: string;
  amount: string;
  amountRaw: string;
  decimals: number;
  createdAt: string;
  unlockAt: string;
  autoWithdraw: boolean;
  escrowPublicKey: string;
  escrowSecretKey: string;
  status: LockStatus;
  lockSignature?: string;
  withdrawSignature?: string;
  error?: string | null;
  lastAttemptAt?: string | null;
}

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const DEFAULT_LOCK_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 3 months default
const LOCK_OPTIONS: { label: string; ms: number; id: string }[] = [
  { label: "10 minutes", ms: 10 * 60 * 1000, id: "10min" },
  { label: "1 week", ms: 7 * 24 * 60 * 60 * 1000, id: "1week" },
  { label: "1 month", ms: 30 * 24 * 60 * 60 * 1000, id: "1month" },
  { label: "3 months", ms: 90 * 24 * 60 * 60 * 1000, id: "3months" },
];

const storageKeyForWallet = (walletPubkey: string) =>
  `spl_token_locks_${walletPubkey}`;

const base64FromBytes = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

const bytesFromBase64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const coerceSecretKey = (val: unknown): Uint8Array | null => {
  try {
    if (!val) return null;
    if (val instanceof Uint8Array) return val;
    if (Array.isArray(val)) return Uint8Array.from(val as number[]);
    if (typeof val === "string") {
      try {
        const decoded = bytesFromBase64(val);
        if (decoded.length > 0) return decoded;
      } catch {}
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return Uint8Array.from(parsed as number[]);
      } catch {}
    }
    if (typeof val === "object") {
      const arr = Object.values(val as Record<string, unknown>).filter(
        (v) => typeof v === "number",
      ) as number[];
      if (arr.length > 0) return Uint8Array.from(arr);
    }
  } catch {}
  return null;
};

const toBaseUnits = (value: string, decimals: number): bigint => {
  const [intPart, fracPartRaw = ""] = value.trim().split(".");
  const fracPart = fracPartRaw.padEnd(decimals, "0").slice(0, decimals);
  const full = `${intPart.replace(/[^0-9]/g, "")}${fracPart}` || "0";
  return BigInt(full);
};

const fromBaseUnits = (amount: bigint, decimals: number): string => {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return fractionStr.length > 0 ? `${whole}.${fractionStr}` : whole.toString();
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
  data[9] = decimals;
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

const rpcCall = async (method: string, params: any[]): Promise<any> => {
  const resp = await fetch(resolveApiUrl("/api/solana-rpc"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`RPC ${resp.status}: ${text || resp.statusText}`);
  }
  const json = await resp.json();
  if (json?.error) throw new Error(json.error.message || "RPC error");
  return json.result;
};

const getLatestBlockhashProxy = async (): Promise<string> => {
  const res = await rpcCall("getLatestBlockhash", [
    { commitment: "confirmed" },
  ]);
  if (res?.value?.blockhash) return res.value.blockhash;
  if (res?.blockhash) return res.blockhash;
  throw new Error("Failed to fetch blockhash");
};

const confirmSignatureProxy = async (signature: string): Promise<void> => {
  const start = Date.now();
  const timeoutMs = 20000;
  while (Date.now() - start < timeoutMs) {
    const statusRes = await rpcCall("getSignatureStatuses", [
      [signature],
      { searchTransactionHistory: true },
    ]);
    const status = statusRes?.value?.[0];
    if (
      status &&
      (status.confirmationStatus === "confirmed" ||
        status.confirmationStatus === "finalized")
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Confirmation timeout");
};

const postTransaction = async (serialized: Uint8Array): Promise<string> => {
  const b64 = base64FromBytes(serialized);
  const body = {
    method: "sendTransaction",
    params: [b64, { skipPreflight: false, preflightCommitment: "confirmed" }],
    id: Date.now(),
  };
  const resp = await fetch(resolveApiUrl("/api/solana-rpc"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`RPC ${resp.status}: ${text || resp.statusText}`);
  }
  const json = await resp.json().catch(() => null);
  if (json?.error) {
    const message = json.error.message || "RPC error";
    if (/invalid base58/i.test(message)) {
      const base58 = bs58.encode(serialized);
      const fallbackPayload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "sendTransaction",
        params: [
          base58,
          { skipPreflight: false, preflightCommitment: "confirmed" },
        ],
      };
      const fallback = await fetch(resolveApiUrl("/api/solana-rpc"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackPayload),
      });
      if (!fallback.ok) {
        const fallbackText = await fallback.text().catch(() => "");
        throw new Error(
          `RPC ${fallback.status}: ${fallbackText || fallback.statusText}`,
        );
      }
      const fallbackJson = await fallback.json().catch(() => null);
      if (fallbackJson?.error) {
        throw new Error(fallbackJson.error.message || "RPC error");
      }
      return fallbackJson?.result || fallbackJson;
    }
    throw new Error(message);
  }
  return json?.result || json;
};

const formatDateTime = (dateIso: string): string => {
  const date = new Date(dateIso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const createId = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `lock_${Date.now()}_${random}`;
};

export const TokenLock: React.FC<TokenLockProps> = ({ onBack }) => {
  const { wallet, tokens, refreshTokens } = useWallet();
  const { toast } = useToast();

  const [selectedMint, setSelectedMint] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [autoWithdraw, setAutoWithdraw] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [locks, setLocks] = useState<TokenLockRecord[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [selectedLockOption, setSelectedLockOption] =
    useState<string>("3months");

  const storageKey = wallet ? storageKeyForWallet(wallet.publicKey) : null;

  useEffect(() => {
    if (!wallet) return;
    try {
      const stored = localStorage.getItem(
        storageKeyForWallet(wallet.publicKey),
      );
      if (stored) {
        const parsed = JSON.parse(stored) as TokenLockRecord[];
        setLocks(parsed);
      } else {
        setLocks([]);
      }
    } catch (error) {
      console.error("Failed to read token locks", error);
      setLocks([]);
    }
  }, [wallet]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(locks));
    } catch (error) {
      console.error("Failed to persist token locks", error);
    }
  }, [locks, storageKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const availableTokens = useMemo(() => {
    return tokens
      .filter((token) => token.mint && token.symbol !== "SOL")
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
  }, [tokens]);

  useEffect(() => {
    if (selectedMint) return;
    if (availableTokens.length > 0) {
      setSelectedMint(availableTokens[0].mint);
    }
  }, [availableTokens, selectedMint]);

  const selectedToken = useMemo<TokenInfo | undefined>(
    () => tokens.find((token) => token.mint === selectedMint),
    [tokens, selectedMint],
  );

  const validateForm = useCallback((): string | null => {
    if (!wallet) return "Connect wallet to lock tokens";
    if (!selectedToken) return "Select a token";
    if (!amount.trim()) return "Amount is required";
    const amountNum = Number(amount);
    if (!isFinite(amountNum) || amountNum <= 0) return "Enter a valid amount";
    if ((selectedToken.balance || 0) < amountNum)
      return "Insufficient token balance";
    return null;
  }, [wallet, selectedToken, amount]);

  const formatTimeRemaining = (unlockAtIso: string): string => {
    const unlockAt = new Date(unlockAtIso).getTime();
    const delta = unlockAt - now;
    if (delta <= 0) return "Unlocked";
    const totalSeconds = Math.floor(delta / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const progressForLock = (lock: TokenLockRecord): number => {
    const created = new Date(lock.createdAt).getTime();
    const unlockAt = new Date(lock.unlockAt).getTime();
    const span = unlockAt - created;
    if (span <= 0) return 100;
    const progress = ((now - created) / span) * 100;
    return Math.max(0, Math.min(100, progress));
  };

  const decodeEscrowKeypair = (lock: TokenLockRecord): Keypair => {
    const secret = bytesFromBase64(lock.escrowSecretKey);
    return Keypair.fromSecretKey(secret);
  };

  const performWithdraw = useCallback(
    async (lock: TokenLockRecord, opts?: { auto?: boolean }) => {
      if (!wallet) throw new Error("Wallet not connected");
      const unlockAt = new Date(lock.unlockAt).getTime();
      setLocks((prev) =>
        prev.map((item) =>
          item.id === lock.id
            ? { ...item, status: "withdrawing", error: null }
            : item,
        ),
      );
      try {
        const slot = await rpcCall("getSlot", []);
        const blockTime = await rpcCall("getBlockTime", [slot]);
        if (typeof blockTime === "number") {
          if (blockTime * 1000 < unlockAt) {
            throw new Error("Tokens are still within the lock period");
          }
        } else {
          const currentTs = Date.now();
          if (currentTs < unlockAt) {
            throw new Error("Tokens are still within the lock period");
          }
        }

        const walletSecret = coerceSecretKey(wallet.secretKey);
        if (!walletSecret) throw new Error("Missing wallet secret key");
        const walletKeypair = Keypair.fromSecretKey(walletSecret);
        const escrowKeypair = decodeEscrowKeypair(lock);

        const mint = new PublicKey(lock.mint);
        const sourceAta = deriveAta(escrowKeypair.publicKey, mint);
        const destinationAta = deriveAta(walletKeypair.publicKey, mint);

        const instructions: TransactionInstruction[] = [];
        instructions.push(
          ixCreateAtaIdempotent(
            walletKeypair.publicKey,
            destinationAta,
            walletKeypair.publicKey,
            mint,
          ),
        );
        instructions.push(
          ixTransferChecked(
            sourceAta,
            mint,
            destinationAta,
            escrowKeypair.publicKey,
            BigInt(lock.amountRaw),
            lock.decimals,
          ),
        );

        const transaction = new Transaction().add(...instructions);
        const blockhash = await getLatestBlockhashProxy();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = walletKeypair.publicKey;

        transaction.partialSign(escrowKeypair);
        transaction.sign(walletKeypair, escrowKeypair);

        const serialized = transaction.serialize();
        const signature = await postTransaction(serialized);
        await confirmSignatureProxy(signature);

        setLocks((prev) =>
          prev.map((item) =>
            item.id === lock.id
              ? {
                  ...item,
                  status: "withdrawn",
                  withdrawSignature: signature,
                  lastAttemptAt: new Date().toISOString(),
                  error: null,
                }
              : item,
          ),
        );
        // Persist withdraw event to Cloudflare (best-effort)
        try {
          await fetch(resolveApiUrl(`/api/locks/${lock.id}/withdraw`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: lock.amount,
              txSignature: signature,
              note: `escrow:${lock.escrowPublicKey}`,
            }),
          });
        } catch {}

        await refreshTokens();
        if (!opts?.auto) {
          toast({
            title: "Withdrawal complete",
            description: `${lock.amount} ${lock.symbol} withdrawn`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setLocks((prev) =>
          prev.map((item) =>
            item.id === lock.id
              ? {
                  ...item,
                  status: "locked",
                  error: message,
                  lastAttemptAt: new Date().toISOString(),
                }
              : item,
          ),
        );
        if (!opts?.auto) {
          toast({
            title: "Withdrawal failed",
            description: message,
            variant: "destructive",
          });
        }
      }
    },
    [wallet, refreshTokens, toast],
  );

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Cannot lock tokens",
        description: validationError,
        variant: "destructive",
      });
      return;
    }
    if (!wallet || !selectedToken) return;

    setIsSubmitting(true);
    // Optimistic save: create lock entry immediately to avoid data loss on crash
    // If transaction fails before submission, we'll remove this entry.
    let lockId = createId();
    let submittedSignature: string | null = null;
    let escrowKeypair: Keypair | null = null;
    try {
      const walletSecret = coerceSecretKey(wallet.secretKey);
      if (!walletSecret) throw new Error("Missing wallet secret key");
      const walletKeypair = Keypair.fromSecretKey(walletSecret);
      const amountRaw = toBaseUnits(amount, selectedToken.decimals ?? 0);
      if (amountRaw <= BigInt(0)) throw new Error("Invalid amount");

      escrowKeypair = Keypair.generate();
      const mint = new PublicKey(selectedToken.mint);
      const sourceAta = deriveAta(walletKeypair.publicKey, mint);
      const destinationAta = deriveAta(escrowKeypair.publicKey, mint);

      const selectedOption = LOCK_OPTIONS.find(
        (o) => o.id === selectedLockOption,
      );
      const durationMs = selectedOption
        ? selectedOption.ms
        : DEFAULT_LOCK_DURATION_MS;

      const provisional: TokenLockRecord = {
        id: lockId,
        mint: selectedToken.mint,
        symbol: selectedToken.symbol || selectedToken.mint.slice(0, 6),
        amount,
        amountRaw: amountRaw.toString(),
        decimals: selectedToken.decimals ?? 0,
        createdAt: new Date().toISOString(),
        unlockAt: new Date(Date.now() + durationMs).toISOString(),
        autoWithdraw: false,
        escrowPublicKey: escrowKeypair.publicKey.toBase58(),
        escrowSecretKey: base64FromBytes(escrowKeypair.secretKey),
        status: "locked",
        lockSignature: undefined,
        withdrawSignature: undefined,
        error: null,
        lastAttemptAt: null,
      };
      setLocks((prev) => [provisional, ...prev]);

      const instructions: TransactionInstruction[] = [];
      instructions.push(
        ixCreateAtaIdempotent(
          walletKeypair.publicKey,
          destinationAta,
          escrowKeypair.publicKey,
          mint,
        ),
      );
      instructions.push(
        ixTransferChecked(
          sourceAta,
          mint,
          destinationAta,
          walletKeypair.publicKey,
          amountRaw,
          selectedToken.decimals ?? 0,
        ),
      );

      const transaction = new Transaction().add(...instructions);
      const blockhash = await getLatestBlockhashProxy();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletKeypair.publicKey;

      transaction.sign(walletKeypair, escrowKeypair);

      const serialized = transaction.serialize();
      submittedSignature = await postTransaction(serialized);
      await confirmSignatureProxy(submittedSignature);

      // Update the saved lock with the confirmed signature
      setLocks((prev) =>
        prev.map((l) =>
          l.id === lockId
            ? { ...l, lockSignature: submittedSignature, error: null }
            : l,
        ),
      );

      // Persist lock record to Cloudflare (best-effort)
      try {
        await fetch(resolveApiUrl("/api/locks"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: lockId,
            wallet: wallet.publicKey,
            tokenMint: provisional.mint,
            amount: provisional.amount,
            decimals: provisional.decimals,
            txSignature: submittedSignature,
            network: "solana",
            note: `escrow:${provisional.escrowPublicKey}`,
          }),
        });
      } catch {}

      await refreshTokens();
      toast({
        title: "Success",
        description: `You have locked your SPL tokens - ${amount} ${provisional.symbol}`,
      });
      setAmount("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // If we never submitted the tx, remove the optimistic entry
      if (!submittedSignature) {
        setLocks((prev) => prev.filter((l) => l.id !== lockId));
      } else {
        // Keep the entry but mark error so user can retry/withdraw later
        setLocks((prev) =>
          prev.map((l) => (l.id === lockId ? { ...l, error: message } : l)),
        );
      }
      toast({
        title: "Lock failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateLockAutoWithdraw = (lockId: string, value: boolean) => {
    setLocks((prev) =>
      prev.map((lock) =>
        lock.id === lockId ? { ...lock, autoWithdraw: value } : lock,
      ),
    );
  };

  const isFormDisabled = isSubmitting || !wallet || !selectedToken;

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#1a2847] via-[#16223a] to-[#0f1520] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl bg-gradient-to-br from-[#FF7A5C] to-[#FF5A8C] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#FF7A5C] pointer-events-none" />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a2847]/95 to-[#16223a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 p-0 rounded-full bg-transparent hover:bg-[#FF7A5C]/10 text-white focus-visible:ring-0 focus-visible:ring-offset-0 border border-transparent transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 text-center font-medium text-sm">
            SPL TOKEN LOCK
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6 relative z-20">
        <div className="bg-transparent rounded-2xl p-6 space-y-5 text-white">
          <div className="flex items-center gap-2">
            <LockIcon className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Create new lock
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-white">Select token</Label>
              <Select
                value={selectedMint}
                onValueChange={(value) => setSelectedMint(value)}
                disabled={isFormDisabled}
              >
                <SelectTrigger className="mt-1 bg-transparent">
                  <SelectValue placeholder="Choose token" />
                </SelectTrigger>
                <SelectContent>
                  {availableTokens.map((token) => (
                    <SelectItem key={token.mint} value={token.mint}>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {token.symbol || token.name || token.mint.slice(0, 6)}
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase">
                          Balance: {(token.balance || 0).toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-white">Amount to lock</Label>
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.0"
                disabled={isFormDisabled}
                className="mt-1 bg-transparent border-[#FF7A5C]/30 text-white"
              />
              {selectedToken ? (
                <p className="text-[10px] text-gray-400 mt-1">
                  Available: {(selectedToken.balance || 0).toLocaleString()}{" "}
                  {selectedToken.symbol}
                </p>
              ) : null}
            </div>

            <div>
              <Label className="text-xs text-white">Lock duration</Label>
              <Select
                value={selectedLockOption}
                onValueChange={(val) => setSelectedLockOption(val)}
                disabled={isFormDisabled}
              >
                <SelectTrigger className="mt-1 bg-transparent">
                  <SelectValue placeholder="Choose duration" />
                </SelectTrigger>
                <SelectContent>
                  {LOCK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full h-11 font-semibold border-0 bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg"
              onClick={handleSubmit}
              disabled={isFormDisabled}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Locking tokens...
                </>
              ) : (
                <>
                  <LockIcon className="h-4 w-4 mr-2" />
                  Lock tokens
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-transparent border-0 rounded-2xl p-6 space-y-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-semibold text-white">
                Active locks
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {locks.filter((lock) => lock.status !== "withdrawn").length}{" "}
              active
            </Badge>
          </div>

          <div className="space-y-4">
            {locks.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-300">
                No token locks yet. Create one above to get started.
              </div>
            ) : (
              locks.map((lock) => {
                const timeRemaining = formatTimeRemaining(lock.unlockAt);
                const progress = progressForLock(lock);
                const isUnlocked = timeRemaining === "Unlocked";
                const isWithdrawn = lock.status === "withdrawn";
                const canWithdraw =
                  !isWithdrawn && lock.status !== "withdrawing" && isUnlocked;

                return (
                  <div
                    key={lock.id}
                    className="p-4 rounded-xl border border-[#FF7A5C]/30 bg-[#1a2540]/50 space-y-3 text-white"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {lock.amount} {lock.symbol}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Locked on {formatDateTime(lock.createdAt)}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          Held by:{" "}
                          <a
                            className="font-medium text-orange-500 underline-offset-4 hover:underline"
                            href={`https://solscan.io/account/${lock.escrowPublicKey}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortenAddress(lock.escrowPublicKey, 6)}
                          </a>
                        </div>
                      </div>
                      {lock.lockSignature || lock.withdrawSignature ? (
                        <div className="text-[10px] text-gray-400 mt-1">
                          {lock.lockSignature ? (
                            <>
                              Lock tx:{" "}
                              <a
                                className="font-medium text-blue-600 underline-offset-4 hover:underline"
                                href={`https://solscan.io/tx/${lock.lockSignature}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {shortenAddress(lock.lockSignature, 6)}
                              </a>
                            </>
                          ) : null}
                          {lock.withdrawSignature ? (
                            <>
                              <span className="mx-1">•</span>
                              Withdraw tx:{" "}
                              <a
                                className="font-medium text-blue-600 underline-offset-4 hover:underline"
                                href={`https://solscan.io/tx/${lock.withdrawSignature}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {shortenAddress(lock.withdrawSignature, 6)}
                              </a>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      <Badge
                        className="uppercase text-[10px]"
                        variant={
                          lock.status === "withdrawn"
                            ? "default"
                            : lock.status === "withdrawing"
                              ? "outline"
                              : lock.error
                                ? "destructive"
                                : "secondary"
                        }
                      >
                        {lock.status === "withdrawing"
                          ? "Withdrawing"
                          : lock.status === "withdrawn"
                            ? "Withdrawn"
                            : lock.error
                              ? "Action needed"
                              : "Locked"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500">
                        <span>Progress</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400">
                        <div>Unlocks on {formatDateTime(lock.unlockAt)}</div>
                        <div className="text-right">
                          {isUnlocked
                            ? "Ready to withdraw"
                            : `${timeRemaining} remaining`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div></div>
                      <Button
                        size="sm"
                        className="h-9 px-4 text-xs font-semibold bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg"
                        onClick={() => performWithdraw(lock)}
                        disabled={!canWithdraw}
                      >
                        {lock.status === "withdrawing" ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : isWithdrawn ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <LockIcon className="h-4 w-4" />
                        )}
                        <span className="ml-2">
                          {isWithdrawn
                            ? "Complete"
                            : lock.status === "withdrawing"
                              ? "Processing"
                              : "Withdraw"}
                        </span>
                      </Button>
                    </div>

                    {lock.error ? (
                      <div className="flex items-center gap-2 text-[11px] text-red-500 bg-red-50/70 border border-red-100 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Last attempt failed</div>
                          <div className="opacity-80">{lock.error}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
