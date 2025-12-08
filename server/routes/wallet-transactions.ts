import { RequestHandler } from "express";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = "https://api.mainnet-beta.solflare.network";
const connection = new Connection(RPC_URL, "confirmed");

export const handleWalletTransactions: RequestHandler = async (req, res) => {
  try {
    const publicKey = String(req.query.publicKey || "");
    const mint = String(req.query.mint || "");

    if (!publicKey) {
      return res.status(400).json({ error: "publicKey query param required" });
    }

    const sigs = await connection.getSignaturesForAddress(
      new PublicKey(publicKey),
      { limit: 50 },
    );
    const recent = Array.isArray(sigs) ? sigs.slice(0, 50) : [];

    const results: any[] = [];

    for (const s of recent) {
      try {
        const tx = await connection.getParsedTransaction(s.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (!tx || !tx.meta) continue;

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
