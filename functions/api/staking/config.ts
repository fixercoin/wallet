/**
 * GET /api/staking/config
 * Returns staking configuration including vault wallet address
 */

import { REWARD_CONFIG } from "../../lib/reward-config";

interface Env {
  [key: string]: any;
}

function applyCors(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
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

export const onRequestGet = async ({ env }: { env: Env }) => {
  try {
    return jsonResponse(200, {
      success: true,
      data: {
        vaultWallet: REWARD_CONFIG.vaultWallet,
        rewardWallet: REWARD_CONFIG.rewardWallet,
        apyPercentage: REWARD_CONFIG.apyPercentage,
        rewardTokenMint: REWARD_CONFIG.rewardTokenMint,
      },
    });
  } catch (error) {
    console.error("Error in /api/staking/config:", error);
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
