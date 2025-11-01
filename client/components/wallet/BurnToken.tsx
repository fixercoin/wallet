import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flame, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import type { TokenInfo } from "@/lib/wallet-proxy";
import { shortenAddress } from "@/lib/wallet-proxy";
import { TOKEN_MINTS } from "@/lib/constants/token-mints";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createBurnCheckedInstruction } from "@solana/spl-token";
import bs58 from "bs58";

interface BurnTokenProps {
  onBack: () => void;
}

const SOL_MINT = TOKEN_MINTS.SOL;
const FIXER_MINT_ADDRESS = TOKEN_MINTS.FIXERCOIN;
const LOCKER_MINT_ADDRESS = TOKEN_MINTS.LOCKER;
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const FIXER_MINT = new PublicKey(FIXER_MINT_ADDRESS);
const LOCKER_MINT = new PublicKey(LOCKER_MINT_ADDRESS);
const REWARD_SINK_WALLET = "Rri3wiD8fEfH3oMqbY7FHpNmnCe8ZLtSnVLYwdSTvwm";

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice) as any);
  }
  return btoa(binary);
}

async function rpcCall(method: string, params: any[]) {
  const payload = { jsonrpc: "2.0", id: Date.now(), method, params };
  const resp = await fetch(resolveApiUrl("/api/solana-rpc"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`RPC ${resp.status}`);
  const j = await resp.json().catch(() => null);
  if (j && j.error) throw new Error(j.error.message || "RPC error");
  return j?.result ?? j;
}

async function getLatestBlockhashProxy(): Promise<string> {
  const r = await rpcCall("getLatestBlockhash", []);
  return r?.value?.blockhash || r?.blockhash || r;
}

async function confirmSignatureProxy(signature: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const status = await rpcCall("getSignatureStatuses", [[signature]]);
    const value = status?.value?.[0] || status?.[0];
    if (
      value &&
      (value.confirmationStatus === "confirmed" ||
        value.confirmationStatus === "finalized" ||
        value.confirmations === 0)
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Confirmation timeout");
}

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

const ixBurnChecked = (
  account: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
): TransactionInstruction => {
  const data = new Uint8Array(1 + 8 + 1);
  data[0] = 15; // BurnChecked instruction
  data.set(u64LE(amount), 1);
  data[1 + 8] = decimals;
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: Buffer.from(data),
  });
};

const normalizeNumberInput = (value: string): string =>
  value.replace(/,/g, "").trim();

const toBaseUnits = (value: string, decimals: number): bigint => {
  const normalized = normalizeNumberInput(value);
  if (!normalized) return BigInt(0);
  if (!/^\d*(\.\d*)?$/.test(normalized)) return BigInt(0);
  if (normalized === ".") return BigInt(0);

  const [wholeRaw, fractionRaw = ""] = normalized.split(".");
  const wholePart = wholeRaw ? BigInt(wholeRaw) : BigInt(0);
  const decimalsClamped = Math.max(0, decimals);
  const pow = BigInt(10) ** BigInt(decimalsClamped);
  if (decimalsClamped === 0) {
    return wholePart;
  }
  const fraction = fractionRaw
    .slice(0, decimalsClamped)
    .padEnd(decimalsClamped, "0");
  const fractionPart = fraction ? BigInt(fraction) : BigInt(0);
  return wholePart * pow + fractionPart;
};

const formatNumber = (value: number | undefined, decimals: number): string => {
  if (typeof value !== "number" || !isFinite(value)) return "0";
  const safeDecimals = Math.max(0, Math.min(decimals, 9));
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: safeDecimals,
    useGrouping: false,
  });
};

const getTokenBalanceRaw = (token: TokenInfo | null): bigint => {
  if (!token) return BigInt(0);
  const decimals = Math.max(0, token.decimals ?? 0);
  const balance = token.balance ?? 0;
  if (!isFinite(balance) || balance <= 0) return BigInt(0);
  const decimalsForFormat = Math.min(decimals, 20);
  const formatted = balance.toFixed(decimalsForFormat);
  const base = toBaseUnits(formatted, decimalsForFormat);
  if (decimals > decimalsForFormat) {
    const scale = BigInt(10) ** BigInt(decimals - decimalsForFormat);
    return base * scale;
  }
  return base;
};

