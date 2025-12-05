export async function handleForexRate(req, res) {
  try {
    const { from = "USD", to = "PKR" } = req.query;

    const rates = {
      USD: { PKR: 280, EUR: 0.92 },
      EUR: { USD: 1.09, PKR: 305 },
      PKR: { USD: 0.0036, EUR: 0.0033 },
    };

    const fromRate = rates[from] || {};
    const rate = fromRate[to] || 1;

    res.json({
      from,
      to,
      rate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to fetch forex rate",
      details: error.message,
    });
  }
}
