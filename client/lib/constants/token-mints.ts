/**
 * Centralized token mint addresses for Solana mainnet
 * These are the canonical addresses and should be used across the entire application
 * Source: client/lib/wallet-proxy.ts (DEFAULT_TOKENS)
 */

export const TOKEN_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenEns",
  FIXERCOIN: "H4qKn8FMFha8jJuj8xMryMqRhH3h7GjLuxw7TVixpump",
  LOCKER: "EN1nYrW6375zMPUkpkGyGSEXW8WmAqYu4yhf6xnGpump",
} as const;

// Tokens that must be excluded/removed across the app (e.g., FXM)
// Keep mints here to ensure they don't contribute to totals or supported lists
export const REMOVED_MINTS = new Set<string>([
  // FXM (deprecated)
  "Ghj3B53xFd3qUw3nywhRFbqAnoTEmLbLPaToM7gABm63",
]);

// Some sources may still surface symbol values; guard against that too
export const REMOVED_SYMBOLS = new Set<string>(["FXM"]);
