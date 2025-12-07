import { RequestHandler } from "express";
import bs58 from "bs58";

const RPC_ENDPOINTS = [
  process.env.SOLANA_RPC_URL || "",
  process.env.HELIUS_RPC_URL || "",
  "https://solana.publicnode.com",
  "https://api.solflare.com",
  "https://rpc.ankr.com/solana",
  "https://rpc.ironforge.network/mainnet",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean);

async function callSolanaRpc(
  method: string,
  params: any[],
  endpoint?: string,
): Promise<any> {
  const endpoints = endpoint ? [endpoint] : RPC_ENDPOINTS;
  let lastError: Error | null = null;

  for (const rpcUrl of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 || response.status === 403) {
          lastError = new Error(
            `HTTP ${response.status} - trying next endpoint`,
          );
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        lastError = new Error(
          `RPC error (${data.error.code}): ${data.error.message}`,
        );
        continue;
      }

      return data.result;
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }
  }

  throw lastError || new Error("All RPC endpoints failed");
}

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

    // Decode base64 to bytes
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
      // Convert bytes to Base58 for RPC (Solana RPC expects Base58, not Base64)
      const txBase58 = bs58.encode(txBuffer);

      const signature = await callSolanaRpc("sendTransaction", [
        txBase58,
        { skipPreflight: false, preflightCommitment: "processed" },
      ]);

      console.log(`[Solana Send] ✅ Transaction sent: ${signature}`);

      return res.json({
        success: true,
        result: signature,
        signature,
      });
    } catch (rpcError: any) {
      console.error(`[Solana Send] RPC error:`, rpcError.message);

      // Map common RPC errors to helpful messages
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

    // Decode base64 to bytes
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
      // Convert bytes to Base58 for RPC (Solana RPC expects Base58, not Base64)
      const txBase58 = bs58.encode(txBuffer);

      const result = await callSolanaRpc("simulateTransaction", [
        txBase58,
        { signers: [], commitment: "processed" },
      ]);

      console.log(`[Solana Simulate] ✅ Simulation complete`);

      // Check for errors in simulation
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

      // Extract useful info from simulation
      const unitsConsumed = result?.unitsConsumed || 0;
      const logs = result?.logs || [];

      // Check for specific issues in logs
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
            diffSol: 0.001, // Rough estimate, could calculate precisely from logs
          },
        }),
      });
    } catch (rpcError: any) {
      console.error(`[Solana Simulate] RPC error:`, rpcError.message);

      const errorMsg = rpcError.message || "";

      // Some RPC errors during simulation are expected (transaction would fail)
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
