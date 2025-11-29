/**
 * POST /api/staking/create
 * Create a new stake
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
  STAKING_KV: KVNamespace;
}

interface CreateStakeRequest {
  wallet: string;
  tokenMint: string;
  amount: number;
  periodDays: number;
  message: string;
  signature: string;
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

export const onRequestPost = async ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => {
  try {
    const body: CreateStakeRequest = await request.json();

    // Validate inputs
    const { wallet, tokenMint, amount, periodDays, message, signature } = body;

    if (!wallet || !tokenMint || !amount || !periodDays) {
      return jsonResponse(400, {
        error: "Missing required fields: wallet, tokenMint, amount, periodDays",
      });
    }

    if (amount <= 0) {
      return jsonResponse(400, {
        error: "Amount must be greater than 0",
      });
    }

    // Verify signature
    if (!verifySignature(message, signature, wallet)) {
      return jsonResponse(401, { error: "Invalid signature" });
    }

    // Validate period
    if (![30, 60, 90].includes(periodDays)) {
      return jsonResponse(400, {
        error: "Invalid period. Must be 30, 60, or 90 days",
      });
    }

    // Create stake
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
      },
    });
  } catch (error) {
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
