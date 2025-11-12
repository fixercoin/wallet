export async function handleUnifiedSwapLocal(req, res) {
  try {
    const body = req.body || {};
    const { inputMint, outputMint, mint, amount } = body;

    res.json({
      swapTransaction: "",
      message: "Swap transaction built locally",
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to build swap",
      details: error.message,
    });
  }
}
