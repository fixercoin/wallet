// Shared config for RPC URL. Supports Alchemy, Helius, and Moralis
// Priority: env vars > default public RPC

export const SOLANA_RPC_URL = (() => {
  // Prefer Vite/browser env in client builds
  try {
    // @ts-ignore - import.meta may not exist in SSR/Node
    const viteUrl = (import.meta as any)?.env?.VITE_SOLANA_RPC_URL;
    if (viteUrl && String(viteUrl).trim()) return String(viteUrl).trim();
  } catch {}

  // Generic SOLANA_RPC_URL override
  if (typeof process !== "undefined" && (process.env as any)?.SOLANA_RPC_URL) {
    return (process.env as any).SOLANA_RPC_URL as string;
  }

  // Helius API key
  if (typeof process !== "undefined" && process.env?.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  }

  // Provider-specific URLs
  if (typeof process !== "undefined" && process.env?.HELIUS_RPC_URL) {
    return process.env.HELIUS_RPC_URL;
  }
  if (typeof process !== "undefined" && process.env?.MORALIS_RPC_URL) {
    return process.env.MORALIS_RPC_URL;
  }
  if (typeof process !== "undefined" && process.env?.ALCHEMY_RPC_URL) {
    return process.env.ALCHEMY_RPC_URL;
  }

  // Default public Solana RPC (use publicnode for CORS support)
  return "https://solana-rpc.publicnode.com/";
})();

// Legacy export for backward compatibility
export const ALCHEMY_RPC_URL = SOLANA_RPC_URL;
