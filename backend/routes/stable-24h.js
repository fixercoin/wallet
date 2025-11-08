export async function handleStable24h(req, res) {
  try {
    res.json({
      USDC: {
        price: 1.0,
        change24h: 0,
      },
      USDT: {
        price: 1.0,
        change24h: 0,
      },
      USDH: {
        price: 1.0,
        change24h: 0,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to fetch stable coin data",
      details: error.message,
    });
  }
}
