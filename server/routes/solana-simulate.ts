import { RequestHandler } from "express";
import { Connection } from "@solana/web3.js";

export const handleSolanaSimulate: RequestHandler = async (req, res) => {
  try {
    const { signedBase64 } = req.body;
    if (!signedBase64) {
      return res
        .status(400)
        .json({
          error: { code: -32602, message: "Missing signedBase64 param" },
        });
    }

    const rpcUrl =
      process.env.HELIUS_RPC || "https://api.mainnet-beta.solana.com";
    const conn = new Connection(rpcUrl, { commitment: "confirmed" });

    let raw: Buffer;
    try {
      raw = Buffer.from(signedBase64, "base64");
      if (!raw || raw.length === 0) {
        return res
          .status(400)
          .json({
            error: {
              code: -32602,
              message: "Invalid signedBase64 param (empty after decode)",
            },
          });
      }
    } catch (e) {
      console.error("Invalid base64 in signedBase64:", e);
      return res
        .status(400)
        .json({
          error: {
            code: -32602,
            message: "Invalid signedBase64 param (failed to decode base64)",
            details: String(e instanceof Error ? e.message : e),
          },
        });
    }

    // Perform simulation and catch RPC-level errors explicitly
    let sim: any = null;
    try {
      // Prefer built-in helper if available
      if (typeof (conn as any).simulateRawTransaction === "function") {
        sim = await (conn as any).simulateRawTransaction(raw);
      } else {
        // Fallback to direct JSON-RPC simulateTransaction call
        const txBase64 = signedBase64;
        try {
          const rpcBody = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "simulateTransaction",
            params: [txBase64, { sigVerify: false, commitment: "confirmed" }],
          });
          const rpcResp = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: rpcBody,
          });
          const rpcJson = await rpcResp.json();
          sim = rpcJson.result || rpcJson;
        } catch (rpcFetchErr) {
          throw rpcFetchErr;
        }
      }
    } catch (rpcErr) {
      console.error(
        "simulateRawTransaction / simulateTransaction failed:",
        rpcErr,
      );
      return res
        .status(500)
        .json({
          error: {
            code: -32010,
            message: rpcErr instanceof Error ? rpcErr.message : String(rpcErr),
            stack: rpcErr instanceof Error ? rpcErr.stack : undefined,
            rpcError: String(rpcErr),
          },
        });
    }

    if (!sim) {
      console.error("simulateRawTransaction returned empty result", {
        signedLen: raw.length,
      });
      return res
        .status(500)
        .json({
          error: {
            code: -32010,
            message: "Simulation returned empty result",
            details: { signedLen: raw.length },
          },
        });
    }

    const payload: any = { simulation: sim };

    // Try to parse logs for insufficient lamports
    try {
      const logs: string[] = sim?.value?.logs || sim?.logs || [];
      if (Array.isArray(logs)) {
        for (const line of logs) {
          const m = /insufficient lamports\s*(\d+),\s*need\s*(\d+)/i.exec(line);
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
    } catch (e) {
      console.error("Error parsing simulation logs:", e);
    }

    return res.json(payload);
  } catch (error) {
    console.error("solana-simulate error:", error);
    return res
      .status(500)
      .json({
        error: {
          code: -32010,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
  }
};
