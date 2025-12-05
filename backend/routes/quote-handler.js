export async function handleLocalQuote(req, res) {
  try {
    const { inputMint, outputMint, amount } = req.query;

    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: "Missing required parameters: inputMint, outputMint, amount",
      });
    }

    res.json({
      inputMint,
      outputMint,
      inAmount: String(amount),
      outAmount: "0",
      swapMode: "ExactIn",
      slippageBps: 50,
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to get quote",
      details: error.message,
    });
  }
}
