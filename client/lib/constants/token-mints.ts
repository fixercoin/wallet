/**
 * Centralized token mint addresses for Solana mainnet
 * These are the canonical addresses and should be used across the entire application
 * Source: client/lib/wallet-proxy.ts (DEFAULT_TOKENS)
 */

export const TOKEN_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
} as const;
