export async function handleJupiterPrice(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: "Missing ids parameter" });
    }

    const idArray = String(ids).split(",");
    const data = {};

    for (const id of idArray) {
      data[id] = {
        id,
        mintSymbol: "UNKNOWN",
        vsToken: "USD",
        vsTokenSymbol: "USD",
        price: 0,
      };
    }

    res.json(data);
  } catch (error) {
    res.status(502).json({
      error: "Jupiter price fetch failed",
      details: error.message,
    });
  }
}

export async function handleJupiterQuote(req, res) {
  try {
    const { inputMint, outputMint, amount } = req.query;

    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        error: "Missing required parameters: inputMint, outputMint, amount",
      });
    }

    res.json({
      inputMint,
      inAmount: String(amount),
      outputMint,
      outAmount: "0",
      otherAmountThreshold: "0",
      swapMode: "ExactIn",
      slippageBps: 50,
      priceImpactPct: "0",
      routePlan: [],
    });
  } catch (error) {
    res.status(502).json({
      error: "Jupiter quote failed",
      details: error.message,
    });
  }
}

export async function handleJupiterSwap(req, res) {
  try {
    const { quoteResponse, userPublicKey } = req.body;

    if (!quoteResponse || !userPublicKey) {
      return res.status(400).json({
        error: "Missing required fields: quoteResponse, userPublicKey",
      });
    }

    res.json({
      swapTransaction: "",
      lastValidBlockHeight: 0,
      prioritizationFeeLamports: 0,
    });
  } catch (error) {
    res.status(502).json({
      error: "Jupiter swap failed",
      details: error.message,
    });
  }
}

export async function handleJupiterTokens(req, res) {
  try {
    res.json([]);
  } catch (error) {
    res.status(502).json({
      error: "Jupiter tokens fetch failed",
      details: error.message,
    });
  }
}
