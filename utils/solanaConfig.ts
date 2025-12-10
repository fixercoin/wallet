// Solana RPC configuration with fallback chain
// Priority: Free public endpoints → Alchemy fallback

const FREE_RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solflare.network",
  "https://solana-api.projectserum.com",
  "https://api.mainnet.solflare.com",
];

const ALCHEMY_RPC_URL_FALLBACK =
  "https://solana-mainnet.g.alchemy.com/v2/T79j33bZKpxgKTLx-KDW5";

let currentRpcIndex = 0;

// Test if an RPC endpoint is responsive
async function testRpcEndpoint(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "test",
        method: "getHealth",
        params: [],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Get next available RPC endpoint
async function getAvailableRpcUrl(): Promise<string> {
  const endpointsToTry = [...FREE_RPC_ENDPOINTS, ALCHEMY_RPC_URL_FALLBACK];

  for (let i = 0; i < endpointsToTry.length; i++) {
    const endpoint = endpointsToTry[i];
    if (await testRpcEndpoint(endpoint)) {
      return endpoint;
    }
  }

  // Fallback to Alchemy if all free endpoints fail
  return ALCHEMY_RPC_URL_FALLBACK;
}

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

  // PRIORITY 3: Free endpoints with Alchemy fallback
  console.log("Using free Solana RPC endpoints with Alchemy fallback");
  return FREE_RPC_ENDPOINTS[0];
})();

// Export RPC list for fallback usage
export const RPC_ENDPOINTS = [...FREE_RPC_ENDPOINTS, ALCHEMY_RPC_URL_FALLBACK];

// Function to get a working RPC URL with fallback
export async function getWorkingRpcUrl(): Promise<string> {
  return getAvailableRpcUrl();
}

// Legacy export for backward compatibility
export const ALCHEMY_RPC_URL = SOLANA_RPC_URL;
