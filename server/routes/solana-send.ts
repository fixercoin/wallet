import { RequestHandler } from "express";
import { Connection, VersionedTransaction } from "@solana/web3.js";

export const handleSolanaSend: RequestHandler = async (req, res) => {
  try {
    const { signedBase64 } = req.body;
    if (!signedBase64) {
      return res.status(400).json({
        error: { code: -32602, message: "Missing signedBase64 param" },
      });
    }

    const rpcUrl =
      process.env.HELIUS_RPC || "https://api.mainnet-beta.solana.com";
    const conn = new Connection(rpcUrl, { commitment: "confirmed" });

    // Decode base64 to Buffer/Uint8Array
    const raw = Buffer.from(signedBase64, "base64");

    // Send raw transaction via @solana/web3.js which handles provider specifics
    try {
      const sig = await conn.sendRawTransaction(raw, { skipPreflight: false });

      // Attempt to confirm
      try {
        await conn.confirmTransaction(sig, "confirmed");
      } catch (confirmErr) {
        console.warn("Confirmation warning:", confirmErr);
      }

      return res.json({ result: sig });
    } catch (sendErr) {
      // Enhanced error response: include logs and simulation data if available
      console.error(
        "sendRawTransaction failed:",
        sendErr instanceof Error ? sendErr.message : sendErr,
      );
      const anyErr = sendErr as any;
      const payload: any = { message: anyErr?.message || String(anyErr) };
      if (anyErr?.logs) payload.logs = anyErr.logs;
      if (anyErr?.sendTransactionError)
        payload.sendTransactionError = anyErr.sendTransactionError;
      if (anyErr?.code) payload.code = anyErr.code;

      // Try to call simulateTransaction to provide more diagnostics
      try {
        const vtx = VersionedTransaction.deserialize(raw);
        const sim = await conn.simulateTransaction(vtx);
        payload.simulation = sim;

        // Inspect logs for insufficient lamports pattern and extract numbers
        try {
          const logs: string[] = sim?.value?.logs || sim?.logs || [];
          if (Array.isArray(logs)) {
            for (const line of logs) {
              // pattern like: Transfer: insufficient lamports 1253173, need 1844400
              const m = /insufficient lamports\s*(\d+),\s*need\s*(\d+)/i.exec(
                line,
              );
              if (m) {
                const have = parseInt(m[1], 10);
                const need = parseInt(m[2], 10);
                const diff = need - have;
                const diffSol = diff / 1e9;
                payload.insufficientLamports = { have, need, diff, diffSol };
                break;
              }
            }
          }
        } catch (parseErr) {
          // ignore parse errors
        }
      } catch (simErr) {
        payload.simulationError = String(simErr);
      }

      // If we detected insufficient lamports, return a clear error message
      if (payload.insufficientLamports) {
        const d = payload.insufficientLamports;
        return res.status(400).json({
          error: {
            code: -32002,
            message:
              "Insufficient SOL for transaction fees or rent-exempt accounts",
            details: {
              haveLamports: d.have,
              needLamports: d.need,
              missingLamports: d.diff,
              missingSOL: d.diffSol,
            },
          },
        });
      }

      return res.status(500).json({
        error: {
          code: -32000,
          message: "Transaction submission failed",
          details: payload,
        },
      });
    }
  } catch (error) {
    console.error("solana-send unexpected error:", error);
    return res.status(500).json({
      error: {
        code: -32001,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
};
