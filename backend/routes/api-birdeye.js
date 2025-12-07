export async function handleBirdeyePrice(req, res) {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: "Missing address parameter" });
    }

    res.json({
      success: true,
      data: {
        address,
        symbol: "UNKNOWN",
        name: "Unknown",
        decimals: 6,
        price: 0,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: "Birdeye API error",
      details: error.message,
    });
  }
}
