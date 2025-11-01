import { RequestHandler } from "express";

/**
 * CoinMarketCap API Proxy
 * Provides server-side access to CoinMarketCap API with API key management
 */

const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const CMC_BASE_URL = "https://pro-api.coinmarketcap.com/v1";

export const handleCoinMarketCapQuotes: RequestHandler = async (req, res) => {
  try {
    const symbols = req.query.symbols as string | undefined;

    if (!symbols || !symbols.trim()) {
      return res.status(400).json({
        error: "Missing or empty 'symbols' query parameter",
      });
    }

    // If no API key configured, return helpful error
    if (!CMC_API_KEY) {
      console.warn(
        "[CoinMarketCap] No API key configured - set COINMARKETCAP_API_KEY environment variable",
      );
      return res.status(503).json({
        error:
          "CoinMarketCap API key not configured on server. Please add COINMARKETCAP_API_KEY to environment variables.",
        data: null,
      });
    }

    console.log(
      `[CoinMarketCap] Fetching quotes for symbols: ${symbols.substring(0, 100)}`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const url = new URL(`${CMC_BASE_URL}/cryptocurrency/quotes/latest`);
    url.searchParams.append("symbol", symbols);
    url.searchParams.append("convert", "USD");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-CMC_PRO_API_KEY": CMC_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[CoinMarketCap] API error: ${response.status} ${response.statusText}`,
      );
      return res.status(response.status).json({
        error: `CoinMarketCap API error: ${response.status}`,
        details: errorText,
        data: null,
      });
    }

    const data = await response.json();

    // Check for API-level errors
    if (data.status?.error_code !== 0) {
      console.warn(
        `[CoinMarketCap] API returned error: ${data.status?.error_message}`,
      );
      return res.status(400).json({
        error: data.status?.error_message || "CoinMarketCap API error",
        data: null,
      });
    }

    console.log(
      `[CoinMarketCap] ✅ Got quotes for ${Object.keys(data.data || {}).length} symbols`,
    );

    res.json(data);
  } catch (error: any) {
    // Handle abort/timeout
    if (error.name === "AbortError") {
      console.warn("[CoinMarketCap] Request timeout");
      return res.status(504).json({
        error: "CoinMarketCap request timeout",
        data: null,
      });
    }

    console.error("[CoinMarketCap] Proxy error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      data: null,
    });
  }
};

export const handleCoinMarketCapSearch: RequestHandler = async (req, res) => {
  try {
    const query = req.query.q as string | undefined;

    if (!query || !query.trim()) {
      return res.status(400).json({
        error: "Missing or empty 'q' query parameter",
      });
    }

    if (!CMC_API_KEY) {
      return res.status(503).json({
        error:
          "CoinMarketCap API key not configured. Set COINMARKETCAP_API_KEY environment variable.",
        data: null,
      });
    }

    console.log(`[CoinMarketCap] Searching for: ${query}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const url = new URL(`${CMC_BASE_URL}/cryptocurrency/map`);
    url.searchParams.append("symbol", query.toUpperCase());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-CMC_PRO_API_KEY": CMC_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[CoinMarketCap] Search error: ${response.status} ${response.statusText}`,
      );
      return res.status(response.status).json({
        error: `CoinMarketCap search error: ${response.status}`,
        details: errorText,
        data: null,
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "CoinMarketCap search timeout",
        data: null,
      });
    }

    console.error("[CoinMarketCap] Search proxy error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
      data: null,
    });
  }
};
