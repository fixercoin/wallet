import { RequestHandler } from "express";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-api.projectserum.com",
  "https://mainnet.helius-rpc.com/?api-key=public",
  "https://rpc.shyft.to?api_key=public",
];

export const debugWallet: RequestHandler = async (req, res) => {
  const { publicKey } = req.query;

  if (!publicKey || typeof publicKey !== 'string') {
    return res.status(400).json({ error: "Public key is required" });
  }

  const debug = {
    publicKey,
    balance: null as number | null,
    rpcStatus: [] as Array<{ endpoint: string, status: string, error?: string }>,
    tokenAccounts: null as any,
  };

  // Test RPC endpoints
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const connection = new Connection(endpoint, { commitment: "confirmed" });
      const pubKey = new PublicKey(publicKey);
      
      // Test basic connection
      const version = await connection.getVersion();
      debug.rpcStatus.push({ endpoint, status: "success" });
      
      // Try to get balance if this is the first successful endpoint
      if (debug.balance === null) {
        const balance = await connection.getBalance(pubKey);
        debug.balance = balance / LAMPORTS_PER_SOL;
        
        // Try to get token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        });
        debug.tokenAccounts = {
          count: tokenAccounts.value.length,
          accounts: tokenAccounts.value.map(account => ({
            mint: account.account.data.parsed.info.mint,
            balance: account.account.data.parsed.info.tokenAmount.uiAmount,
            decimals: account.account.data.parsed.info.tokenAmount.decimals,
          }))
        };
      }
    } catch (error) {
      debug.rpcStatus.push({ 
        endpoint, 
        status: "error", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  res.json(debug);
};
