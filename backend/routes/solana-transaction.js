export async function handleSolanaSend(req, res) {
  try {
    const body = req.body || {};
    const tx =
      body.signedBase64 ||
      body.signedTx ||
      body.tx ||
      body.signedTransaction ||
      body.serializedTx ||
      body.serializedTransaction;

    if (!tx || typeof tx !== "string") {
      return res
        .status(400)
        .json({ error: "Missing signed transaction (base64)" });
    }

    res.json({
      transactionHash: "simulated-hash-" + Date.now(),
      status: "submitted",
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to send transaction",
      details: error.message,
    });
  }
}

export async function handleSolanaSimulate(req, res) {
  try {
    const body = req.body || {};
    const tx =
      body.signedBase64 || body.signedTx || body.tx || body.signedTransaction;

    if (!tx || typeof tx !== "string") {
      return res.status(400).json({ error: "Missing signed transaction" });
    }

    res.json({
      value: {
        err: null,
        logs: [],
        unitsConsumed: 1000,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to simulate transaction",
      details: error.message,
    });
  }
}
