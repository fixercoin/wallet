import { RequestHandler } from "express";

// Public Solana RPC endpoints (no API key required)
const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
  "https://solana.blockpi.network/v1/rpc/public",
  "https://solana.publicnode.com",
];

const callRpc = async (method: string, params: any[] = []) => {
  let lastError: Error | null = null;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; SolanaWallet/1.0)",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!resp.ok) {
        if (resp.status === 429 || resp.status === 503 || resp.status === 502) {
          continue; // try next endpoint
        }
        const t = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}. ${t}`);
      }
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || "RPC error");
      return data.result;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(lastError?.message || "All RPC endpoints failed");
};

export const handleWalletBalance: RequestHandler = async (req, res) => {
  try {
    const { publicKey } = req.query;
    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({ error: "Missing or invalid publicKey" });
    }
    const result = await callRpc("getBalance", [publicKey]);
    const lamports: number =
      typeof result === "number" ? result : result?.value || 0;
    const balance = lamports / 1_000_000_000;
    res.json({
      success: true,
      lamports,
      balance,
      publicKey,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const handleWalletTokenAccounts: RequestHandler = async (req, res) => {
  try {
    const { publicKey } = req.query;
    if (!publicKey || typeof publicKey !== "string") {
      return res.status(400).json({ error: "Missing or invalid publicKey" });
    }
    const result = await callRpc("getTokenAccountsByOwner", [
      publicKey,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]);

    // Diagnostic logging for production troubleshooting
    try {
      const rawCount = Array.isArray(result?.value) ? result.value.length : 0;
      console.log(
        `handleWalletTokenAccounts: RPC returned ${rawCount} accounts for ${publicKey}`,
      );
      if (rawCount > 0) {
        const sample = (result.value || [])
          .slice(0, 5)
          .map((a: any) => a.account.data.parsed.info.mint);
        console.log(
          `handleWalletTokenAccounts sample mints: ${JSON.stringify(sample)}`,
        );
      } else {
        console.warn(
          `handleWalletTokenAccounts: no token accounts found for ${publicKey}`,
        );
      }
    } catch (diagErr) {
      console.warn(
        "handleWalletTokenAccounts diagnostic logging failed",
        diagErr,
      );
    }

    const tokenAccounts = (result?.value || []).map((account: any) => {
      const info = account.account.data.parsed.info;
      return {
        mint: info.mint,
        balance: info.tokenAmount.uiAmount || 0,
        decimals: info.tokenAmount.decimals,
        amount: info.tokenAmount.amount,
      };
    });
    res.json({
      success: true,
      tokenAccounts,
      count: tokenAccounts.length,
      publicKey,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      tokenAccounts: [],
      count: 0,
    });
  }
};
