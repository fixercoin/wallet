const RPC_ENDPOINTS = [
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  process.env.HELIUS_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  process.env.ALCHEMY_RPC_URL || "",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.publicnode.com",
].filter(Boolean);

export async function handleSolanaRpc(req: Request): Promise<Response> {
  let lastError: Error | null = null;

  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const body = await req.json();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.text();
      return new Response(data, {
        headers: { "Content-Type": "application/json" },
        status: response.status,
      });
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`RPC endpoint ${endpoint} failed:`, lastError.message);
      // Try next endpoint
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      error:
        lastError?.message ||
        "All RPC endpoints failed - no Solana RPC available",
    }),
    { status: 500 },
  );
}
