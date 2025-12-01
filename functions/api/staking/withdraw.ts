/**
 * POST /api/staking/withdraw
 * Withdraw from a completed stake and process rewards
 *
 * This endpoint signs and sends the withdrawal transfer from vault wallet.
 * Requires VAULT_PRIVATE_KEY environment variable to be set with base58-encoded private key.
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { KVStore } from "../../lib/kv-utils";
import {
  REWARD_CONFIG,
  RewardDistribution,
  calculateReward,
  generateStakeId,
} from "../../lib/reward-config";
import {
  signAndSendVaultTransfer,
  validateVaultBalance,
} from "../../lib/vault-transfer";

interface Env {
  STAKING_KV: any;
  [key: string]: any;
}

interface WithdrawRequest {
  wallet: string;
  stakeId: string;
  transferTxSignature: string; // Transaction signature of the withdrawal transfer (vault → user)
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

    const body: WithdrawRequest = await request.json();

    // Validate inputs
    const { wallet, stakeId, transferTxSignature, message, signature } = body;

    if (!wallet || !stakeId) {
      return jsonResponse(400, {
        error: "Missing required fields: wallet, stakeId",
      });
    }

    if (!transferTxSignature) {
      return jsonResponse(400, {
        error:
          "Missing transfer transaction signature. Please sign and send the withdrawal transfer transaction first.",
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

    // Get vault private key from environment
    const vaultPrivateKey = env.VAULT_PRIVATE_KEY;
    if (!vaultPrivateKey) {
      console.error("VAULT_PRIVATE_KEY not configured in environment");
      return jsonResponse(500, {
        error: "Vault is not configured for withdrawals",
        details: "VAULT_PRIVATE_KEY environment variable is missing",
      });
    }

    // Calculate total amount to transfer (staked + reward)
    const totalAmount = stake.amount + stake.rewardAmount;

    // Validate vault has sufficient balance
    const hasBalance = await validateVaultBalance(
      vaultPrivateKey,
      new PublicKey(stake.tokenMint),
      totalAmount,
      6, // Assuming 6 decimals - this should be configurable
    );

    if (!hasBalance) {
      return jsonResponse(500, {
        error: "Vault does not have sufficient balance for withdrawal",
        details: `Required: ${totalAmount}, Contact administrator`,
      });
    }

    let withdrawalTxSignature: string;
    try {
      // Send withdrawal transfer from vault to recipient
      withdrawalTxSignature = await signAndSendVaultTransfer({
        vaultPrivateKeyBase58: vaultPrivateKey,
        recipientWallet: new PublicKey(wallet),
        mint: new PublicKey(stake.tokenMint),
        amount: totalAmount,
        decimals: 6, // Should be configurable
      });
    } catch (error) {
      console.error("Vault transfer failed:", error);
      return jsonResponse(500, {
        error: "Failed to process withdrawal",
        details:
          error instanceof Error ? error.message : "Unknown transfer error",
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
      txHash: withdrawalTxSignature,
      createdAt: now,
      processedAt: now,
    };

    await kvStore.recordReward(reward);

    return jsonResponse(200, {
      success: true,
      data: {
        stake: updatedStake,
        totalAmount: stake.amount + stake.rewardAmount,
        transferTxSignature: withdrawalTxSignature,
        reward: {
          amount: stake.rewardAmount,
          tokenMint: stake.tokenMint,
          payerWallet: REWARD_CONFIG.rewardWallet,
          recipientWallet: wallet,
          status: "processed",
          txHash: withdrawalTxSignature,
        },
      },
    });
  } catch (error) {
    console.error("Error in /api/staking/withdraw:", error);
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
