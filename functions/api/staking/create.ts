/**
 * POST /api/staking/create
 * Create a new stake after confirming token transfer
 *
 * This endpoint expects the user to have already:
 * 1. Built a transfer transaction (tokens: user wallet → vault wallet)
 * 2. Signed and sent the transaction
 * 3. Confirmed the transaction on-chain
 * Then call this endpoint with the transaction signature to record the stake
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import { KVStore } from "../../lib/kv-utils";
import {
  REWARD_CONFIG,
  Stake,
  calculateReward,
  generateStakeId,
} from "../../lib/reward-config";

interface Env {
  STAKING_KV: any;
  [key: string]: any;
}

interface CreateStakeRequest {
  wallet: string;
  tokenMint: string;
  amount: number;
  periodDays: number;
  transferTxSignature: string; // Transaction signature of the token transfer
  message: string;
  messageSignature: string;
}

function applyCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Vary", "Origin");
  return headers;
}

function jsonResponse(status: number, body: any) {
  const headers = applyCors(
    new Headers({ "Content-Type": "application/json" }),
  );
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers,
  });
}

function verifySignature(
  message: string,
  signature: string,
  publicKeyStr: string,
): boolean {
  try {
    const sig = bs58.decode(signature);
    const msg = new TextEncoder().encode(message);
    const pubKeyBytes = bs58.decode(publicKeyStr);
    return nacl.sign.detached.verify(msg, sig, pubKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Verify transaction signature is valid (format check)
 * Full validation requires RPC access to confirm the transaction actually occurred
 */
function isValidTransactionSignature(signature: string): boolean {
  try {
    const decoded = bs58.decode(signature);
    // Transaction signatures should be 64 bytes
    return decoded.length === 64;
  } catch {
    return false;
  }
}

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    // Verify KV binding is available
    if (!env.STAKING_KV) {
      console.error(
        "STAKING_KV binding not found in env. Available bindings:",
        Object.keys(env),
      );
      return jsonResponse(500, {
        error:
          "KV storage not configured. Please verify wrangler.toml bindings.",
      });
    }

    const body: CreateStakeRequest = await request.json();

    // Validate inputs
    const {
      wallet,
      tokenMint,
      amount,
      periodDays,
      transferTxSignature,
      message,
      messageSignature,
    } = body;

    if (!wallet || !tokenMint || !amount || !periodDays) {
      return jsonResponse(400, {
        error: "Missing required fields: wallet, tokenMint, amount, periodDays",
      });
    }

    if (!transferTxSignature) {
      return jsonResponse(400, {
        error:
          "Missing transfer transaction signature. Please sign and send the token transfer transaction first.",
      });
    }

    if (!isValidTransactionSignature(transferTxSignature)) {
      return jsonResponse(400, {
        error: "Invalid transaction signature format",
      });
    }

    if (amount <= 0) {
      return jsonResponse(400, {
        error: "Amount must be greater than 0",
      });
    }

    // Verify message signature
    if (!verifySignature(message, messageSignature, wallet)) {
      return jsonResponse(401, { error: "Invalid message signature" });
    }

    // Validate period
    const validPeriods = [
      10 / (24 * 60), // 10 minutes
      10, // 10 days
      30, // 30 days
      60, // 60 days
      90, // 90 days
    ];
    if (!validPeriods.some((p) => Math.abs(p - periodDays) < 0.0001)) {
      return jsonResponse(400, {
        error:
          "Invalid period. Must be 10 minutes, 10 days, 30 days, 60 days, or 90 days",
      });
    }

    // Create stake record
    const now = Date.now();
    const endTime = now + periodDays * 24 * 60 * 60 * 1000;
    const rewardAmount = calculateReward(amount, periodDays);
    const stakeId = generateStakeId();

    const stake: Stake = {
      id: stakeId,
      walletAddress: wallet,
      tokenMint,
      amount,
      stakePeriodDays: periodDays,
      startTime: now,
      endTime,
      rewardAmount,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    // Save to KV
    const kvStore = new KVStore(env.STAKING_KV);
    await kvStore.createStake(stake);

    return jsonResponse(201, {
      success: true,
      data: {
        ...stake,
        timeRemainingMs: periodDays * 24 * 60 * 60 * 1000,
        vaultWallet: REWARD_CONFIG.vaultWallet,
        transferTxSignature,
      },
    });
  } catch (error) {
    console.error("Error in /api/staking/create:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: applyCors(new Headers()),
  });
};
