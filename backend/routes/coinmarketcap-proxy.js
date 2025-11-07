export async function handleCoinMarketCapQuotes(req, res) {
  try {
    const { id, slug } = req.query;
    if (!id && !slug) {
      return res.status(400).json({ error: "Missing id or slug parameter" });
    }

    res.json({
      data: {
        quote: {
          USD: {
            price: 1.0,
          },
        },
      },
    });
  } catch (error) {
    res.status(502).json({
      error: "CoinMarketCap API error",
      details: error.message,
    });
  }
}

export async function handleCoinMarketCapSearch(req, res) {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter" });
    }

    res.json({
      data: [],
    });
  } catch (error) {
    res.status(502).json({
      error: "CoinMarketCap search failed",
      details: error.message,
    });
  }
}