export const BurnToken: React.FC<BurnTokenProps> = ({ onBack }) => {
  const { wallet, tokens, refreshTokens } = useWallet();
  const { toast } = useToast();

  const splTokens = useMemo(
    () =>
      tokens.filter((token) => {
        const balance = typeof token.balance === "number" ? token.balance : 0;
        return (
          token.mint &&
          token.mint !== SOL_MINT &&
          balance > 0 &&
          Number.isFinite(balance)
        );
      }),
    [tokens],
  );

  const [selectedMint, setSelectedMint] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [rewardSig, setRewardSig] = useState<string | null>(null);

  useEffect(() => {
    if (!splTokens.length) {
      setSelectedMint("");
      return;
    }
    setSelectedMint((prev) =>
      prev && splTokens.some((token) => token.mint === prev)
        ? prev
        : splTokens[0].mint,
    );
  }, [splTokens]);

  const selectedToken = useMemo(
    () => splTokens.find((token) => token.mint === selectedMint) || null,
    [splTokens, selectedMint],
  );

  const availableRaw = useMemo(
    () => getTokenBalanceRaw(selectedToken),
    [selectedToken],
  );
  const isFixerSelected = selectedToken?.mint === FIXER_MINT_ADDRESS;

  const amountError = useMemo(() => {
    if (!selectedToken) {
      return splTokens.length === 0
        ? "No SPL tokens with a positive balance were found in this wallet."
        : "Select a token to burn.";
    }
    const sanitized = normalizeNumberInput(amount);
    if (!sanitized) return null;
    if (!/^\d*(\.\d*)?$/.test(sanitized)) return "Enter a valid number.";
    if (sanitized === ".") return "Enter a valid number.";

    const decimals = Math.max(0, selectedToken.decimals ?? 0);
    const fraction = sanitized.split(".")[1] ?? "";
    if (fraction.length > decimals) {
      return decimals === 0
        ? "This token does not support fractional amounts."
        : `Token supports up to ${decimals} decimal${decimals === 1 ? "" : "s"}.`;
    }

    const amtRaw = toBaseUnits(sanitized, decimals);
    if (amtRaw <= BigInt(0)) {
      return "Amount must be greater than zero.";
    }

    if (amtRaw > availableRaw) {
      return "Amount exceeds available balance.";
    }

    return null;
  }, [amount, availableRaw, selectedToken, splTokens.length]);

  const isConfirmDisabled =
    isLoading || !wallet || !selectedToken || !!amountError || !amount.trim();

  const handleAmountChange = (value: string) => {
    const sanitizedInput = value.replace(/,/g, "");
    if (sanitizedInput === "") {
      setAmount("");
      return;
    }
    if (sanitizedInput === ".") {
      setAmount("0.");
      return;
    }
    if (!/^\d*(\.\d*)?$/.test(sanitizedInput)) {
      return;
    }
    const decimalsLimit = Math.max(0, selectedToken?.decimals ?? 0);
    const [wholePart, fractionPart = ""] = sanitizedInput.split(".");
    const trimmedFraction = fractionPart.slice(0, decimalsLimit);
    const nextValue = fractionPart
      ? `${wholePart || "0"}.${trimmedFraction}`
      : wholePart;
    setAmount(nextValue);
  };

  const handleAmountBlur = () => {
    if (amount.endsWith(".")) {
      setAmount(amount.slice(0, -1));
    }
  };

  const handleUseMax = () => {
    if (!selectedToken) return;
    const decimals = Math.max(0, selectedToken.decimals ?? 0);
    const balanceValue = selectedToken.balance ?? 0;
    if (!isFinite(balanceValue) || balanceValue <= 0) {
      setAmount("");
      return;
    }
    const formatted = balanceValue.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(decimals, 9),
      useGrouping: false,
    });
    setAmount(formatted);
  };

  const handleBurn = async () => {
    if (!wallet) {
      toast({
        title: "Wallet not connected",
        description: "Select a wallet to continue.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedToken) {
      toast({
        title: "No token selected",
        description: "Choose a token to burn.",
        variant: "destructive",
      });
      return;
    }

    const decimals = Math.max(0, selectedToken.decimals ?? 0);
    const sanitizedAmount = normalizeNumberInput(amount);
    const fraction = sanitizedAmount.split(".")[1] ?? "";
    if (fraction.length > decimals) {
      toast({
        title: "Invalid amount",
        description:
          decimals === 0
            ? "This token does not support fractional amounts."
            : `Token supports up to ${decimals} decimal${decimals === 1 ? "" : "s"}.`,
        variant: "destructive",
      });
      return;
    }

    const amtRaw = toBaseUnits(sanitizedAmount, decimals);
    if (amtRaw <= BigInt(0)) {
      toast({
        title: "Invalid amount",
        description: "Enter an amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    const balanceRaw = getTokenBalanceRaw(selectedToken);
    if (amtRaw > balanceRaw) {
      toast({
        title: "Insufficient balance",
        description: "Amount exceeds available balance.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setTxSig(null);
      setRewardSig(null);

      const sender = Keypair.fromSecretKey(wallet.secretKey);
      const mintKey = new PublicKey(selectedToken.mint);
      const ata = deriveAta(sender.publicKey, mintKey);

      // createBurnCheckedInstruction expects amount as number. Ensure it fits JS number range.
      let amountNumber: number;
      try {
        amountNumber = Number(amtRaw);
        if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
          throw new Error("Amount out of range");
        }
      } catch (err) {
        throw new Error("Amount too large to handle in client transaction");
      }

      const burnIx = createBurnCheckedInstruction(
        ata,
        mintKey,
        sender.publicKey,
        amountNumber,
        decimals,
        TOKEN_PROGRAM_ID,
      );

      const tx = new Transaction().add(burnIx);
      const blockhash = await getLatestBlockhashProxy();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sender.publicKey;
      tx.sign(sender);

      const serialized = tx.serialize();
      const b64 = base64FromBytes(serialized);

      let signature: string;
      try {
        const payload = {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "sendTransaction",
          params: [
            b64,
            { skipPreflight: false, preflightCommitment: "confirmed" },
          ],
        };
        const response = await fetch(resolveApiUrl("/api/solana-rpc"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (result && result.error)
          throw new Error(result.error.message || "RPC error");
        signature = result?.result || result;
      } catch (error) {
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
        const response = await fetch(resolveApiUrl("/api/solana-rpc"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (result && result.error)
          throw new Error(result.error.message || "RPC error");
        signature = result?.result || result;
      }

      await confirmSignatureProxy(signature);
      setTxSig(signature);

      // Show success toast only
      toast({
        title: "Success",
        description: "Successfully you have burnt your SPL tokens.",
      });

      setAmount("");

      setTimeout(() => {
        refreshTokens();
      }, 1500);

      // Attempt to route rewards (non-fatal). If it fails, show a non-destructive toast.
      if (isFixerSelected) {
        try {
          const rewardResponse = await fetch(
            resolveApiUrl("/api/reward-locker"),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: REWARD_SINK_WALLET,
                burnSignature: signature,
                amountRaw: amtRaw.toString(),
                fixerMint: FIXER_MINT_ADDRESS,
                lockerMint: LOCKER_MINT_ADDRESS,
              }),
            },
          );
          if (!rewardResponse.ok) {
            const text = await rewardResponse.text().catch(() => "");
            console.error(
              "Reward request failed:",
              text || rewardResponse.status,
            );
          } else {
            const rewardJson = await rewardResponse.json().catch(() => ({}));
            if (rewardJson?.signature) setRewardSig(rewardJson.signature);
          }
        } catch (err) {
          console.error("Reward routing error:", err);
        }
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Burn failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="express-p2p-page min-h-screen bg-gradient-to-br from-[#2d1b47] via-[#1f0f3d] to-[#0f1820] text-white relative overflow-hidden">
      {/* Decorative curved accent background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 blur-3xl bg-gradient-to-br from-[#a855f7] to-[#22c55e] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 blur-3xl bg-[#22c55e] pointer-events-none" />

      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6 relative z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-white hover:bg-[#a855f7]/10"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-xs uppercase tracking-wide text-orange-500">
              Burn SPL Tokens
            </div>
            <h1 className="text-xl font-semibold text-white">
              Destroy tokens securely
            </h1>
            <p className="text-xs text-gray-300">
              Permanently remove SPL tokens from your wallet balance.
            </p>
          </div>
        </div>

        <div className="bg-transparent p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-semibold text-white">
              Burn tokens you control
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-300">Select token</Label>
              <Select
                value={selectedMint}
                onValueChange={setSelectedMint}
                disabled={!splTokens.length || isLoading}
              >
                <SelectTrigger className="mt-1 bg-[#2d1b47]/50 text-white">
                  <SelectValue placeholder="Choose token" />
                </SelectTrigger>
                <SelectContent className="bg-[#2d1b47]/95 text-white">
                  {splTokens.map((token) => (
                    <SelectItem key={token.mint} value={token.mint}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {token.symbol || token.mint.slice(0, 6)}
                        </span>
                        <span className="text-[10px] text-gray-300 uppercase">
                          Balance:{" "}
                          {formatNumber(token.balance, token.decimals ?? 0)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {splTokens.length === 0 ? (
                <p className="mt-2 text-[11px] text-gray-300">
                  Add or receive SPL tokens with a positive balance to burn them
                  from this wallet.
                </p>
              ) : null}
            </div>

            {selectedToken ? (
              <div className="rounded-xl border border-[#FF7A5C]/30 bg-[#1a2540]/50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-300">
                      Selected token
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {selectedToken.symbol || selectedToken.mint.slice(0, 6)} ·{" "}
                      {formatNumber(
                        selectedToken.balance,
                        selectedToken.decimals ?? 0,
                      )}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-gray-300">
                    <p>Mint address</p>
                    <a
                      className="font-medium text-orange-500 underline-offset-4 hover:underline"
                      href={`https://solscan.io/token/${selectedToken.mint}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortenAddress(selectedToken.mint, 6)}
                    </a>
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <Label htmlFor="burn-amount" className="text-xs text-gray-300">
                Amount to burn
              </Label>
              <div className="mt-1 flex items-center gap-3">
                <Input
                  id="burn-amount"
                  value={amount}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  onBlur={handleAmountBlur}
                  disabled={isLoading || !selectedToken}
                  placeholder="0.0"
                  inputMode="decimal"
                  className="h-11 bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white placeholder:text-gray-300"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleUseMax}
                  disabled={isLoading || !selectedToken}
                  className="h-11 rounded-full px-4 text-sm bg-[#1a2540]/50 border border-[#FF7A5C]/30 text-white hover:bg-[#FF7A5C]/20"
                >
                  Max
                </Button>
              </div>
              {selectedToken ? (
                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-300">
                  <span>
                    Available:{" "}
                    {formatNumber(
                      selectedToken.balance,
                      selectedToken.decimals ?? 0,
                    )}{" "}
                    {selectedToken.symbol || selectedToken.mint.slice(0, 6)}
                  </span>
                  <span>Decimals: {selectedToken.decimals ?? 0}</span>
                </div>
              ) : null}
              {amountError ? (
                <p className="mt-2 text-sm text-red-500">{amountError}</p>
              ) : null}
            </div>

            <Button
              className="h-11 w-full border-0 font-semibold rounded-xl bg-gradient-to-r from-[#FF7A5C] to-[#FF5A8C] hover:from-[#FF6B4D] hover:to-[#FF4D7D] text-white shadow-lg"
              onClick={handleBurn}
              disabled={isConfirmDisabled}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing burn...
                </>
              ) : (
                <>
                  <Flame className="mr-2 h-4 w-4" />
                  Confirm burn
                </>
              )}
            </Button>

            <p className="text-center text-[11px] text-gray-300">
              Burning permanently removes the selected tokens from circulation
              and cannot be reversed.
            </p>
          </div>
        </div>

        {txSig || rewardSig ? (
          <div className="transparent-cardboard border-0 rounded-none sm:rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-semibold text-white">
                Recent burn
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              {txSig ? (
                <div className="break-all">
                  Burn transaction:{" "}
                  <a
                    className="font-medium text-orange-500 underline-offset-4 hover:underline"
                    href={`https://solscan.io/tx/${txSig}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {txSig}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BurnToken;
