import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Flame } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/api-client";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";

interface BurnTokenProps {
  onBack: () => void;
}

const FIXER_MINT = new PublicKey(
  "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
);
const LOCKER_MINT = new PublicKey(
  "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
);
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

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
    const st = await rpcCall("getSignatureStatuses", [[signature]]);
    const v = st?.value?.[0] || st?.[0];
    if (v && (v.confirmations === 0 || v.confirmationStatus)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
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
  data[0] = 15; // BurnChecked
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

export const BurnToken: React.FC<BurnTokenProps> = ({ onBack }) => {
  const { wallet, tokens, refreshTokens } = useWallet();
  const { toast } = useToast();

  const fixerToken = useMemo(
    () =>
      tokens.find(
        (t) => t.mint === FIXER_MINT.toBase58() || t.symbol === "FIXERCOIN",
      ),
    [tokens],
  );
  const [amount, setAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [rewardSig, setRewardSig] = useState<string | null>(null);

  const fixerDecimals = 6; // from config

  const toBaseUnits = (val: string, decimals: number): bigint => {
    const n = Number(val);
    if (!isFinite(n) || n <= 0) return BigInt(0);
    const parts = val.split(".");
    const whole = parts[0] || "0";
    const frac = (parts[1] || "").slice(0, decimals);
    const fracPadded = frac.padEnd(decimals, "0");
    const s = `${whole}${fracPadded}`.replace(/^0+/, "");
    return BigInt(s || "0");
  };

  const handleBurn = async () => {
    if (!wallet) return;
    const amtRaw = toBaseUnits(amount.trim(), fixerDecimals);
    if (amtRaw <= BigInt(0)) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    try {
      setIsLoading(true);
      setTxSig(null);
      setRewardSig(null);

      const sk = wallet.secretKey;
      const sender = Keypair.fromSecretKey(sk);

      const ata = deriveAta(new PublicKey(wallet.publicKey), FIXER_MINT);
      const burnIx = ixBurnChecked(
        ata,
        FIXER_MINT,
        sender.publicKey,
        amtRaw,
        fixerDecimals,
      );

      const tx = new Transaction().add(burnIx);
      const blockhash = await getLatestBlockhashProxy();
      tx.recentBlockhash = blockhash;
      tx.feePayer = sender.publicKey;

      // sign and send
      tx.sign(sender);
      const serialized = tx.serialize();
      const b64 = base64FromBytes(serialized);

      // Try b64 JSON-RPC first
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
        const p = await fetch(resolveApiUrl("/api/solana-rpc"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await p.json();
        if (j && j.error) throw new Error(j.error.message || "RPC error");
        signature = j?.result || j;
      } catch (e) {
        // Fallback to base58 if RPC needs it
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
        const j = await p.json();
        if (j && j.error) throw new Error(j.error.message || "RPC error");
        signature = j?.result || j;
      }

      await confirmSignatureProxy(signature);
      setTxSig(signature);

      // Trigger reward: 110% of burned amount (10% extra)
      const res = await fetch(resolveApiUrl("/api/reward-locker"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: wallet.publicKey,
          burnSignature: signature,
          amountRaw: amtRaw.toString(),
          fixerMint: FIXER_MINT.toBase58(),
          lockerMint: LOCKER_MINT.toBase58(),
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Reward request failed: ${res.status}`);
      }
      const j = await res.json().catch(() => ({}));
      if (j?.signature) setRewardSig(j.signature);

      toast({
        title: "Burn complete",
        description: "Reward transfer initiated",
      });

      setTimeout(() => {
        refreshTokens();
      }, 1500);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : String(error);
      toast({ title: "Burn failed", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const maxFixer = fixerToken?.balance || 0;

  return (
    <div className="min-h-screen bg-pink-50 text-[hsl(var(--foreground))]">
      <div className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 p-0 text-[hsl(var(--foreground))]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            <span className="font-semibold">Burn FIXERCOIN</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <div className="cardbox-container">
          <div className="card_box text-white">
            <span></span>
            <div className="space-y-3">
              <div className="text-sm font-semibold tracking-wide">
                Burn FIXERCOIN for Rewards
              </div>
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  Amount (FIXERCOIN)
                </label>
                <Input
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isLoading || !wallet}
                />
              </div>
              <Button
                className="w-full h-10 bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#022c3d] font-semibold border-0"
                onClick={handleBurn}
                disabled={isLoading || !wallet}
              >
                {isLoading ? "Processing..." : "Burn and Claim Reward"}
              </Button>
              <div className="text-xs text-gray-300">
                Available: {maxFixer.toLocaleString()} FIXERCOIN
              </div>
              <div className="text-[10px] text-gray-300">
                You will receive LOCKER tokens equal to 110% of the burned
                FIXERCOIN amount, paid from wallet
                Ec72XPYcxYgpRFaNb9b6BHe1XdxtqFjzz2wLRTnx1owA.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {txSig ? (
            <div className="text-xs break-all text-gray-600">
              Burn tx:{" "}
              <a
                className="underline"
                href={`https://solscan.io/tx/${txSig}`}
                target="_blank"
                rel="noreferrer"
              >
                {txSig}
              </a>
            </div>
          ) : null}
          {rewardSig ? (
            <div className="text-xs break-all text-gray-600">
              Reward tx:{" "}
              <a
                className="underline"
                href={`https://solscan.io/tx/${rewardSig}`}
                target="_blank"
                rel="noreferrer"
              >
                {rewardSig}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BurnToken;
