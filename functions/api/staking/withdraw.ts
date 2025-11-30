/**
 * POST /api/staking/withdraw
 * Withdraw from a completed stake and process rewards
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import { KVStore } from "../../lib/kv-utils";
import { REWARD_CONFIG, RewardDistribution } from "../../lib/reward-config";

interface Env {
  STAKING_KV: KVNamespace;
}

interface WithdrawRequest {
  wallet: string;
  stakeId: string;
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
    const body: WithdrawRequest = await request.json();

    // Validate inputs
    const { wallet, stakeId, message, signature } = body;

    if (!wallet || !stakeId) {
      return jsonResponse(400, {
        error: "Missing required fields: wallet, stakeId",
      });
    }

    // Verify signature
    if (!verifySignature(message, signature, wallet)) {
      return jsonResponse(401, { error: "Invalid signature" });
    }

    // Get stake from KV
    const kvStore = new KVStore(env.STAKING_KV);
    const stake = await kvStore.getStake(stakeId);

    if (!stake) {
      return jsonResponse(404, { error: "Stake not found" });
    }

    // Verify ownership
    if (stake.walletAddress !== wallet) {
      return jsonResponse(403, {
        error: "Unauthorized - You do not own this stake",
      });
    }

    // Verify stake is active
    if (stake.status !== "active") {
      return jsonResponse(400, { error: "Stake is not active" });
    }

    // Check if staking period has ended
    const now = Date.now();
    if (now < stake.endTime) {
      const timeRemaining = (stake.endTime - now) / 1000 / 60; // minutes
      return jsonResponse(400, {
        error: "Staking period has not ended yet",
        timeRemaining,
      });
    }

    // Update stake status
    await kvStore.updateStake(stakeId, {
      status: "withdrawn",
      withdrawnAt: now,
    });

    // Get updated stake
    const updatedStake = await kvStore.getStake(stakeId);

    // Record reward distribution
    const rewardId = `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const reward: RewardDistribution = {
      id: rewardId,
      stakeId,
      walletAddress: wallet,
      rewardAmount: stake.rewardAmount,
      tokenMint: stake.tokenMint,
      status: "processed",
      createdAt: now,
      processedAt: now,
    };

    await kvStore.recordReward(reward);

    return jsonResponse(200, {
      success: true,
      data: {
        stake: updatedStake,
        totalAmount: stake.amount + stake.rewardAmount,
        reward: {
          amount: stake.rewardAmount,
          tokenMint: stake.tokenMint,
          payerWallet: REWARD_CONFIG.rewardWallet,
          recipientWallet: wallet,
          status: "ready_for_distribution",
        },
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
