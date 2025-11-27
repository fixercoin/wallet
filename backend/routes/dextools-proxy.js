export async function handleDexToolsPrice(req, res) {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: "Missing address parameter" });
    }

    res.json({
      address,
      price: 0,
      liquidity: 0,
      volume: 0,
    });
  } catch (error) {
    res.status(502).json({
      error: "DexTools API error",
      details: error.message,
    });
  }
}
