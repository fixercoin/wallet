import { RequestHandler } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const RPC_URL = "https://api.mainnet-beta.solflare.network";
const connection = new Connection(RPC_URL, "confirmed");

/**
 * POST /api/solana-send
 * Sends a signed transaction to Solana blockchain
 *
 * Request body:
 * {
 *   signedBase64: string (base64 encoded signed transaction)
 * }
 */
export const handleSolanaSend: RequestHandler = async (req, res) => {
  try {
    const { signedBase64 } = req.body || {};

    if (!signedBase64 || typeof signedBase64 !== "string") {
      return res.status(400).json({
        error: "Missing required field: signedBase64",
      });
    }

    let txBuffer: Buffer;
    try {
      txBuffer = Buffer.from(signedBase64, "base64");
    } catch (e) {
      return res.status(400).json({
        error: "Invalid base64 encoding",
        details: e instanceof Error ? e.message : String(e),
      });
    }

    if (txBuffer.length === 0) {
      return res.status(400).json({
        error: "Transaction data is empty",
      });
    }

    console.log(`[Solana Send] Sending transaction (${txBuffer.length} bytes)`);

    try {
      const txBase58 = bs58.encode(txBuffer);

      const signature = await connection.sendRawTransaction(
        txBuffer,
        { skipPreflight: false, preflightCommitment: "processed" },
      );

      console.log(`[Solana Send] ✅ Transaction sent: ${signature}`);

      return res.json({
        success: true,
        result: signature,
        signature,
      });
    } catch (rpcError: any) {
      console.error(`[Solana Send] Error:`, rpcError.message);

      const errorMsg = rpcError.message || "";
      let userMessage = "Failed to send transaction";

      if (errorMsg.includes("insufficient")) {
        userMessage = "Insufficient SOL for transaction fees";
      } else if (errorMsg.includes("already processed")) {
        userMessage = "Transaction already processed";
      } else if (errorMsg.includes("blockhash not found")) {
        userMessage = "Blockhash expired, please try again";
      } else if (errorMsg.includes("custom program error")) {
        userMessage = "Program execution error - transaction would fail";
      }

      return res.status(400).json({
        error: userMessage,
        details: errorMsg,
        rpcError: rpcError,
      });
    }
  } catch (e: any) {
    console.error("[Solana Send] Handler error:", e);
    return res.status(500).json({
      error: "Failed to send transaction",
      details: e instanceof Error ? e.message : String(e),
    });
  }
};

/**
 * POST /api/solana-simulate
 * Simulates a transaction without sending it
 *
 * Request body:
 * {
 *   signedBase64: string (base64 encoded transaction, can be unsigned)
 * }
 */
export const handleSolanaSimulate: RequestHandler = async (req, res) => {
  try {
    const { signedBase64 } = req.body || {};

    if (!signedBase64 || typeof signedBase64 !== "string") {
      return res.status(400).json({
        error: "Missing required field: signedBase64",
      });
    }

    let txBuffer: Buffer;
    try {
      txBuffer = Buffer.from(signedBase64, "base64");
    } catch (e) {
      return res.status(400).json({
        error: "Invalid base64 encoding",
        details: e instanceof Error ? e.message : String(e),
      });
    }

    if (txBuffer.length === 0) {
      return res.status(400).json({
        error: "Transaction data is empty",
      });
    }

    console.log(
      `[Solana Simulate] Simulating transaction (${txBuffer.length} bytes)`,
    );

    try {
      const result = await connection.simulateTransaction({
        transaction: txBuffer,
        signers: [],
        commitment: "processed",
      });

      console.log(`[Solana Simulate] ✅ Simulation complete`);

      if (result?.err) {
        const errorMsg = JSON.stringify(result.err);
        console.warn(`[Solana Simulate] Transaction would fail:`, errorMsg);

        return res.status(400).json({
          success: false,
          error: "Transaction simulation failed",
          simulationError: result.err,
          logs: result.logs || [],
        });
      }

      const unitsConsumed = result?.unitsConsumed || 0;
      const logs = result?.logs || [];

      let insufficientLamports = false;
      if (logs.some((log: string) => log.includes("insufficient lamports"))) {
        insufficientLamports = true;
      }

      return res.json({
        success: true,
        result,
        unitsConsumed,
        logs,
        insufficientLamports,
        ...(insufficientLamports && {
          insufficientLamports: {
            message: "Insufficient SOL for transaction fees and rent",
            diffSol: 0.001,
          },
        }),
      });
    } catch (rpcError: any) {
      console.error(`[Solana Simulate] Error:`, rpcError.message);

      const errorMsg = rpcError.message || "";

      if (errorMsg.includes("Transaction simulation failed")) {
        return res.status(400).json({
          success: false,
          error: "Transaction simulation failed",
          details: errorMsg,
        });
      }

      return res.status(500).json({
        error: "Simulation request failed",
        details: errorMsg,
      });
    }
  } catch (e: any) {
    console.error("[Solana Simulate] Handler error:", e);
    return res.status(500).json({
      error: "Failed to simulate transaction",
      details: e instanceof Error ? e.message : String(e),
    });
  }
};
