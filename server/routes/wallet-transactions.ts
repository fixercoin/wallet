import { RequestHandler } from "express";

// Helius is used as an RPC provider for wallet transaction history
// NOT for token price fetching - prices should come from Jupiter, DexScreener, or DexTools
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const HELIUS_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : "";

async function heliusRpc(method: string, params: any[] = []) {
  const resp = await fetch(HELIUS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(
      `Helius RPC failed: ${resp.status} ${resp.statusText} ${txt}`,
    );
  }

  const data = await resp.json();
  if (data.error)
    throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result ?? data;
}

export const handleWalletTransactions: RequestHandler = async (req, res) => {
  try {
    const publicKey = String(req.query.publicKey || "");
    const mint = String(req.query.mint || "");

    if (!publicKey) {
      return res.status(400).json({ error: "publicKey query param required" });
    }

    // Get recent signatures for the wallet
    const sigs = await heliusRpc("getSignaturesForAddress", [
      publicKey,
      { limit: 50 },
    ]);
    const recent = Array.isArray(sigs) ? sigs.slice(0, 50) : [];

    const results: any[] = [];

    for (const s of recent) {
      try {
        const tx = await heliusRpc("getParsedTransaction", [
          s.signature,
          { commitment: "confirmed" },
        ]);
        if (!tx || !tx.meta) continue;

        // Check token balances changes
        const pre = tx.meta.preTokenBalances || [];
        const post = tx.meta.postTokenBalances || [];

        const matchedPost = post.find((b: any) =>
          mint ? b.mint === mint : true,
        );
        const matchedPre = pre.find((b: any) =>
          mint ? b.mint === mint : true,
        );

        if (!matchedPost && !matchedPre) continue;

        const preAmount = matchedPre?.uiTokenAmount?.uiAmount || 0;
        const postAmount = matchedPost?.uiTokenAmount?.uiAmount || 0;
        const diff = postAmount - preAmount;

        results.push({
          signature: s.signature,
          blockTime: s.blockTime,
          type: diff > 0 ? "Receive" : diff < 0 ? "Send" : "Unknown",
          amount: Math.abs(diff),
        });
      } catch (e) {
        console.warn("Failed to fetch tx", s.signature, e);
      }
    }

    res.json({ success: true, transactions: results });
  } catch (error) {
    console.error("Wallet transactions error:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
};
