const RPC_ENDPOINTS = [
  process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : "",
  process.env.HELIUS_RPC_URL || "",
  process.env.MORALIS_RPC_URL || "",
  process.env.ALCHEMY_RPC_URL || "",
].filter(Boolean);

async function callRpc(payload: any) {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resp.ok) return await resp.json();
      // If you get a 403, skip to next endpoint
    } catch (e) {
      // log error, continue
    }
  }
  throw new Error("All RPC endpoints failed or blocked.");
}
