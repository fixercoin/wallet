// Solana RPC configuration
// Uses public Solflare RPC endpoint (no API key required)

export const SOLANA_RPC_URL = (() => {
  // PRIORITY 1: Vite env variable
  try {
    const viteUrl = (import.meta as any)?.env?.VITE_SOLANA_RPC_URL;
    if (viteUrl && String(viteUrl).trim()) return String(viteUrl).trim();
  } catch {}

  // PRIORITY 2: Process env variable
  if (typeof process !== "undefined" && (process.env as any)?.SOLANA_RPC_URL) {
    return (process.env as any).SOLANA_RPC_URL as string;
  }

  // FALLBACK: Public Solflare RPC endpoint (read-only, no auth required)
  console.log(
    "Using public Solflare RPC endpoint: https://api.mainnet-beta.solflare.network",
  );
  return "https://api.mainnet-beta.solflare.network";
})();

// Legacy export for backward compatibility
export const ALCHEMY_RPC_URL = SOLANA_RPC_URL;
