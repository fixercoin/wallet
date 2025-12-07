// Helius-only RPC configuration
// All RPC calls (SOL, tokens, transactions) use Helius exclusively

export const SOLANA_RPC_URL = (() => {
  // PRIORITY 1: Vite env variable (VITE_SOLANA_RPC_URL for browser builds)
  try {
    // @ts-ignore - import.meta may not exist in SSR/Node
    const viteUrl = (import.meta as any)?.env?.VITE_SOLANA_RPC_URL;
    if (viteUrl && String(viteUrl).trim()) return String(viteUrl).trim();
  } catch {}

  // PRIORITY 2: Generic SOLANA_RPC_URL override
  if (typeof process !== "undefined" && (process.env as any)?.SOLANA_RPC_URL) {
    return (process.env as any).SOLANA_RPC_URL as string;
  }

  // PRIORITY 3: Helius API key configuration
  if (typeof process !== "undefined" && process.env?.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  }

  // PRIORITY 4: Helius RPC URL (if provided without API key)
  if (typeof process !== "undefined" && process.env?.HELIUS_RPC_URL) {
    return process.env.HELIUS_RPC_URL;
  }

  // REQUIRED: HELIUS_API_KEY must be set - no fallbacks to other providers
  throw new Error(
    "HELIUS_API_KEY environment variable is required. Please set it to use Helius RPC endpoints."
  );
})();

// Legacy export for backward compatibility
export const ALCHEMY_RPC_URL = SOLANA_RPC_URL;
