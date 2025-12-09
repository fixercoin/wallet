import { SOLANA_RPC_URL } from "../../utils/solanaConfig";
import {
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import bs58 from "bs58";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

const FIXER_MINT = new PublicKey(
  "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
);
const LOCKER_MINT = new PublicKey(
  "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
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

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice) as any);
  }
  return btoa(binary);
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

  const recipient = String(body?.recipient || "").trim();
  const burnSignature = String(body?.burnSignature || "").trim();
  const amountRawStr = String(body?.amountRaw || "").trim();
  const fixerMintStr = String(body?.fixerMint || FIXER_MINT.toBase58());
  const lockerMintStr = String(body?.lockerMint || LOCKER_MINT.toBase58());

  if (!recipient || !burnSignature || !amountRawStr) {
    return jsonCors(400, {
      error: "recipient, burnSignature and amountRaw are required",
    });
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

  const FIXER = new PublicKey(fixerMintStr);
  const LOCKER = new PublicKey(lockerMintStr);
  const recipientPk = new PublicKey(recipient);

  // Verify burn signature reduced user's FIXER balance by amountRaw
  try {
    const tx = await rpcCall(rpcUrl, "getParsedTransaction", [
      burnSignature,
      { maxSupportedTransactionVersion: 0 },
    ]);
    if (!tx || !tx.meta) throw new Error("Transaction not found");
    const pre = (tx.meta.preTokenBalances || []) as any[];
    const post = (tx.meta.postTokenBalances || []) as any[];

    // Find delta for FIXER on any owner account
    const mintStr = FIXER.toBase58();
    let burned: bigint = BigInt(0);
    for (const p of pre) {
      if (p.mint === mintStr) {
        const owner = p.owner;
        const preAmt = BigInt(p.uiTokenAmount?.amount || p.amount || "0");
        const p2 = post.find((q) => q.mint === mintStr && q.owner === owner);
        const postAmt = BigInt(p2?.uiTokenAmount?.amount || p2?.amount || "0");
        if (preAmt > postAmt) burned += preAmt - postAmt;
      }
    }
    const claimed = BigInt(amountRawStr);
    if (burned < claimed) throw new Error("Burn verification failed");
  } catch (e) {
    return jsonCors(400, { error: "Unable to verify burn signature" });
  }

  // Compute reward = 110% of burned amount (floor)
  const burnedRaw = BigInt(amountRawStr);
  const rewardRaw = (burnedRaw * BigInt(11)) / BigInt(10);

  try {
    const rewardOwner = rewardKey.publicKey;
    const sourceAta = deriveAta(rewardOwner, LOCKER);
    const destAta = deriveAta(recipientPk, LOCKER);

    const tx = new Transaction();
    // Ensure source and destination ATAs (idempotent)
    tx.add(
      new TransactionInstruction({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: rewardOwner, isSigner: true, isWritable: true },
          { pubkey: sourceAta, isSigner: false, isWritable: true },
          { pubkey: rewardOwner, isSigner: false, isWritable: false },
          { pubkey: LOCKER, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(new Uint8Array([1])),
      }),
    );
    tx.add(
      new TransactionInstruction({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: rewardOwner, isSigner: true, isWritable: true },
          { pubkey: destAta, isSigner: false, isWritable: true },
          { pubkey: recipientPk, isSigner: false, isWritable: false },
          { pubkey: LOCKER, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(new Uint8Array([1])),
      }),
    );

    // Transfer LOCKER to recipient
    tx.add(
      ixTransferChecked(sourceAta, LOCKER, destAta, rewardOwner, rewardRaw, 6),
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
          base64FromBytes(raw),
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
