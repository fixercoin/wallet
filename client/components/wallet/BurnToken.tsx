import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import type { TokenInfo } from "@/lib/wallet-proxy";
import { shortenAddress } from "@/lib/wallet-proxy";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";

interface BurnTokenProps {
  onBack: () => void;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const FIXER_MINT_ADDRESS = "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump";
const LOCKER_MINT_ADDRESS = "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump";
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);
const FIXER_MINT = new PublicKey(FIXER_MINT_ADDRESS);
const LOCKER_MINT = new PublicKey(LOCKER_MINT_ADDRESS);

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

const normalizeNumberInput = (value: string): string => value.replace(/,/g, "").trim();

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
  const fraction = fractionRaw.slice(0, decimalsClamped).padEnd(decimalsClamped, "0");
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

  const availableRaw = useMemo(() => getTokenBalanceRaw(selectedToken), [selectedToken]);
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
        description: decimals === 0
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
      const burnIx = ixBurnChecked(
        ata,
        mintKey,
        sender.publicKey,
        amtRaw,
        decimals,
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
        if (result && result.error) throw new Error(result.error.message || "RPC error");
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
        if (result && result.error) throw new Error(result.error.message || "RPC error");
        signature = result?.result || result;
      }

      await confirmSignatureProxy(signature);
      setTxSig(signature);

      if (isFixerSelected) {
        const rewardResponse = await fetch(resolveApiUrl("/api/reward-locker"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: wallet.publicKey,
            burnSignature: signature,
            amountRaw: amtRaw.toString(),
            fixerMint: FIXER_MINT_ADDRESS,
            lockerMint: LOCKER_MINT_ADDRESS,
          }),
        });
        if (!rewardResponse.ok) {
          const text = await rewardResponse.text().catch(() => "");
          throw new Error(text || `Reward request failed: ${rewardResponse.status}`);
        }
        const rewardJson = await rewardResponse.json().catch(() => ({}));
        if (rewardJson?.signature) setRewardSig(rewardJson.signature);
      }

      toast({
        title: "Burn complete",
        description: `${amount} ${selectedToken.symbol} burned successfully.`,
      });

      setAmount("");

      setTimeout(() => {
        refreshTokens();
      }, 1500);
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 rounded-full border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
              <Flame className="h-4 w-4 text-orange-400" /> Burn SPL Tokens
            </span>
            <span className="text-xs text-slate-400">
              Permanently destroy tokens held by this wallet.
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <Card className="border border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur">
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl font-semibold text-white">
              Burn tokens you control
            </CardTitle>
            <CardDescription className="text-slate-300">
              Select an SPL token in your wallet, choose the amount, and confirm to burn. This action cannot be undone.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-slate-200">Token</Label>
              <Select
                value={selectedMint}
                onValueChange={setSelectedMint}
                disabled={!splTokens.length || isLoading}
              >
                <SelectTrigger className="h-11 rounded-lg border-slate-700 bg-slate-900/60 text-left text-white">
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>
                <SelectContent className="border border-slate-700 bg-slate-900 text-white">
                  <SelectGroup>
                    {splTokens.map((token) => (
                      <SelectItem key={token.mint} value={token.mint} className="text-white">
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium">{token.symbol || "Token"}</span>
                          <span className="text-xs text-slate-400">
                            {formatNumber(token.balance, token.decimals ?? 0)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {splTokens.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Add or receive SPL tokens with a positive balance to burn them from this wallet.
                </p>
              ) : null}
            </div>

            {selectedToken ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Selected token</p>
                    <p className="text-lg font-semibold text-white">
                      {selectedToken.symbol} · {formatNumber(selectedToken.balance, selectedToken.decimals ?? 0)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-400 sm:text-left">
                    <p>Mint address</p>
                    <a
                      className="font-medium text-slate-200 underline-offset-4 hover:underline"
                      href={`https://solscan.io/token/${selectedToken.mint}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortenAddress(selectedToken.mint, 6)}
                    </a>
                  </div>
                </div>
                {isFixerSelected ? (
                  <div className="mt-3 rounded-md border border-purple-500/40 bg-purple-500/10 p-3 text-sm text-purple-100">
                    Burning FIXERCOIN grants a 110% LOCKER reward automatically.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="burn-amount" className="text-slate-200">
                Amount to burn
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="burn-amount"
                  value={amount}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  onBlur={handleAmountBlur}
                  disabled={isLoading || !selectedToken}
                  placeholder="0.0"
                  inputMode="decimal"
                  className="h-11 rounded-lg border-slate-700 bg-slate-900/60 text-white placeholder:text-slate-500"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleUseMax}
                  disabled={isLoading || !selectedToken}
                  className="h-11 rounded-lg border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  Max
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Available: {formatNumber(selectedToken?.balance, selectedToken?.decimals ?? 0)} {selectedToken?.symbol}
                </span>
                <span>Decimals: {selectedToken?.decimals ?? 0}</span>
              </div>
              {amountError ? (
                <p className="text-sm text-red-400">{amountError}</p>
              ) : null}
            </div>

            {txSig || rewardSig ? (
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
                {txSig ? (
                  <div className="break-all">
                    Burn transaction: {" "}
                    <a
                      className="text-slate-100 underline-offset-4 hover:underline"
                      href={`https://solscan.io/tx/${txSig}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {txSig}
                    </a>
                  </div>
                ) : null}
                {rewardSig ? (
                  <div className="break-all">
                    Reward transaction: {" "}
                    <a
                      className="text-slate-100 underline-offset-4 hover:underline"
                      href={`https://solscan.io/tx/${rewardSig}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {rewardSig}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button
              className="h-11 w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg transition hover:from-purple-500 hover:to-blue-500"
              onClick={handleBurn}
              disabled={isConfirmDisabled}
            >
              {isLoading ? "Processing..." : "Confirm Burn"}
            </Button>
            <p className="text-center text-xs text-slate-400">
              Burning permanently removes the selected tokens from circulation and cannot be reversed.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default BurnToken;
