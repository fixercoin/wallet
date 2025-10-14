import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  ArrowLeft,
  Lock as LockIcon,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
const LOCK_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

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
    data: Buffer.from(data),
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
    data: Buffer.from(data),
  });
};

const rpcCall = async (method: string, params: any[]): Promise<any> => {
  const resp = await fetch("/api/solana-rpc", {
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
  const res = await rpcCall("getLatestBlockhash", [{ commitment: "confirmed" }]);
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
  const resp = await fetch("/api/solana-rpc", {
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
      const fallback = await fetch("/api/solana-rpc", {
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
  const [autoWithdraw, setAutoWithdraw] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [locks, setLocks] = useState<TokenLockRecord[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const autoWithdrawRunning = useRef(false);

  const storageKey = wallet ? storageKeyForWallet(wallet.publicKey) : null;

  useEffect(() => {
    if (!wallet) return;
    try {
      const stored = localStorage.getItem(storageKeyForWallet(wallet.publicKey));
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
        throw error;
      }
    },
    [wallet, refreshTokens, toast],
  );

  const runAutoWithdraw = useCallback(async () => {
    if (!wallet) return;
    if (autoWithdrawRunning.current) return;
    autoWithdrawRunning.current = true;
    try {
      const readyLocks = locks.filter((lock) => {
        if (lock.status !== "locked" || !lock.autoWithdraw) return false;
        const unlockAt = new Date(lock.unlockAt).getTime();
        return Date.now() >= unlockAt;
      });
      for (const lock of readyLocks) {
        try {
          await performWithdraw(lock, { auto: true });
        } catch (error) {
          console.error("Auto-withdraw failed", error);
        }
      }
    } finally {
      autoWithdrawRunning.current = false;
    }
  }, [wallet, locks, performWithdraw]);

  useEffect(() => {
    if (!wallet) return;
    const interval = setInterval(() => {
      runAutoWithdraw().catch((error) =>
        console.error("Auto-withdraw tick failed", error),
      );
    }, 60000);
    return () => clearInterval(interval);
  }, [wallet, runAutoWithdraw]);

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
    try {
      const walletSecret = coerceSecretKey(wallet.secretKey);
      if (!walletSecret) throw new Error("Missing wallet secret key");
      const walletKeypair = Keypair.fromSecretKey(walletSecret);
      const amountRaw = toBaseUnits(amount, selectedToken.decimals ?? 0);
      if (amountRaw <= BigInt(0)) throw new Error("Invalid amount");

      const escrowKeypair = Keypair.generate();
      const mint = new PublicKey(selectedToken.mint);
      const sourceAta = deriveAta(walletKeypair.publicKey, mint);
      const destinationAta = deriveAta(escrowKeypair.publicKey, mint);

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
      const signature = await postTransaction(serialized);
      await confirmSignatureProxy(signature);

      const lockRecord: TokenLockRecord = {
        id: createId(),
        mint: selectedToken.mint,
        symbol: selectedToken.symbol || selectedToken.mint.slice(0, 6),
        amount,
        amountRaw: amountRaw.toString(),
        decimals: selectedToken.decimals ?? 0,
        createdAt: new Date().toISOString(),
        unlockAt: new Date(Date.now() + LOCK_DURATION_MS).toISOString(),
        autoWithdraw,
        escrowPublicKey: escrowKeypair.publicKey.toBase58(),
        escrowSecretKey: base64FromBytes(escrowKeypair.secretKey),
        status: "locked",
        lockSignature: signature,
        withdrawSignature: undefined,
        error: null,
        lastAttemptAt: null,
      };

      setLocks((prev) => [lockRecord, ...prev]);
      await refreshTokens();
      toast({
        title: "Tokens locked",
        description: `${amount} ${lockRecord.symbol} locked for 3 months`,
      });
      setAmount("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-white/80 backdrop-blur-sm border border-white/40"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-xs uppercase tracking-wide text-purple-500">
              SPL Token Lock
            </div>
            <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              Lock your SPL tokens
            </h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Securely hold tokens without rewards. Unlocks automatically when the lock completes.
            </p>
          </div>
        </div>

        <Card className="wallet-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LockIcon className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-sm font-semibold">
                Create new lock
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-[hsl(var(--muted-foreground))]">
                Select token
              </Label>
              <Select
                value={selectedMint}
                onValueChange={(value) => setSelectedMint(value)}
                disabled={isFormDisabled}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose token" />
                </SelectTrigger>
                <SelectContent>
                  {availableTokens.map((token) => (
                    <SelectItem key={token.mint} value={token.mint}>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {token.symbol || token.name || token.mint.slice(0, 6)}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase">
                          Balance: {(token.balance || 0).toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-[hsl(var(--muted-foreground))]">
                Amount to lock
              </Label>
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.0"
                disabled={isFormDisabled}
                className="mt-1"
              />
              {selectedToken ? (
                <p className="text-[10px] text-gray-500 mt-1">
                  Available: {(selectedToken.balance || 0).toLocaleString()} {
                    selectedToken.symbol
                  }
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-[hsl(var(--foreground))]">
                  Auto-withdraw
                </div>
                <p className="text-[10px] text-gray-500">
                  Release tokens automatically after the lock ends.
                </p>
              </div>
              <Switch
                checked={autoWithdraw}
                onCheckedChange={setAutoWithdraw}
                disabled={isFormDisabled}
              />
            </div>

            <Button
              className="w-full h-11 dash-btn font-semibold border-0"
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
          </CardContent>
        </Card>

        <Card className="wallet-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-sm font-semibold">
                  Active locks
                </CardTitle>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {locks.filter((lock) => lock.status !== "withdrawn").length} active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {locks.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500">
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
                    className="p-4 rounded-xl border border-white/40 bg-white/70 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                          {lock.amount} {lock.symbol}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Locked on {formatDateTime(lock.createdAt)}
                        </div>
                      </div>
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
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                        <div>
                          Unlocks on {formatDateTime(lock.unlockAt)}
                        </div>
                        <div className="text-right">
                          {isUnlocked ? "Ready to withdraw" : `${timeRemaining} remaining`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={lock.autoWithdraw}
                          onCheckedChange={(value) =>
                            updateLockAutoWithdraw(lock.id, value)
                          }
                          disabled={isWithdrawn || lock.status === "withdrawing"}
                        />
                        <div>
                          <div className="text-[11px] font-medium text-[hsl(var(--foreground))]">
                            Auto-withdraw
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {lock.autoWithdraw ? "Enabled" : "Disabled"}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="dash-btn h-9 px-4 text-xs font-semibold"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
