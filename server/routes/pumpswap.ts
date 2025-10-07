import { RequestHandler } from "express";
import { Connection, Transaction, PublicKey } from "@solana/web3.js";

// Server-side builder for PumpSwap swap transactions using a Pump SDK if available.
// The endpoint constructs a Transaction (legacy) with the swap instruction and
// returns a base64-serialized unsigned transaction for the client to sign.

const PUMP_IMPORT_ERROR = new Error(
  "PumpSwap SDK not installed on server. To enable server-side building run: pnpm add @pump/swap-sdk"
);

export const buildPumpSwap: RequestHandler = async (req, res) => {
  try {
    const {
      poolAddress,
      inputMint,
      outputMint,
      amount, // human-readable amount (number)
      ownerPublicKey,
      side = "SELL",
    } = req.body || {};

    if (!ownerPublicKey || !inputMint || !outputMint || !amount) {
      return res.status(400).json({ error: "Missing required fields: ownerPublicKey, inputMint, outputMint, amount" });
    }

    // Build Solana connection using HELIUS_RPC if available
    const rpcUrl = process.env.HELIUS_RPC || "https://api.mainnet-beta.solana.com";
    const conn = new Connection(rpcUrl, { commitment: "confirmed" });

    // Attempt to load optional Pump SDK at runtime using createRequire to avoid bundler static resolution
    let pump: any = null;
    try {
      const { createRequire } = await import("module");
      const require = createRequire(import.meta.url);
      try {
        pump = require("@pump/swap-sdk");
      } catch (reqErr) {
        // sometimes the package exports default
        try {
          pump = require("@pump/swap-sdk").default;
        } catch (e) {
          throw reqErr;
        }
      }
    } catch (err) {
      console.error("Pump SDK import failed:", err);
      return res.status(501).json({ error: PUMP_IMPORT_ERROR.message });
    }

    // Obtain pool representation from SDK
    let sdkPool: any = null;
    try {
      if (typeof pump.getPoolByMint === "function") {
        sdkPool = await pump.getPoolByMint(conn, poolAddress || inputMint);
      } else if (typeof pump === "function") {
        const sdkInstance = new pump({ connection: conn });
        if (typeof sdkInstance.getPoolByMint === "function") {
          sdkPool = await sdkInstance.getPoolByMint(poolAddress || inputMint);
        }
      }
    } catch (err) {
      console.warn("Pump SDK failed to fetch pool:", err);
    }

    if (!sdkPool) {
      return res.status(500).json({ error: "Pump SDK pool not found or SDK not supported in this environment" });
    }

    // Build swap instruction using SDK
    let ix: any = null;
    try {
      if (typeof pump.buildSwapInstruction === "function") {
        ix = await pump.buildSwapInstruction({
          connection: conn,
          pool: sdkPool,
          owner: ownerPublicKey,
          amountIn: amount,
          side,
        });
      } else if (typeof pump === "function") {
        const sdkInstance = new pump({ connection: conn });
        if (typeof sdkInstance.buildSwapInstruction === "function") {
          ix = await sdkInstance.buildSwapInstruction({ pool: sdkPool, owner: ownerPublicKey, amountIn: amount, side });
        }
      }
    } catch (err) {
      console.error("Pump SDK failed to build swap instruction:", err);
      return res.status(500).json({ error: "Failed to build swap instruction using Pump SDK", details: String(err) });
    }

    if (!ix) {
      return res.status(500).json({ error: "Pump SDK did not return a swap instruction" });
    }

    // Construct legacy Transaction with the instruction
    const tx = new Transaction();
    tx.add(ix);
    tx.feePayer = new PublicKey(ownerPublicKey);

    // Fetch recent blockhash
    const latest = await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;

    // Serialize unsigned transaction (allow missing signatures)
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const b64 = Buffer.from(serialized).toString("base64");

    return res.json({ serializedTransaction: b64, message: "Unsigned transaction (base64) - sign locally and submit" });
  } catch (error) {
    console.error("Server pump swap build error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
};
