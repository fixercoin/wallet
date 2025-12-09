import { SOLANA_RPC_URL } from "../../utils/solanaConfig";
import {
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

const FIXER_MINT = new PublicKey(
  "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
);

function applyCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  headers.set("Vary", "Origin");
  return headers;
}

function jsonCors(status: number, body: any) {
  const headers = applyCors(
    new Headers({ "Content-Type": "application/json" }),
  );
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

function pickRpcUrl(env: Record<string, any>): string {
  if (env.SOLANA_RPC_URL) return env.SOLANA_RPC_URL;
  if (env.MORALIS_RPC_URL) return env.MORALIS_RPC_URL;
  if (env.ALCHEMY_RPC_URL) return env.ALCHEMY_RPC_URL;
  return "https://api.mainnet-beta.solflare.network";
}

async function rpcCall(rpcUrl: string, method: string, params: any[]) {
  const payload = { jsonrpc: "2.0", id: Date.now(), method, params };
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`RPC ${resp.status}`);
  const j = await resp.json().catch(() => null);
  if (j && j.error) throw new Error(j.error.message || "RPC error");
  return j?.result ?? j;
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

const ixCreateAtaIdempotent = (
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction => {
  const data = new Uint8Array([1]); // createIdempotent
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
  data[0] = 12; // TransferChecked
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
    data: Buffer.from(data),
  });
};

async function getMintDecimals(
  rpcUrl: string,
  mint: PublicKey,
): Promise<number> {
  try {
    const res = await rpcCall(rpcUrl, "getTokenSupply", [mint.toBase58()]);
    const dec = res?.value?.decimals;
    if (typeof dec === "number" && dec >= 0 && dec <= 18) return dec;
  } catch {}
  // Fallback to 6 if cannot fetch
  return 6;
}

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Record<string, any>;
}) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: applyCors(new Headers()),
    });
  }

  const rpcUrl = pickRpcUrl(env);

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const recipientStr = String(body?.recipient || "").trim();
  const completedTasks = (
    Array.isArray(body?.tasks) ? body.tasks : []
  ) as string[];
  const count = Number(body?.count ?? completedTasks.length);
  const authMessage = String(body?.authMessage || "");
  const authSignature58 = String(body?.authSignature || "");

  const TOTAL_TASKS = 5; // must complete all tasks to claim
  if (!recipientStr || !authMessage || !authSignature58) {
    return jsonCors(400, {
      error: "recipient, authMessage and authSignature are required",
    });
  }

  if (!Number.isFinite(count) || count < TOTAL_TASKS) {
    return jsonCors(400, { error: "All tasks must be completed to claim" });
  }

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(recipientStr);
  } catch {
    return jsonCors(400, { error: "Invalid recipient" });
  }

  // Verify user controls the recipient wallet via signed message
  try {
    const sig = bs58.decode(authSignature58);
    const msg = new TextEncoder().encode(authMessage);
    const ok = nacl.sign.detached.verify(msg, sig, recipient.toBytes());
    if (!ok) return jsonCors(401, { error: "Invalid signature" });
  } catch {
    return jsonCors(400, { error: "Malformed signature" });
  }

  const rewardSecret = env.REWARD_WALLET_SECRET;
  if (!rewardSecret) {
    return jsonCors(500, { error: "Reward wallet not configured" });
  }

  let rewardKey: Keypair;
  try {
    const bytes = /^[0-9,\s]+$/.test(rewardSecret)
      ? Uint8Array.from(
          rewardSecret
            .split(/[,\s]+/)
            .filter(Boolean)
            .map((x: string) => Number(x)),
        )
      : bs58.decode(rewardSecret);
    rewardKey = Keypair.fromSecretKey(bytes);
  } catch (e) {
    return jsonCors(500, { error: "Invalid REWARD_WALLET_SECRET" });
  }

  const decimals = await getMintDecimals(rpcUrl, FIXER_MINT);
  const perTask = BigInt(50);
  const tokens = perTask * BigInt(count);
  const amountRaw = tokens * BigInt(10) ** BigInt(decimals);

  try {
    const rewardOwner = rewardKey.publicKey;
    const sourceAta = deriveAta(rewardOwner, FIXER_MINT);
    const destAta = deriveAta(recipient, FIXER_MINT);

    const tx = new Transaction();

    // Ensure source and destination ATAs (idempotent)
    tx.add(
      ixCreateAtaIdempotent(rewardOwner, sourceAta, rewardOwner, FIXER_MINT),
    );
    tx.add(ixCreateAtaIdempotent(rewardOwner, destAta, recipient, FIXER_MINT));

    // Transfer FIXERCOIN to recipient
    tx.add(
      ixTransferChecked(
        sourceAta,
        FIXER_MINT,
        destAta,
        rewardOwner,
        amountRaw,
        decimals,
      ),
    );

    const bh = await rpcCall(rpcUrl, "getLatestBlockhash", []);
    const blockhash = bh?.value?.blockhash || bh?.blockhash || bh;
    tx.recentBlockhash = blockhash;
    tx.feePayer = rewardOwner;

    tx.sign(rewardKey);
    const raw = tx.serialize();

    // Try base64 first
    let signature: string | null = null;
    try {
      const payload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "sendTransaction",
        params: [
          ((): string => {
            let binary = "";
            const chunk = 0x8000;
            for (let i = 0; i < raw.length; i += chunk) {
              const slice = raw.subarray(i, i + chunk);
              binary += String.fromCharCode.apply(
                null,
                Array.from(slice) as any,
              );
            }
            // eslint-disable-next-line no-undef
            return btoa(binary);
          })(),
          { skipPreflight: false, preflightCommitment: "confirmed" },
        ],
      };
      const r = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j && j.error) throw new Error(j.error.message || "RPC error");
      signature = j?.result || j;
    } catch (e) {
      const payload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "sendTransaction",
        params: [
          bs58.encode(raw),
          { skipPreflight: false, preflightCommitment: "confirmed" },
        ],
      };
      const r = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j && j.error) throw new Error(j.error.message || "RPC error");
      signature = j?.result || j;
    }

    return jsonCors(200, { signature });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonCors(500, { error: msg });
  }
};

export const onRequestOptions = async () => {
  return new Response(null, { status: 204, headers: applyCors(new Headers()) });
};
