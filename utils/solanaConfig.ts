// Shared config for RPC URL. Supports Alchemy, Helius, and Moralis
// Priority: env vars > default public RPC

export const SOLANA_RPC_URL = (() => {
  // Check for Helius API key first
  if (typeof process !== "undefined" && process.env?.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  }

  // Check for Helius RPC URL
  if (typeof process !== "undefined" && process.env?.HELIUS_RPC_URL) {
    return process.env.HELIUS_RPC_URL;
  }

  // Check for Moralis RPC URL
  if (typeof process !== "undefined" && process.env?.MORALIS_RPC_URL) {
    return process.env.MORALIS_RPC_URL;
  }

  // Check for Alchemy RPC URL
  if (typeof process !== "undefined" && process.env?.ALCHEMY_RPC_URL) {
    return process.env.ALCHEMY_RPC_URL;
  }

  // Fallback to public Solana RPC
  return "https://api.mainnet-beta.solana.com";
})();

// Legacy export for backward compatibility
export const ALCHEMY_RPC_URL = SOLANA_RPC_URL;
