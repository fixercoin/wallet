export async function handleDexscreenerPrice(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: "Missing token parameter" });
    }

    const url = `https://api.dexscreener.com/latest/dex/tokens/${token}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({
      error: "Failed to fetch price",
      details: error.message,
    });
  }
}

export async function handleSolPrice(req, res) {
  res.json({
    symbol: "SOL",
    priceUsd: 149.38,
    priceNative: "1",
  });
}

export async function handleTokenPrice(req, res) {
  try {
    const { mint, token } = req.query;
    if (!mint && !token) {
      return res.status(400).json({
        error: "Missing mint or token parameter",
      });
    }

    const identifier = mint || token;
    const url = `https://api.dexscreener.com/latest/dex/tokens/${identifier}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({
      error: "Failed to fetch token price",
      details: error.message,
    });
  }
}
