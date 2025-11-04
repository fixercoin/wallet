import { RequestHandler } from "express";

export const handleUnifiedSwapLocal: RequestHandler = async (req, res) => {
  try {
    const body = req.body || {};
    const provider = (body.provider || "auto").toLowerCase();
    const { inputMint, outputMint, amount, wallet } = body as any;

    // Determine server-side wallet pubkey fallback
    const serverWallet = process.env.FIXORIUM_WALLET_PUBKEY || null;

    // Prefer Meteora for unified swap when input/output/amount provided
    if (
      (provider === "meteora" || provider === "auto") &&
      inputMint &&
      outputMint &&
      amount
    ) {
      const payload = {
        userPublicKey: wallet || serverWallet || null,
        inputMint,
        outputMint,
        inputAmount: String(amount),
        slippageBps: body.slippageBps || 500,
        sign: false,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const resp = await fetch("https://api.meteora.ag/swap/v3/swap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const text = await resp.text().catch(() => "");
        let jsonBody: any = null;
        try {
          jsonBody = text ? JSON.parse(text) : null;
        } catch (e) {
          jsonBody = text;
        }
        if (!resp.ok) {
          return res
            .status(resp.status)
            .json({ error: "Meteora swap failed", details: jsonBody });
        }
        return res.json({
          source: "meteora",
          swap: jsonBody,
          signingRequired: true,
        });
      } catch (e: any) {
        clearTimeout(timeout);
        console.warn("Local Meteora swap error:", e?.message || e);
        // fall through to proxy or error below
      }
    }

    return res
      .status(400)
      .json({
        error:
          "Unsupported swap request or missing fields (inputMint, outputMint, amount)",
      });
  } catch (e: any) {
    return res
      .status(502)
      .json({
        error: "Failed to process swap locally",
        details: e?.message || String(e),
      });
  }
};
