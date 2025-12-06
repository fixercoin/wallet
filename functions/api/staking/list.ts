/**
 * GET /api/staking/list
 * Fetch all stakes for a wallet
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import { KVStore } from "../../lib/kv-utils";
import { REWARD_CONFIG } from "../../lib/reward-config";

interface Env {
  STAKING_KV: any;
  [key: string]: any;
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

export const onRequestGet = async ({
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

    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");
    const authMessage = url.searchParams.get("message");
    const authSignature = url.searchParams.get("signature");

    if (!walletAddress) {
      return jsonResponse(400, { error: "Missing wallet address" });
    }

    // Optional signature verification
    if (authMessage && authSignature) {
      if (!verifySignature(authMessage, authSignature, walletAddress)) {
        return jsonResponse(401, { error: "Invalid signature" });
      }
    }

    // Fetch stakes from KV
    const kvStore = new KVStore(env.STAKING_KV);
    const stakes = await kvStore.getStakesByWallet(walletAddress);

    // Add timeRemainingMs for active stakes
    const enrichedStakes = stakes.map((stake) => ({
      ...stake,
      timeRemainingMs:
        stake.status === "active" ? Math.max(0, stake.endTime - Date.now()) : 0,
    }));

    return jsonResponse(200, {
      success: true,
      data: enrichedStakes,
      count: enrichedStakes.length,
    });
  } catch (error) {
    console.error("Error in /api/staking/list:", error);
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
