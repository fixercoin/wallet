// utils/solanaConfig.ts
// Shared config for RPC URL. Uses env if provided.

export const ALCHEMY_RPC_URL = (() => {
  if (typeof process !== "undefined" && process.env?.ALCHEMY_RPC_URL) {
    return process.env.ALCHEMY_RPC_URL;
  }
  // Cloudflare Pages Functions prefer context.env; this file is fallback for local dev
  return "https://solana-mainnet.g.alchemy.com/v2/3Z99FYWB1tFEBqYSyV60t-x7FsFCSEjX";
})();
